"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";

import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { Review } from "@/contracts/reviews";

import { MovieDetailScreen } from "./movie-detail-screen";

interface MovieDetailPageScreenProps {
  pageData: MovieDetailPageData;
  publicReviews: Review[];
}

/** The detail on its own address rather than over a list.
 *
 * Closing goes back, which is what somebody who arrived by pressing a card
 * means by it. Arriving by pasting a link there is nothing behind, so it falls
 * to Discover instead of leaving the press doing nothing. */
export function MovieDetailPageScreen({
  pageData,
  publicReviews,
}: MovieDetailPageScreenProps) {
  const router = useRouter();

  function handleClose() {
    if (window.history.length > 1) {
      router.back();
      // The list underneath was rendered before anything here was pressed, so
      // a like given in the overlay would not show on it otherwise.
      router.refresh();

      return;
    }

    router.replace("/");
  }

  return (
    <AnimatePresence>
      <MovieDetailScreen
        key={pageData.movie.id}
        onClose={handleClose}
        pageData={pageData}
        publicReviews={publicReviews}
      />
    </AnimatePresence>
  );
}
