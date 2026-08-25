"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";

import type { MyReview } from "@/contracts/profile";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { Review } from "@/contracts/reviews";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { ReviewVerdictLabel } from "@/components/shared/review-verdict";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { MovieDetailScreen } from "@/features/movie-detail/movie-detail-screen";
import { Pagination } from "@/features/movies/components/pagination";
import { fetchMovieReviews } from "@/features/reviews/review-client";

/** Three at a time, like the ones under a movie. A review is a block of text,
 * and the profile is a page somebody scans rather than reads. */
const REVIEWS_PER_PAGE = 3;

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface ProfileReviewsProps {
  reviews: MyReview[];
}

export function ProfileReviews({ reviews }: ProfileReviewsProps) {
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{
    pageData: MovieDetailPageData;
    publicReviews: Review[];
  } | null>(null);
  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const visible = reviews.slice(
    (page - 1) * REVIEWS_PER_PAGE,
    page * REVIEWS_PER_PAGE,
  );

  /** The movie is where a review can be edited, so the card opens it rather
   * than offering an editor of its own here. */
  async function openMovie(movieId: number): Promise<void> {
    try {
      const [pageData, movieReviews] = await Promise.all([
        fetchMovieDetail(movieId),
        fetchMovieReviews(movieId),
      ]);

      setDetail({ pageData, publicReviews: movieReviews.data });
    } catch {
      setDetail(null);
    }
  }

  if (reviews.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-border bg-surface-elevated p-6 text-sm leading-6 text-muted">
        Todavía no escribiste ninguna. Podés hacerlo desde el detalle de
        cualquier película.
      </p>
    );
  }

  return (
    <>
      {/* Above the list, like the reviews under a movie: pressing a page must
        * not move the control out from under the pointer. */}
      {totalPages > 1 ? (
        <div className="mt-4 flex justify-end">
          <Pagination
            hasNextPage={page < totalPages}
            label="Paginación de mis reseñas"
            onPageChange={setPage}
            page={page}
            totalPages={totalPages}
          />
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {visible.map((review) => (
          <li key={review.id}>
            <button
              aria-label={`Ver ${review.movie.title}`}
              className="flex w-full cursor-pointer gap-4 rounded-xl border border-border bg-surface-elevated p-4 text-left transition-colors duration-fast ease-ui hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void openMovie(review.movie.id)}
              type="button"
            >
              <MovieArtwork
                className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg border border-border"
                movie={review.movie}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="min-w-0 truncate font-display text-base font-semibold text-foreground">
                    {review.movie.title}
                  </p>
                  <ReviewVerdictLabel verdict={review.verdict} />
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {review.title}
                </p>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted">
                  {review.description}
                </p>
                <p className="mt-2 font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground">
                  {DATE_FORMATTER.format(new Date(review.createdAt))}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {detail ? (
          <MovieDetailScreen
            key={detail.pageData.movie.id}
            onClose={() => setDetail(null)}
            pageData={detail.pageData}
            publicReviews={detail.publicReviews}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
