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
import { Input } from "@/components/ui/input";
import {
  removeMovieReaction,
  setMovieWatched,
} from "@/features/interactions/interaction-client";

import { LikedMovieMenu } from "./liked-movie-menu";
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
  search?: string;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="10.75" cy="10.75" r="5.75" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 15.5 3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m6.5 6.5 11 11m0-11-11 11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
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

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m-7 0 .8 11.1A2 2 0 0 0 9.8 20h4.4a2 2 0 0 0 2-1.9L17 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 11v5m0-8.2v.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
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
function buildLikedHref(
  page: number,
  watched: LikesWatchedFilter,
  search?: string,
) {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

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
  search,
}: LikedMoviesScreenProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // Open when a search is already running, so a reload or a shared link lands
  // on the box that produced what is on screen rather than hiding it.
  const [searchOpen, setSearchOpen] = useState(Boolean(search));
  const [draft, setDraft] = useState(search ?? "");
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
  const emptyState = search
    ? {
        title: `Nada en tu biblioteca para "${search}"`,
        hint: "Buscá otro título, o quitá la búsqueda para ver todo de nuevo.",
      }
    : EMPTY_STATES[watched];

  /** Every caller states the term. A default of `search` would have made
   * clearing impossible: passing undefined to a defaulted parameter is what
   * asks for the default, so "limpiar búsqueda" kept the term it was clearing. */
  function goTo(
    page: number,
    nextWatched: LikesWatchedFilter,
    nextSearch: string | undefined,
  ) {
    startNavigation(() => {
      router.push(buildLikedHref(page, nextWatched, nextSearch));
    });
  }

  /** A different term is a different library, so it starts at the first page
   * rather than at an offset that belonged to the previous one. */
  function submitSearch() {
    const term = draft.trim();

    goTo(1, watched, term || undefined);
  }

  function clearSearch() {
    setDraft("");
    goTo(1, watched, undefined);
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

  /** The card writes straight through now, rather than only reflecting what the
   * detail overlay did on its way out. The local edit lands first so the tile
   * reacts on the press, and a write the server refuses puts it back. */
  async function handleToggleWatched(item: LikedMovieItem): Promise<void> {
    const movieId = item.movie.id;
    const watched = item.watchedAt === null;
    const previous = item.watchedAt;

    setEdits((current) =>
      new Map(current).set(movieId, {
        removed: false,
        watchedAt: watched ? new Date().toISOString() : null,
      }),
    );

    try {
      await setMovieWatched(movieId, watched);
    } catch {
      setEdits((current) =>
        new Map(current).set(movieId, { removed: false, watchedAt: previous }),
      );
    }
  }

  async function handleRemoveLike(item: LikedMovieItem): Promise<void> {
    const movieId = item.movie.id;

    setEdits((current) => new Map(current).set(movieId, { removed: true }));

    try {
      await removeMovieReaction(movieId);
    } catch {
      setEdits((current) => {
        const next = new Map(current);
        next.delete(movieId);

        return next;
      });
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
          <div className="flex flex-wrap items-center gap-3">
            <Button
              aria-controls="liked-search-panel"
              aria-expanded={searchOpen}
              aria-label={
                searchOpen
                  ? "Cerrar buscador de la biblioteca"
                  : "Abrir buscador de la biblioteca"
              }
              className="rounded-full border-primary/25 bg-primary/5 px-4 text-primary hover:border-primary/45 hover:bg-primary/10 aria-expanded:border-primary/45 aria-expanded:bg-primary/15"
              onClick={() => setSearchOpen((open) => !open)}
              variant={BUTTON_VARIANT.OUTLINE}
            >
              <SearchIcon className="size-4" />
              Buscar
            </Button>
            <p
              aria-live="polite"
              className="font-mono text-xs tracking-[0.08em] text-muted"
            >
            {getMovieCountLabel(totalResults)}
              {meta.totalPages > 1
                ? ` · Página ${meta.page} de ${meta.totalPages}`
                : null}
            </p>
          </div>
        }
      />

      {searchOpen ? (
        <form
          aria-label="Búsqueda en la biblioteca"
          className="rounded-xl border border-border bg-surface-elevated/75 p-4 shadow-floating backdrop-blur-sm"
          id="liked-search-panel"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
          role="search"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <label
              className="text-sm font-semibold text-foreground"
              htmlFor="liked-search-input"
            >
              Buscar en mis películas
            </label>
            <Button
              aria-label="Cerrar búsqueda"
              className="rounded-full text-muted hover:text-foreground"
              onClick={() => setSearchOpen(false)}
              variant={BUTTON_VARIANT.ICON}
            >
              <CrossIcon className="size-5" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <Input
              aria-describedby="liked-search-helper"
              autoFocus
              id="liked-search-input"
              maxLength={80}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escribí un título"
              value={draft}
            />
            <Button
              className="w-full sm:w-auto sm:min-w-28"
              disabled={isNavigating}
              type="submit"
            >
              <SearchIcon className="size-4" />
              Buscar
            </Button>
          </div>

          <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" id="liked-search-helper">
              Busca solamente entre las películas que ya guardaste.
            </p>
            {search ? (
              <Button
                onClick={clearSearch}
                variant={BUTTON_VARIANT.OUTLINE}
              >
                Limpiar búsqueda
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

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
                onClick={() => goTo(1, option.value, search)}
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
                <li className="min-w-0" key={item.movie.id}>
                  <MoviePosterCard
                    actionLabel={`Ver detalle de ${item.movie.title}`}
                    onSelect={() => void handleSelectItem(item)}
                    title={item.movie.title}
                    year={year}
                    poster={
                      <LikedPoster movie={item.movie} watched={watchedMovie} />
                    }
                    metadataSlot={
                      <LikedMovieMenu
                        actions={[
                          {
                            id: "watched",
                            label: watchedMovie
                              ? "Marcar como no vista"
                              : "Marcar como vista",
                            icon: <EyeIcon />,
                            onSelect: () => void handleToggleWatched(item),
                          },
                          {
                            id: "remove",
                            label: "Quitar de me gusta",
                            icon: <TrashIcon />,
                            onSelect: () => void handleRemoveLike(item),
                          },
                          {
                            id: "detail",
                            label: "Ver detalles",
                            icon: <InfoIcon />,
                            onSelect: () => void handleSelectItem(item),
                          },
                        ]}
                        title={item.movie.title}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          disabled={isNavigating}
          hasNextPage={meta.hasNextPage}
          onPageChange={(page) => goTo(page, watched, search)}
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
