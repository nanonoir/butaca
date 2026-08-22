"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Genre, MovieSummary } from "@/contracts";
import { ApiClientError } from "@/lib/api/client";
import { SearchGrid } from "@/features/movies/components/search-grid";
import {
  fetchMovieGenres,
  fetchSearchMovies,
} from "@/features/movies/movie-catalog-client";
import { useMovieSearch } from "@/features/movies/hooks/use-movie-search";

import { completeOnboarding } from "./onboarding-client";

const MIN_GENRES = 2;
const MIN_MOVIES = 3;
const MAX_SELECTIONS = 8;

function isTransient(error: unknown) {
  return (
    error instanceof ApiClientError &&
    (error.code === "INTERNAL_ERROR" || error.code === "TMDB_UNAVAILABLE")
  );
}

function selectionStatus(selected: number, minimum: number, noun: string) {
  return `${selected} de ${MAX_SELECTIONS} ${noun} seleccionados. Selecciona al menos ${minimum}.`;
}

export function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"genres" | "movies">("genres");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genreError, setGenreError] = useState(false);
  const [isLoadingGenres, setIsLoadingGenres] = useState(true);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<MovieSummary[]>([]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const moviesHeading = useRef<HTMLHeadingElement | null>(null);
  const movieSearch = useMovieSearch(fetchSearchMovies);
  const selectedMovieIds = new Set(selectedMovies.map((movie) => movie.id));

  function loadGenres() {
    setIsLoadingGenres(true);
    setGenreError(false);
    void fetchMovieGenres().then(
      (nextGenres) => setGenres(nextGenres),
      () => setGenreError(true),
    ).finally(() => setIsLoadingGenres(false));
  }

  useEffect(() => {
    void fetchMovieGenres().then(
      (nextGenres) => setGenres(nextGenres),
      () => setGenreError(true),
    ).finally(() => setIsLoadingGenres(false));
  }, []);

  useEffect(() => {
    if (step === "movies") {
      moviesHeading.current?.focus();
    }
  }, [step]);

  function toggleGenre(id: number) {
    setSelectedGenreIds((current) => {
      if (current.includes(id)) {
        return current.filter((selectedId) => selectedId !== id);
      }

      return current.length === MAX_SELECTIONS ? current : [...current, id];
    });
  }

  function toggleMovie(movie: MovieSummary) {
    setSelectedMovies((current) => {
      if (current.some(({ id }) => id === movie.id)) {
        return current.filter(({ id }) => id !== movie.id);
      }

      return current.length === MAX_SELECTIONS ? current : [...current, movie];
    });
  }

  async function submit(attempt = 0): Promise<void> {
    if (submitting.current) {
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await completeOnboarding({
        preferredGenreIds: selectedGenreIds,
        likedMovieIds: selectedMovies.map((movie) => movie.id),
      });
      router.replace("/");
    } catch (error) {
      if (attempt === 0 && isTransient(error)) {
        submitting.current = false;
        return submit(1);
      }

      setSubmissionError(
        isTransient(error)
          ? "No pudimos completar tu perfil. Conservamos tus selecciones para que reintentes."
          : "Revisa tus selecciones e intenta nuevamente.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 py-2 md:py-4">
      <PageHeader
        eyebrow="Tu perfil"
        title="Afinemos tus recomendaciones"
        action={<span className="font-mono text-xs text-primary">Paso {step === "genres" ? "1" : "2"} de 2</span>}
      />

      {step === "genres" ? (
        <section aria-labelledby="genres-heading" className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground" id="genres-heading">
              Elegí tus géneros favoritos
            </h2>
            <p aria-live="polite" className="mt-2 text-sm text-muted" role="status">
              {selectionStatus(selectedGenreIds.length, MIN_GENRES, "géneros")}
            </p>
          </div>
          {isLoadingGenres ? <p role="status">Cargando géneros…</p> : null}
          {genreError ? (
            <div className="rounded-lg border border-border bg-surface-muted p-4" role="alert">
              <p>No pudimos cargar los géneros.</p>
              <Button className="mt-3" onClick={loadGenres} variant={BUTTON_VARIANT.OUTLINE}>Reintentar</Button>
            </div>
          ) : null}
          {!isLoadingGenres && !genreError ? (
            <div className="flex flex-wrap gap-3" role="group" aria-label="Géneros disponibles">
              {genres.map((genre) => {
                const selected = selectedGenreIds.includes(genre.id);
                const atLimit = selectedGenreIds.length === MAX_SELECTIONS;

                return (
                  <Button
                    aria-pressed={selected}
                    disabled={!selected && atLimit}
                    key={genre.id}
                    onClick={() => toggleGenre(genre.id)}
                    variant={selected ? undefined : BUTTON_VARIANT.OUTLINE}
                  >
                    {genre.name}
                  </Button>
                );
              })}
            </div>
          ) : null}
          <Button
            disabled={selectedGenreIds.length < MIN_GENRES}
            onClick={() => setStep("movies")}
          >
            Continuar con películas
          </Button>
        </section>
      ) : (
        <section aria-labelledby="movies-heading" className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground" id="movies-heading" ref={moviesHeading} tabIndex={-1}>
              Películas que ya viste y te gustaron
            </h2>
            <p aria-live="polite" className="mt-2 text-sm text-muted" role="status">
              {selectionStatus(selectedMovies.length, MIN_MOVIES, "películas")}
            </p>
          </div>
          <form aria-label="Búsqueda de películas para onboarding" className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); movieSearch.submit(); }} role="search">
            <div className="min-w-0 flex-1">
              <Input aria-describedby="onboarding-search-help" label="Buscar películas" onChange={(event) => movieSearch.setDraft(event.target.value)} value={movieSearch.draft} />
              <p className="mt-2 text-sm text-muted" id="onboarding-search-help">Buscá por título y presioná Enter para ver resultados.</p>
            </div>
            <div className="flex gap-3">
              <Button disabled={movieSearch.isLoading} type="submit">Buscar</Button>
              {movieSearch.submittedQuery ? <Button onClick={movieSearch.clear} type="button" variant={BUTTON_VARIANT.OUTLINE}>Limpiar búsqueda</Button> : null}
            </div>
          </form>
          {movieSearch.submittedQuery ? (
            <SearchGrid
              error={movieSearch.hasError}
              isLoading={movieSearch.isLoading}
              onPageChange={movieSearch.changePage}
              onRetry={movieSearch.retry}
              onSelectMovie={toggleMovie}
              query={movieSearch.submittedQuery}
              results={movieSearch.results}
              selectedActionLabel={(movie, selected) => `${selected ? "Quitar" : "Seleccionar"} ${movie.title}`}
              selectedMovieIds={selectedMovieIds}
            />
          ) : null}
          {selectedMovies.length > 0 ? (
            <div aria-label="Películas seleccionadas" className="flex flex-wrap gap-2">
              {selectedMovies.map((movie) => <Button key={movie.id} onClick={() => toggleMovie(movie)} variant={BUTTON_VARIANT.OUTLINE}>Quitar {movie.title}</Button>)}
            </div>
          ) : null}
          {submissionError ? <p role="alert" className="text-primary">{submissionError}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setStep("genres")} variant={BUTTON_VARIANT.OUTLINE}>Volver a géneros</Button>
            <Button disabled={selectedMovies.length < MIN_MOVIES || isSubmitting} onClick={() => void submit()}>{isSubmitting ? "Guardando…" : submissionError ? "Reintentar" : "Completar perfil"}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
