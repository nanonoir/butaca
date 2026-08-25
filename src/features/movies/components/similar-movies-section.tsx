"use client";

import { useEffect, useRef, useState } from "react";

import type { MovieSummary, PaginationMeta } from "@/contracts";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { StepPagination } from "./step-pagination";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import { fetchSimilarMovies } from "@/features/movies/movie-catalog-client";

/** Similar movies arrive a provider page at a time but are shown three at a
 * time, so pages are accumulated and the window walks through them. */
const SIMILAR_WINDOW_SIZE = 3;

interface SimilarMovieResults {
  data: MovieSummary[];
  meta: PaginationMeta;
}

interface SimilarMoviesSectionProps {
  movieId: number;
  onSelectMovie: (movie: MovieSummary) => Promise<void>;
}

function getMovieYear(movie: MovieSummary) {
  return movie.releaseDate?.slice(0, 4);
}

function SimilarMoviesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="animate-pulse" key={index}>
          <div className="aspect-[2/3] rounded-lg bg-surface-muted" />
          <div className="mt-3 h-5 w-4/5 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export function SimilarMoviesSection({
  movieId,
  onSelectMovie,
}: SimilarMoviesSectionProps) {
  const [results, setResults] = useState<SimilarMovieResults | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const requestId = useRef(0);

  /** `append` distinguishes loading the first page from pulling another one in
   * behind the window; a retry replaces, continuing accumulates. */
  function loadSimilarMovies(page: number, append = false) {
    const currentRequestId = ++requestId.current;
    setIsLoading(true);
    setHasError(false);

    void fetchSimilarMovies(movieId, page)
      .then(
        (response) => {
          if (currentRequestId !== requestId.current) {
            return;
          }

          const movies = response.data.filter((movie) => movie.id !== movieId);

          setResults((current) => ({
            ...response,
            data: append && current ? [...current.data, ...movies] : movies,
          }));

          if (append) {
            setWindowStart((start) => start + SIMILAR_WINDOW_SIZE);
          } else {
            setWindowStart(0);
          }
        },
        () => {
          if (currentRequestId === requestId.current) {
            setHasError(true);
          }
        },
      )
      .finally(() => {
        if (currentRequestId === requestId.current) {
          setIsLoading(false);
        }
      });
  }

  useEffect(() => {
    const currentRequestId = ++requestId.current;

    void fetchSimilarMovies(movieId, 1)
      .then(
        (response) => {
          if (currentRequestId !== requestId.current) {
            return;
          }

          setResults({
            ...response,
            data: response.data.filter((movie) => movie.id !== movieId),
          });
          setWindowStart(0);
        },
        () => {
          if (currentRequestId === requestId.current) {
            setHasError(true);
          }
        },
      )
      .finally(() => {
        if (currentRequestId === requestId.current) {
          setIsLoading(false);
        }
      });

    return () => {
      requestId.current += 1;
    };
  }, [movieId]);

  async function handleSelectMovie(movie: MovieSummary) {
    setIsNavigating(true);

    try {
      await onSelectMovie(movie);
    } catch {
      setHasError(true);
    } finally {
      setIsNavigating(false);
    }
  }

  const loadedMovies = results?.data ?? [];
  const visibleMovies = loadedMovies.slice(
    windowStart,
    windowStart + SIMILAR_WINDOW_SIZE,
  );
  const hasMoreLoaded = windowStart + SIMILAR_WINDOW_SIZE < loadedMovies.length;
  const canContinue = hasMoreLoaded || (results?.meta.hasNextPage ?? false);
  const canGoBack = windowStart > 0;
  /** Counted in windows of three, not in provider pages: it is the number the
   * viewer is actually stepping through. No total is shown because TMDB's
   * count for similar movies is not a meaningful one. */
  const windowPage = Math.floor(windowStart / SIMILAR_WINDOW_SIZE) + 1;

  function showPreviousSimilarMovies() {
    setWindowStart((start) => Math.max(0, start - SIMILAR_WINDOW_SIZE));
  }

  /** Walks the window forward, pulling the next provider page only once the
   * loaded ones are exhausted. */
  function showNextSimilarMovies() {
    if (hasMoreLoaded) {
      setWindowStart((start) => start + SIMILAR_WINDOW_SIZE);
      return;
    }

    if (results?.meta.hasNextPage) {
      loadSimilarMovies(results.meta.page + 1, true);
    }
  }

  return (
    <section aria-labelledby="similar-movies-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
            id="similar-movies-heading"
          >
            Películas similares
          </h2>
        </div>
        {(isLoading || isNavigating) && results ? (
          <p aria-live="polite" className="text-sm text-muted" role="status">
            {isNavigating ? "Abriendo película…" : "Actualizando resultados…"}
          </p>
        ) : null}
      </div>

      {hasError ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted p-4">
          <p className="text-sm text-foreground" role="alert">
            No pudimos cargar películas similares. Intentá de nuevo.
          </p>
          <Button
            disabled={isLoading || isNavigating}
            onClick={() => loadSimilarMovies(results?.meta.page ?? 1)}
            variant={BUTTON_VARIANT.OUTLINE}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {!results && isLoading ? <SimilarMoviesSkeleton /> : null}

      {results && visibleMovies.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted p-5 text-sm leading-6 text-muted">
          No encontramos películas similares por ahora.
        </p>
      ) : null}

      {visibleMovies.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
          {visibleMovies.map((movie) => (
            <li key={movie.id}>
              <MoviePosterCard
                actionLabel={`Ver detalle de ${movie.title}`}
                onSelect={() => void handleSelectMovie(movie)}
                poster={<MovieArtwork className="size-full" movie={movie} />}
                title={movie.title}
                year={getMovieYear(movie)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {results && loadedMovies.length > 0 ? (
        <StepPagination
          disabled={isLoading || isNavigating}
          hasNextPage={canContinue}
          hasPreviousPage={canGoBack}
          label="Paginación de películas similares"
          onNext={showNextSimilarMovies}
          onPrevious={showPreviousSimilarMovies}
          page={windowPage}
        />
      ) : null}
    </section>
  );
}
