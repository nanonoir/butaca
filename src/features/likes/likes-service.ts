import "server-only";

import {
  PAGE_SIZE,
  type LikedMovieItem,
  type LikesQuery,
  type MovieDetail,
  type MovieSummary,
} from "@/contracts";

import type { UserMovieInteractionRepository } from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import type { TmdbAdapter } from "../../integrations/tmdb";

type LikesPort = Pick<
  UserMovieInteractionRepository,
  "findLikesByUser" | "countLikesByUser"
>;

type MovieCatalogPort = Pick<TmdbAdapter, "getMovieDetail">;

export type PaginatedLikes = {
  data: LikedMovieItem[];
  meta: {
    page: number;
    pageSize: typeof PAGE_SIZE;
    totalPages: number;
    totalResults: number;
    hasNextPage: boolean;
  };
};

/** `MovieSummary` is the list shape; the catalog only exposes a detail lookup
 * by id, and the genre ids it carries as objects flatten back to ids here. */
function toSummary(detail: MovieDetail): MovieSummary {
  return {
    id: detail.id,
    title: detail.title,
    originalTitle: detail.originalTitle,
    overview: detail.overview,
    posterPath: detail.posterPath,
    backdropPath: detail.backdropPath,
    genreIds: detail.genres.map((genre) => genre.id),
    releaseDate: detail.releaseDate,
    originalLanguage: detail.originalLanguage,
    tmdbRating: detail.tmdbRating,
    tmdbVoteCount: detail.tmdbVoteCount,
  };
}

export class LikesService {
  constructor(
    private readonly interactions: LikesPort,
    private readonly catalog: MovieCatalogPort,
  ) {}

  async listLikedMovies(
    userId: string,
    query: LikesQuery,
  ): Promise<PaginatedLikes> {
    const [interactions, totalResults] = await Promise.all([
      this.interactions.findLikesByUser(userId, query.page, query.watched),
      this.interactions.countLikesByUser(userId, query.watched),
    ]);
    const items = await this.resolveMovies(interactions);
    const totalPages = Math.ceil(totalResults / PAGE_SIZE);

    return {
      data: items,
      meta: {
        page: query.page,
        pageSize: PAGE_SIZE,
        totalPages,
        totalResults,
        hasNextPage: query.page < totalPages,
      },
    };
  }

  /** One catalog lookup per liked movie, served from the movie cache after the
   * first read. A movie the provider can no longer resolve is dropped instead
   * of failing the whole list: one retired title must not hide the rest. */
  private async resolveMovies(
    interactions: UserMovieInteractionRecord[],
  ): Promise<LikedMovieItem[]> {
    const resolved = await Promise.allSettled(
      interactions.map(async (interaction) => ({
        // updatedAt, not createdAt: it is what the list is ordered by, so the
        // date shown and the position always agree.
        likedAt: interaction.updatedAt.toISOString(),
        watchedAt: interaction.watchedAt?.toISOString() ?? null,
        movie: toSummary(
          await this.catalog.getMovieDetail(interaction.movieId),
        ),
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
