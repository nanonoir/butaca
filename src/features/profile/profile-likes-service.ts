import "server-only";

import type { LikedMovieItem } from "@/contracts";

import type { UserMovieInteractionRepository } from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import type { TmdbAdapter } from "../../integrations/tmdb";
import { toMovieSummary } from "../movies/movie-summary";

type LikesPort = Pick<UserMovieInteractionRepository, "findLikesByUser">;
type MovieCatalogPort = Pick<TmdbAdapter, "getMovieDetail">;

/** Six fills one row on a wide screen and two on a narrow one. The profile is
 * a page somebody scans, not the library -- the whole thing is a door to
 * `/liked`, not a second copy of it. */
export const RECENT_LIKES = 6;

export class ProfileLikesService {
  constructor(
    private readonly interactions: LikesPort,
    private readonly catalog: MovieCatalogPort,
  ) {}

  /** The repository pages at twenty; only the first few are wanted here, so
   * the rest are dropped before any catalog lookup happens rather than after. */
  async listRecentLikes(userId: string): Promise<LikedMovieItem[]> {
    const records = await this.interactions.findLikesByUser(userId, 1, "all");

    return this.resolveMovies(records.slice(0, RECENT_LIKES));
  }

  private async resolveMovies(
    records: UserMovieInteractionRecord[],
  ): Promise<LikedMovieItem[]> {
    const resolved = await Promise.allSettled(
      records.map(async (record) => ({
        likedAt: record.updatedAt.toISOString(),
        watchedAt: record.watchedAt?.toISOString() ?? null,
        movie: toMovieSummary(await this.catalog.getMovieDetail(record.movieId)),
      })),
    );

    return resolved
      .filter(
        (result): result is PromiseFulfilledResult<LikedMovieItem> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }
}
