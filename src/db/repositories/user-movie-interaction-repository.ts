import "server-only";

import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { PAGE_SIZE } from "../../contracts/common";
import type { MovieReaction } from "../../contracts/interactions";
import type { Database } from "../client";
import {
  type UserMovieInteractionRecord,
  userMovieInteractions,
} from "../schema/user-movie-interactions";

export class UserMovieInteractionRepository {
  constructor(private readonly db: Database) {}

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

  async findLikesByUser(
    userId: string,
    page = 1,
  ): Promise<UserMovieInteractionRecord[]> {
    return this.db
      .select()
      .from(userMovieInteractions)
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.reaction, "LIKE"),
        ),
      )
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
}
