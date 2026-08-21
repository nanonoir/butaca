import "server-only";

import { and, eq } from "drizzle-orm";

import type { Database } from "../client";
import { type MovieCacheRecord, movieCache } from "../schema/movie-cache";

export const MOVIE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isMovieCacheExpired(
  entry: Pick<MovieCacheRecord, "fetchedAt">,
  ttlMs = MOVIE_CACHE_TTL_MS,
  now = new Date(),
) {
  return now.getTime() - entry.fetchedAt.getTime() >= ttlMs;
}

export class MovieCacheRepository {
  constructor(private readonly db: Database) {}

  async get(
    movieId: number,
    language: string,
  ): Promise<MovieCacheRecord | null> {
    const [entry] = await this.db
      .select()
      .from(movieCache)
      .where(
        and(eq(movieCache.movieId, movieId), eq(movieCache.language, language)),
      )
      .limit(1);

    return entry ?? null;
  }

  async set(
    movieId: number,
    language: string,
    payload: unknown,
    fetchedAt = new Date(),
  ): Promise<MovieCacheRecord> {
    const [entry] = await this.db
      .insert(movieCache)
      .values({ movieId, language, payload, fetchedAt })
      .onConflictDoUpdate({
        target: [movieCache.movieId, movieCache.language],
        set: { payload, fetchedAt },
      })
      .returning();

    if (!entry) {
      throw new Error("Could not set movie cache entry");
    }

    return entry;
  }

  async delete(movieId: number, language: string): Promise<boolean> {
    const [entry] = await this.db
      .delete(movieCache)
      .where(
        and(eq(movieCache.movieId, movieId), eq(movieCache.language, language)),
      )
      .returning({ movieId: movieCache.movieId });

    return entry !== undefined;
  }

  isExpired(
    entry: Pick<MovieCacheRecord, "fetchedAt">,
    ttlMs?: number,
    now?: Date,
  ): boolean {
    return isMovieCacheExpired(entry, ttlMs, now);
  }
}
