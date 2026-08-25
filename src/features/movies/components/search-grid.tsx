import { useEffect, useRef } from "react";

import type { MovieSummary, PaginationMeta } from "@/contracts";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";

import { Pagination } from "./pagination";

export interface SearchResults {
  data: MovieSummary[];
  meta: PaginationMeta;
}

interface SearchGridProps {
  query?: string;
  heading?: string;
  errorMessage?: string;
  results: SearchResults | null;
  isLoading: boolean;
  error: boolean;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSelectMovie: (movie: MovieSummary) => void;
  /** Given, each tile is a link to the film rather than a button that reports
   * a pick. Onboarding picks; searching navigates. */
  movieHref?: (movie: MovieSummary) => string;
  selectedMovieIds?: ReadonlySet<number>;
  selectedActionLabel?: (movie: MovieSummary, selected: boolean) => string;
}

function getMovieYear(movie: MovieSummary) {
  return movie.releaseDate?.slice(0, 4);
}

function SearchGridSkeleton() {
  return (
    <div
      aria-label="Cargando resultados"
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <div className="animate-pulse" key={index}>
          <div className="aspect-[2/3] rounded-lg bg-surface-muted" />
          <div className="mt-3 h-5 w-4/5 rounded bg-surface-muted" />
          <div className="mt-2 h-4 w-1/3 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function SearchGrid({
  query,
  heading,
  errorMessage = "No pudimos buscar películas. Intentá de nuevo.",
  results,
  isLoading,
  error,
  onPageChange,
  onRetry,
  onSelectMovie,
  movieHref,
  selectedMovieIds,
  selectedActionLabel,
}: SearchGridProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const page = results?.meta.page ?? 1;
  const headingText = heading ?? `Resultados para “${query ?? ""}”`;

  useEffect(() => {
    headingRef.current?.focus();
  }, [headingText, page]);

  return (
    <section aria-labelledby="search-results-heading" className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl"
            id="search-results-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            {headingText}
          </h2>
          {results ? (
            <p className="mt-2 text-sm text-muted">
              {results.meta.totalResults} resultados · Página{" "}
              {results.meta.page} de {results.meta.totalPages || 1}
            </p>
          ) : null}
        </div>
        {isLoading && results ? (
          <p aria-live="polite" className="text-sm text-muted" role="status">
            Actualizando resultados…
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted p-4">
          <p className="text-sm text-foreground" role="alert">
            {errorMessage}
          </p>
          <Button onClick={onRetry} variant={BUTTON_VARIANT.OUTLINE}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {!results && isLoading ? <SearchGridSkeleton /> : null}

      {results && results.data.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-muted p-8 text-center">
          <h3 className="font-display text-xl font-semibold text-foreground">
            No encontramos películas
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Probá con otro título o una búsqueda más corta.
          </p>
        </div>
      ) : null}

      {results && results.data.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
          {results.data.map((movie) => (
            <li key={movie.id}>
              <MoviePosterCard
                actionLabel={
                  selectedActionLabel?.(
                    movie,
                    selectedMovieIds?.has(movie.id) ?? false,
                  ) ?? `Ver detalle de ${movie.title}`
                }
                href={movieHref?.(movie)}
                onSelect={() => onSelectMovie(movie)}
                pressed={selectedMovieIds?.has(movie.id)}
                poster={<MovieArtwork className="size-full" movie={movie} />}
                title={movie.title}
                year={getMovieYear(movie)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {results ? (
        <Pagination
          disabled={isLoading}
          hasNextPage={results.meta.hasNextPage}
          onPageChange={onPageChange}
          page={results.meta.page}
          totalPages={results.meta.totalPages}
        />
      ) : null}
    </section>
  );
}
