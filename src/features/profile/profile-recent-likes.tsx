"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";

import type { LikedMovieItem } from "@/contracts/likes";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { Review } from "@/contracts/reviews";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { MovieDetailScreen } from "@/features/movie-detail/movie-detail-screen";
import { fetchMovieReviews } from "@/features/reviews/review-client";

interface ProfileRecentLikesProps {
  items: LikedMovieItem[];
}

/** The profile was avatar, chips, three numbers and text -- not one poster, in
 * an app about films. These are the last few, as a door into the library
 * rather than a second copy of it. */
export function ProfileRecentLikes({ items }: ProfileRecentLikesProps) {
  const [detail, setDetail] = useState<{
    pageData: MovieDetailPageData;
    publicReviews: Review[];
  } | null>(null);

  async function openMovie(movieId: number): Promise<void> {
    try {
      const [pageData, reviews] = await Promise.all([
        fetchMovieDetail(movieId),
        fetchMovieReviews(movieId),
      ]);

      setDetail({ pageData, publicReviews: reviews.data });
    } catch {
      setDetail(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-border bg-surface-elevated p-6 text-sm leading-6 text-muted">
        Todavía no marcaste ninguna con me gusta. Las que elijas en Descubrir
        aparecen acá.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
        {items.map((item) => (
          <li className="min-w-0" key={item.movie.id}>
            <button
              aria-label={`Ver ${item.movie.title}`}
              className="group block w-full cursor-pointer focus-visible:outline-none"
              onClick={() => void openMovie(item.movie.id)}
              type="button"
            >
              <MovieArtwork
                className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-border transition-[border-color] duration-fast ease-ui group-hover:border-primary/60 group-focus-visible:border-primary"
                movie={item.movie}
              />
              <p className="mt-2 line-clamp-2 text-xs leading-4 text-muted transition-colors duration-fast ease-ui group-hover:text-foreground">
                {item.movie.title}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <Link
        className="mt-4 inline-flex text-sm font-medium text-primary transition-colors duration-fast ease-ui hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/liked"
      >
        Ver toda la biblioteca
      </Link>

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
