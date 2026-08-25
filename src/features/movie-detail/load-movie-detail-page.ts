import "server-only";

import { notFound } from "next/navigation";

import { MovieRouteParamsSchema } from "@/contracts/common";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { Review } from "@/contracts/reviews";
import { getReviewService } from "@/features/reviews/review-factory";
import { TmdbError } from "@/integrations/tmdb";
import { getOptionalViewer } from "@/lib/api/route";

import { getMovieDetailService } from "./movie-detail-factory";
import { toMovieSlug } from "./movie-slug";

export type MovieDetailPageLoad = {
  pageData: MovieDetailPageData;
  publicReviews: Review[];
  /** True when the address does not spell the film's current title. The full
   * page corrects it; the intercepted one leaves it alone, because replacing
   * the address mid-overlay would throw away the history entry that closing
   * it depends on. */
  slugIsStale: boolean;
};

/** Shared by the film's own page and by the intercepted one that opens over a
 * list, so the two cannot answer differently for the same address. */
export async function loadMovieDetailPage(
  rawMovieId: string,
  slug: string[] | undefined,
): Promise<MovieDetailPageLoad & { movieId: number }> {
  const parsed = MovieRouteParamsSchema.safeParse({ movieId: rawMovieId });

  if (!parsed.success) {
    notFound();
  }

  const { movieId } = parsed.data;
  const viewer = await getOptionalViewer();
  // A number in the address is not a promise that the film exists. Anything
  // else the provider says is a real failure and belongs in the error page
  // rather than disguised as a missing movie.
  const pageData = await getMovieDetailService()
    .getPageData(movieId, viewer)
    .catch((error: unknown) => {
      if (error instanceof TmdbError && error.code === "NOT_FOUND") {
        notFound();
      }

      throw error;
    });
  const reviews = await getReviewService().getMovieReviews(
    movieId,
    1,
    viewer?.id ?? null,
  );

  return {
    movieId,
    pageData,
    publicReviews: reviews.data,
    slugIsStale: (slug?.join("/") ?? "") !== toMovieSlug(pageData.movie.title),
  };
}
