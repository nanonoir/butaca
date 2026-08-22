"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";

import type { LikedMovieItem, LikesWatchedFilter } from "@/contracts/likes";
import type { ViewerMovieState } from "@/contracts/interactions";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { PageHeader } from "@/components/shared/page-header";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { Review } from "@/contracts/reviews";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { fetchMovieReviews } from "@/features/reviews/review-client";
import { MovieDetailScreen } from "@/features/movie-detail/movie-detail-screen";

const FILTER_OPTIONS: readonly {
  value: LikesWatchedFilter;
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: "watched", label: "Vistas" },
  { value: "unwatched", label: "No vistas" },
];

interface LikedMoviesScreenProps {
  items: LikedMovieItem[];
}

interface PosterPlaceholderProps {
  title: string;
  watched: boolean;
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.25"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function OverflowGlyph() {
  return (
    <span
      aria-hidden="true"
      className="mb-1 inline-flex h-5 items-center text-muted-foreground"
    >
      <svg className="h-4 w-6" viewBox="0 0 24 16" fill="currentColor">
        <circle cx="5" cy="8" r="1.25" />
        <circle cx="12" cy="8" r="1.25" />
        <circle cx="19" cy="8" r="1.25" />
      </svg>
    </span>
  );
}

function PosterPlaceholder({ title, watched }: PosterPlaceholderProps) {
  return (
    <div className="relative size-full">
      <div
        aria-label={`Póster de ${title}`}
        className="size-full bg-surface-muted"
        role="img"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0, transparent 12px, var(--border) 12px, var(--border) 13px)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-transparent transition-colors duration-fast ease-ui group-hover:bg-primary/5"
        data-liked-poster-hover
      />
      {watched ? (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-primary shadow-floating backdrop-blur-sm">
          <EyeIcon />
          Vista
        </span>
      ) : null}
      <span className="absolute bottom-3 left-3 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        Póster
      </span>
    </div>
  );
}

function getVisibleItems(items: LikedMovieItem[], filter: LikesWatchedFilter) {
  if (filter === "all") {
    return items;
  }

  return items.filter((item) =>
    filter === "watched" ? item.watchedAt !== null : item.watchedAt === null,
  );
}

function getMovieCountLabel(count: number) {
  return `${count} ${count === 1 ? "película" : "películas"}`;
}

export function LikedMoviesScreen({ items }: LikedMoviesScreenProps) {
  const [activeFilter, setActiveFilter] = useState<LikesWatchedFilter>("all");
  const [likedItems, setLikedItems] = useState(items);
  const [selectedItem, setSelectedItem] = useState<LikedMovieItem | null>(null);
  const [detailExperience, setDetailExperience] = useState<{
    pageData: MovieDetailPageData;
    publicReviews: Review[];
  } | null>(null);
  const visibleItems = getVisibleItems(likedItems, activeFilter);

  /** The overlay loads on demand: the list only carries a summary per movie,
   * and the detail plus its community reviews are two separate endpoints. */
  async function handleSelectItem(item: LikedMovieItem): Promise<void> {
    setSelectedItem(item);
    setDetailExperience(null);

    try {
      const [pageData, reviews] = await Promise.all([
        fetchMovieDetail(item.movie.id),
        fetchMovieReviews(item.movie.id),
      ]);

      setDetailExperience({ pageData, publicReviews: reviews.data });
    } catch {
      setSelectedItem(null);
    }
  }

  function handleDetailClose(viewerState: ViewerMovieState) {
    if (!selectedItem) {
      return;
    }

    const selectedMovieId = selectedItem.movie.id;
    setLikedItems((currentItems) =>
      viewerState.reaction === "LIKE"
        ? currentItems.map((item) =>
            item.movie.id === selectedMovieId
              ? { ...item, watchedAt: viewerState.watchedAt }
              : item,
          )
        : currentItems.filter((item) => item.movie.id !== selectedMovieId),
    );
    setSelectedItem(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 py-4 md:py-8">
      <PageHeader
        eyebrow="Tu biblioteca"
        title="Mis películas"
        action={
          <p
            aria-live="polite"
            className="font-mono text-xs tracking-[0.08em] text-muted"
          >
            {getMovieCountLabel(visibleItems.length)}
          </p>
        }
      />

      <section aria-labelledby="liked-movies-title" className="space-y-7">
        <h2 id="liked-movies-title" className="sr-only">
          Películas guardadas
        </h2>
        <div
          aria-label="Filtrar películas"
          className="flex flex-wrap gap-3"
          role="group"
        >
          {FILTER_OPTIONS.map((option) => {
            const active = activeFilter === option.value;

            return (
              <Button
                key={option.value}
                aria-pressed={active}
                className="rounded-full px-5"
                onClick={() => setActiveFilter(option.value)}
                variant={
                  active ? BUTTON_VARIANT.PRIMARY : BUTTON_VARIANT.OUTLINE
                }
              >
                {option.label}
              </Button>
            );
          })}
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visibleItems.map((item) => {
            const watched = item.watchedAt !== null;
            const year = item.movie.releaseDate?.slice(0, 4);

            return (
              <li
                key={item.movie.id}
                className="min-w-0 [&>article>button:hover]:bg-transparent!"
              >
                <MoviePosterCard
                  actionLabel={`Ver detalle de ${item.movie.title}`}
                  onSelect={() => void handleSelectItem(item)}
                  title={item.movie.title}
                  year={year}
                  poster={
                    <PosterPlaceholder
                      title={item.movie.title}
                      watched={watched}
                    />
                  }
                  metadataSlot={<OverflowGlyph />}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <AnimatePresence>
        {detailExperience && selectedItem ? (
          <MovieDetailScreen
            key={detailExperience.pageData.movie.id}
            onClose={handleDetailClose}
            // The viewer state now comes from the server with the rest of the
            // page instead of being inferred from the list row.
            pageData={detailExperience.pageData}
            publicReviews={detailExperience.publicReviews}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
