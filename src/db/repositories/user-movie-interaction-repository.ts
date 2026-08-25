import "server-only";

import {
  and,
  count,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import { PAGE_SIZE } from "../../contracts/common";
import type { LikesWatchedFilter } from "../../contracts/likes";
import type { MovieReaction } from "../../contracts/interactions";
import type { DbExecutor } from "../client";
import { movieCache } from "../schema/movie-cache";
import {
  type UserMovieInteractionRecord,
  userMovieInteractions,
} from "../schema/user-movie-interactions";

export class UserMovieInteractionRepository {
  constructor(private readonly db: DbExecutor) {}

  async findByUserAndMovie(
    userId: string,
    movieId: number,
  ): Promise<UserMovieInteractionRecord | null> {
    const [interaction] = await this.db
      .select()
      .from(userMovieInteractions)
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.movieId, movieId),
        ),
      )
      .limit(1);

    return interaction ?? null;
  }

  async findByUser(
    userId: string,
    page = 1,
  ): Promise<UserMovieInteractionRecord[]> {
    return this.db
      .select()
      .from(userMovieInteractions)
      .where(eq(userMovieInteractions.userId, userId))
      .orderBy(desc(userMovieInteractions.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
  }

  /** Every diacritic Unicode composes, as a character class. Built here rather
   * than typed into the query: a literal range of combining marks is invisible
   * in a source file and the next person to touch it cannot see what it says. */
  private static readonly COMBINING_MARKS = `[${String.fromCharCode(
    0x300,
  )}-${String.fromCharCode(0x36f)}]`;

  /** Accents are decoration here, not meaning: somebody typing "pelicula" is
   * looking for "película". Decomposing to NFD splits an accented letter into
   * the letter and its mark, and dropping the marks leaves the letter -- which
   * needs no Postgres extension, unlike `unaccent`, and covers every accent
   * rather than a hand written list.
   *
   * It rules out an index too, which does not matter: this runs against one
   * viewer's library, a few hundred rows at most. */
  private unaccented(expression: SQL) {
    return sql`regexp_replace(normalize(${expression}, NFD), ${UserMovieInteractionRepository.COMBINING_MARKS}, '', 'g')`;
  }

  /** The library stores movie ids and nothing a person could read, so matching
   * a title reaches into the cached payload the catalog already wrote for every
   * movie the viewer has had on screen. Original title counts too: somebody who
   * types "the" should find "Entrevista con el vampiro". */
  private titleMatches(term: string) {
    // ILIKE reads % and _ as wildcards, so a viewer typing one has to get the
    // character rather than a match on everything.
    const escaped = term.replace(/[%_\\]/g, (character) => `\\${character}`);
    const pattern = `%${escaped}%`;
    const needle = this.unaccented(sql`${pattern}`);
    const title = this.unaccented(sql`${movieCache.payload} ->> 'title'`);
    const original = this.unaccented(
      sql`${movieCache.payload} ->> 'original_title'`,
    );

    return exists(
      this.db
        .select({ matched: sql`1` })
        .from(movieCache)
        .where(
          and(
            eq(movieCache.movieId, userMovieInteractions.movieId),
            sql`(${title} ILIKE ${needle} OR ${original} ILIKE ${needle})`,
          ),
        ),
    );
  }

  /** The watched filter is part of the same WHERE as the ownership scope, so a
   * filtered list can never widen past the owner's rows. */
  private likedWhere(
    userId: string,
    watched: LikesWatchedFilter,
    search?: string,
  ) {
    const watchedCondition =
      watched === "watched"
        ? isNotNull(userMovieInteractions.watchedAt)
        : watched === "unwatched"
          ? isNull(userMovieInteractions.watchedAt)
          : undefined;

    return and(
      eq(userMovieInteractions.userId, userId),
      eq(userMovieInteractions.reaction, "LIKE"),
      watchedCondition,
      search ? this.titleMatches(search) : undefined,
    );
  }

  async countLikesByUser(
    userId: string,
    watched: LikesWatchedFilter = "all",
    search?: string,
  ): Promise<number> {
    const [total] = await this.db
      .select({ total: count() })
      .from(userMovieInteractions)
      .where(this.likedWhere(userId, watched, search));

    return total?.total ?? 0;
  }

  async findLikesByUser(
    userId: string,
    page = 1,
    watched: LikesWatchedFilter = "all",
    search?: string,
  ): Promise<UserMovieInteractionRecord[]> {
    return this.db
      .select()
      .from(userMovieInteractions)
      .where(this.likedWhere(userId, watched, search))
      .orderBy(desc(userMovieInteractions.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
  }

  async findDislikesByUser(
    userId: string,
    page = 1,
  ): Promise<UserMovieInteractionRecord[]> {
    return this.db
      .select()
      .from(userMovieInteractions)
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.reaction, "DISLIKE"),
        ),
      )
      .orderBy(desc(userMovieInteractions.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
  }

  async upsertReaction(
    userId: string,
    movieId: number,
    reaction: MovieReaction,
  ): Promise<UserMovieInteractionRecord> {
    const [interaction] = await this.db
      .insert(userMovieInteractions)
      .values({ userId, movieId, reaction })
      .onConflictDoUpdate({
        target: [userMovieInteractions.userId, userMovieInteractions.movieId],
        set: { reaction, updatedAt: new Date() },
      })
      .returning();

    if (!interaction) {
      throw new Error("Could not upsert user movie interaction");
    }

    return interaction;
  }

  async setWatched(
    userId: string,
    movieId: number,
    watchedAt: Date | null,
  ): Promise<UserMovieInteractionRecord | null> {
    if (watchedAt !== null) {
      const [interaction] = await this.db
        .insert(userMovieInteractions)
        .values({ userId, movieId, reaction: null, watchedAt })
        .onConflictDoUpdate({
          target: [userMovieInteractions.userId, userMovieInteractions.movieId],
          set: { watchedAt, updatedAt: new Date() },
        })
        .returning();

      if (!interaction) {
        throw new Error("Could not set watched state");
      }

      return interaction;
    }

    const [interaction] = await this.db
      .update(userMovieInteractions)
      .set({ watchedAt, updatedAt: new Date() })
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.movieId, movieId),
          isNotNull(userMovieInteractions.reaction),
        ),
      )
      .returning();

    if (interaction) {
      return interaction;
    }

    await this.db
      .delete(userMovieInteractions)
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.movieId, movieId),
          isNull(userMovieInteractions.reaction),
        ),
      );

    return null;
  }

  async delete(userId: string, movieId: number): Promise<boolean> {
    const [watchedInteraction] = await this.db
      .update(userMovieInteractions)
      .set({ reaction: null, updatedAt: new Date() })
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.movieId, movieId),
          isNotNull(userMovieInteractions.reaction),
          isNotNull(userMovieInteractions.watchedAt),
        ),
      )
      .returning({ id: userMovieInteractions.id });

    if (watchedInteraction) {
      return true;
    }

    const [interaction] = await this.db
      .delete(userMovieInteractions)
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.movieId, movieId),
          isNotNull(userMovieInteractions.reaction),
          isNull(userMovieInteractions.watchedAt),
        ),
      )
      .returning({ id: userMovieInteractions.id });

    return interaction !== undefined;
  }

  /** Activity totals for the profile screen. Both counters are scoped by
   * userId like every other private read in this repository. */
  async countByUser(
    userId: string,
  ): Promise<{ liked: number; watched: number }> {
    const [totals] = await this.db
      .select({
        liked: count(
          sql`case when ${userMovieInteractions.reaction} = 'LIKE' then 1 end`,
        ),
        watched: count(userMovieInteractions.watchedAt),
      })
      .from(userMovieInteractions)
      .where(eq(userMovieInteractions.userId, userId));

    return { liked: totals?.liked ?? 0, watched: totals?.watched ?? 0 };
  }

  /** Only the top billed few of each cast are counted.
   *
   * Reading the whole list makes the answer a record of which franchises
   * somebody watched rather than who they like: Stan Lee cameos in every
   * Marvel film at an average billing of 43, and Pixar's good luck charm
   * turns up in all of theirs. Neither is an actor anybody chose. */
  private static readonly TOP_BILLED_CAST = 3;

  /** One cache row per movie, preferring the language in use. Nearly two
   * hundred titles are cached under both the old locale and the current one,
   * and a plain join would count every one of them twice. */
  private cachedPayload(language: string) {
    return sql`(
      select ${movieCache.payload}
      from ${movieCache}
      where ${movieCache.movieId} = ${userMovieInteractions.movieId}
      order by (${movieCache.language} = ${language}) desc
      limit 1
    )`;
  }

  /** Counted over everything the viewer ever liked rather than over a recent
   * window. A taste in people accumulates slowly -- nobody watches a
   * filmography in a week -- so a window is exactly the wrong instrument: ten
   * Tarantinos spread across three years fall outside any of them.
   *
   * Aggregated here rather than in the service because the credits are already
   * in the cached payload. Pulling three hundred movie details one at a time
   * to count names in them is the reason this used to be capped at twenty. */
  private async findTopPeople(
    userId: string,
    language: string,
    people: SQL,
    limit: number,
  ): Promise<{ id: number; name: string }[]> {
    const rows = await this.db.execute(sql`
      select
        (person ->> 'id')::int as id,
        person ->> 'name' as name,
        count(*)::int as appearances
      from ${userMovieInteractions}
      cross join lateral (select ${this.cachedPayload(language)} as payload) cached
      cross join lateral jsonb_array_elements(${people}) person
      where ${userMovieInteractions.userId} = ${userId}
        and ${userMovieInteractions.reaction} = 'LIKE'
        and cached.payload is not null
      group by 1, 2
      order by appearances desc, name asc
      limit ${limit}
    `);

    return (rows as unknown as { id: number; name: string }[]).map(
      ({ id, name }) => ({ id, name }),
    );
  }

  async findTopCastByUser(
    userId: string,
    language: string,
    limit: number,
  ): Promise<{ id: number; name: string }[]> {
    return this.findTopPeople(
      userId,
      language,
      sql`(
        select coalesce(jsonb_agg(member), '[]'::jsonb)
        from jsonb_array_elements(cached.payload -> 'credits' -> 'cast') member
        where (member ->> 'order')::int < ${UserMovieInteractionRepository.TOP_BILLED_CAST}
      )`,
      limit,
    );
  }

  async findTopDirectorsByUser(
    userId: string,
    language: string,
    limit: number,
  ): Promise<{ id: number; name: string }[]> {
    return this.findTopPeople(
      userId,
      language,
      sql`(
        select coalesce(jsonb_agg(member), '[]'::jsonb)
        from jsonb_array_elements(cached.payload -> 'credits' -> 'crew') member
        where member ->> 'job' = 'Director'
      )`,
      limit,
    );
  }

  /** Every movie the viewer already reacted to. Discover excludes them, so it
   * needs the whole set rather than a page of it. */
  async findReactedMovieIds(userId: string): Promise<number[]> {
    const rows = await this.db
      .select({ movieId: userMovieInteractions.movieId })
      .from(userMovieInteractions)
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          isNotNull(userMovieInteractions.reaction),
        ),
      );

    return rows.map((row) => row.movieId);
  }
}
