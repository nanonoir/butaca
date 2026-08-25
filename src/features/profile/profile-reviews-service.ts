import "server-only";

import { PAGE_SIZE, type MyReview } from "@/contracts";

import type { ReviewRepository } from "../../db/repositories";
import type { ReviewRecord } from "../../db/schema/reviews";
import type { TmdbAdapter } from "../../integrations/tmdb";
import { toMovieSummary } from "../movies/movie-summary";

type ReviewPort = Pick<ReviewRepository, "findByUser" | "countByUser">;
type MovieCatalogPort = Pick<TmdbAdapter, "getMovieDetail">;

export type PaginatedMyReviews = {
  data: MyReview[];
  meta: {
    page: number;
    pageSize: typeof PAGE_SIZE;
    totalPages: number;
    totalResults: number;
    hasNextPage: boolean;
  };
};


/** The profile counted the viewer's reviews and had no way to show them. This
 * pairs each one with the movie it is about, which is the only thing that
 * tells them apart once they are off the page they were written on. */
export class ProfileReviewsService {
  constructor(
    private readonly reviews: ReviewPort,
    private readonly catalog: MovieCatalogPort,
  ) {}

  async listMyReviews(
    userId: string,
    page: number,
  ): Promise<PaginatedMyReviews> {
    const [records, totalResults] = await Promise.all([
      this.reviews.findByUser(userId, page),
      this.reviews.countByUser(userId),
    ]);
    const data = await this.resolveMovies(records);
    const totalPages = Math.ceil(totalResults / PAGE_SIZE);

    return {
      data,
      meta: {
        page,
        pageSize: PAGE_SIZE,
        totalPages,
        totalResults,
        hasNextPage: page < totalPages,
      },
    };
  }

  /** Served from the movie cache after the first read. A movie the provider
   * can no longer resolve drops its review rather than failing the list: one
   * retired title must not hide everything else somebody wrote. */
  private async resolveMovies(records: ReviewRecord[]): Promise<MyReview[]> {
    const resolved = await Promise.allSettled(
      records.map(async (record) => ({
        id: record.id,
        movie: toMovieSummary(await this.catalog.getMovieDetail(record.movieId)),
        verdict: record.verdict,
        title: record.title,
        description: record.description,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
    );

    return resolved
      .filter(
        (result): result is PromiseFulfilledResult<MyReview> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }
}
