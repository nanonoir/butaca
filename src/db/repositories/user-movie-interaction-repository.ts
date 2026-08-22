import "server-only";

import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { PAGE_SIZE } from "../../contracts/common";
import type { LikesWatchedFilter } from "../../contracts/likes";
import type { MovieReaction } from "../../contracts/interactions";
import type { DbExecutor } from "../client";
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

  /** The watched filter is part of the same WHERE as the ownership scope, so a
   * filtered list can never widen past the owner's rows. */
  private likedWhere(userId: string, watched: LikesWatchedFilter) {
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
    );
  }

  async countLikesByUser(
    userId: string,
    watched: LikesWatchedFilter = "all",
  ): Promise<number> {
    const [total] = await this.db
      .select({ total: count() })
      .from(userMovieInteractions)
      .where(this.likedWhere(userId, watched));

    return total?.total ?? 0;
  }

  async findLikesByUser(
    userId: string,
    page = 1,
    watched: LikesWatchedFilter = "all",
  ): Promise<UserMovieInteractionRecord[]> {
    return this.db
      .select()
      .from(userMovieInteractions)
      .where(this.likedWhere(userId, watched))
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
