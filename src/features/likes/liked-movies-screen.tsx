"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";

import type { PaginationMeta } from "@/contracts/common";
import type { LikedMovieItem, LikesWatchedFilter } from "@/contracts/likes";
import type { MovieSummary } from "@/contracts/movies";
import type { ViewerMovieState } from "@/contracts/interactions";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { PageHeader } from "@/components/shared/page-header";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { Review } from "@/contracts/reviews";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { fetchMovieReviews } from "@/features/reviews/review-client";
import { MovieDetailScreen } from "@/features/movie-detail/movie-detail-screen";
import { Pagination } from "@/features/movies/components/pagination";

const FILTER_OPTIONS: readonly {
  value: LikesWatchedFilter;
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: "watched", label: "Vistas" },
  { value: "unwatched", label: "No vistas" },
];

const EMPTY_STATES: Record<
  LikesWatchedFilter,
  { title: string; hint: string }
> = {
  all: {
    title: "Tu biblioteca está vacía",
    hint: "Las películas que marques con me gusta aparecen acá.",
  },
  watched: {
    title: "Todavía no marcaste ninguna como vista",
    hint: "Podés marcarlas desde el detalle de cada película.",
  },
  unwatched: {
    title: "Ya viste todas las que guardaste",
    hint: "No te queda ninguna pendiente en la biblioteca.",
  },
};

/** A movie edited from the detail overlay while the page is open. Kept beside
 * `items` instead of copied over them: the list is server rendered per page, so
 * a copy taken on mount would survive into the next page and freeze it. */
type LocalEdit =
  | { removed: true }
  | { removed: false; watchedAt: string | null };

interface LikedMoviesScreenProps {
  items: LikedMovieItem[];
  meta: PaginationMeta;
  watched: LikesWatchedFilter;
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

interface LikedPosterProps {
  movie: MovieSummary;
  watched: boolean;
}

/** Was a hand drawn placeholder from the fixture era, when liked movies had no
 * poster path. The list carries real artwork now. */
function LikedPoster({ movie, watched }: LikedPosterProps) {
  return (
    <div className="relative size-full">
      <MovieArtwork className="size-full" movie={movie} />
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
    </div>
  );
}

function applyLocalEdits(
  items: LikedMovieItem[],
  edits: ReadonlyMap<number, LocalEdit>,
): LikedMovieItem[] {
  return items.flatMap((item) => {
    const edit = edits.get(item.movie.id);

    if (!edit) {
      return [item];
    }

    return edit.removed ? [] : [{ ...item, watchedAt: edit.watchedAt }];
  });
}

/** The library spans more than one page, so the URL carries which slice the
 * viewer is on. Defaults stay out of it to keep `/liked` clean. */
function buildLikedHref(page: number, watched: LikesWatchedFilter) {
  const params = new URLSearchParams();

  if (watched !== "all") {
    params.set("watched", watched);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/liked?${query}` : "/liked";
}

function getMovieCountLabel(count: number) {
  return `${count} ${count === 1 ? "película" : "películas"}`;
}

export function LikedMoviesScreen({
  items,
  meta,
  watched,
}: LikedMoviesScreenProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [edits, setEdits] = useState<ReadonlyMap<number, LocalEdit>>(
    () => new Map(),
  );
  const [selectedItem, setSelectedItem] = useState<LikedMovieItem | null>(null);
  const [detailExperience, setDetailExperience] = useState<{
    pageData: MovieDetailPageData;
    publicReviews: Review[];
  } | null>(null);
  const visibleItems = applyLocalEdits(items, edits);
  // Only movies unliked on this very page are missing from the server count:
  // once the viewer moves on, the next query already leaves them out.
  const totalResults = meta.totalResults - (items.length - visibleItems.length);
  const emptyState = EMPTY_STATES[watched];

  function goTo(page: number, nextWatched: LikesWatchedFilter) {
    startNavigation(() => {
      router.push(buildLikedHref(page, nextWatched));
    });
  }

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
    setEdits((currentEdits) => {
      const nextEdits = new Map(currentEdits);

      nextEdits.set(
        selectedMovieId,
        viewerState.reaction === "LIKE"
          ? { removed: false, watchedAt: viewerState.watchedAt }
          : { removed: true },
      );

      return nextEdits;
    });
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
            {getMovieCountLabel(totalResults)}
            {meta.totalPages > 1
              ? ` · Página ${meta.page} de ${meta.totalPages}`
              : null}
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
            const active = watched === option.value;

            return (
              <Button
                key={option.value}
                aria-pressed={active}
                className="rounded-full px-5"
                disabled={isNavigating}
                // A filter changes how many movies there are, so it lands back
                // on the first page instead of an offset that may not exist
                // under the new count.
                onClick={() => goTo(1, option.value)}
                variant={
                  active ? BUTTON_VARIANT.PRIMARY : BUTTON_VARIANT.OUTLINE
                }
              >
                {option.label}
              </Button>
            );
          })}
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-muted p-8 text-center">
            <h3 className="font-display text-xl font-semibold text-foreground">
              {emptyState.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {emptyState.hint}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
            {visibleItems.map((item) => {
              const watchedMovie = item.watchedAt !== null;
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
                      <LikedPoster movie={item.movie} watched={watchedMovie} />
                    }
                    metadataSlot={<OverflowGlyph />}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          disabled={isNavigating}
          hasNextPage={meta.hasNextPage}
          onPageChange={(page) => goTo(page, watched)}
          page={meta.page}
          totalPages={meta.totalPages}
        />
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
