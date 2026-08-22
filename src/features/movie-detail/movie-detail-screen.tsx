"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { MovieArtwork } from "@/components/shared/movie-artwork";
import { Avatar } from "@/components/ui/avatar";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { MovieReaction, ViewerMovieState } from "@/contracts/interactions";
import type { MovieSummary } from "@/contracts/movies";
import type { Review, UpsertReviewRequest } from "@/contracts/reviews";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import {
  createMoviePersistence,
  type CreateMoviePersistence,
} from "@/features/movie-detail/movie-persistence";
import { SimilarMoviesSection } from "@/features/movies/components/similar-movies-section";
import { fetchMovieReviews } from "@/features/reviews/review-client";

import { MovieReviews, type ReviewEditorMode } from "./movie-reviews";

export type { MovieDetailPersistence } from "./movie-persistence";

interface MovieDetailScreenProps {
  pageData: MovieDetailPageData;
  publicReviews: Review[];
  onClose: (viewerState: ViewerMovieState) => void;
  /** Overridable only so tests can inject a double. Every screen persists by
   * default, which is what keeps a new call site from silently losing writes. */
  createPersistence?: CreateMoviePersistence;
}

interface ActiveDetail {
  pageData: MovieDetailPageData;
  publicReviews: Review[];
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m15 5-7 7 7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6.5 6.5 11 11m0-11-11 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M8.2 5.6v12.8L18.8 12 8.2 5.6Z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12 3 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.02 6.9 18.7l.97-5.68L3.75 9l5.7-.83L12 3Z" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M20.4 8.8c0 4.6-8.4 9.2-8.4 9.2S3.6 13.4 3.6 8.8A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 8.4 2.2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m7 7 10 10m0-10L7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeIcon({
  className,
  watched,
}: {
  className?: string;
  watched: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3.5 12s3.1-5.2 8.5-5.2 8.5 5.2 8.5 5.2-3.1 5.2-8.5 5.2S3.5 12 3.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      {!watched ? (
        <path
          d="m5 4 14 16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      ) : null}
    </svg>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatRuntime(runtime: number | null) {
  if (!runtime) {
    return null;
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes} min`;
}

function PersonalMovieState({
  reaction,
  watched,
  onClearReaction,
  onReactionChange,
  onWatchedChange,
}: {
  reaction: MovieReaction | null;
  watched: boolean;
  onClearReaction: () => void;
  onReactionChange: (reaction: MovieReaction) => void;
  onWatchedChange: (watched: boolean) => void;
}) {
  return (
    <section
      aria-labelledby="personal-state-heading"
      className="overflow-hidden rounded-xl border border-border bg-surface-elevated"
    >
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2
          className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
          id="personal-state-heading"
        >
          Tu estado
        </h2>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-sm font-medium text-foreground">Tu reacción</p>
        <div
          aria-label="Tu reacción"
          className="mt-3 grid grid-cols-2 gap-3"
          role="group"
        >
          {(
            [
              ["LIKE", "Me gusta", HeartIcon],
              ["DISLIKE", "No me gusta", CrossIcon],
            ] as const
          ).map(([value, label, Icon]) => {
            const selected = reaction === value;

            return (
              <Button
                aria-pressed={selected}
                className={`min-h-14 rounded-lg px-3 ${selected ? "border-primary bg-primary/12 text-primary hover:bg-primary/12" : "text-muted hover:border-primary hover:bg-transparent hover:text-primary"}`}
                key={value}
                onClick={() => onReactionChange(value)}
                variant={BUTTON_VARIANT.OUTLINE}
              >
                <Icon className="size-5" />
                {label}
              </Button>
            );
          })}
        </div>
        {reaction ? (
          <Button
            className="mt-2 w-full text-xs hover:bg-transparent hover:text-primary"
            onClick={onClearReaction}
            size={CONTROL_SIZE.SM}
            variant={BUTTON_VARIANT.GHOST}
          >
            Quitar reacción
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-base font-semibold text-foreground">
            ¿Ya la viste?
          </p>
          <p className="mt-1 text-sm text-muted">
            Independiente de tu reacción
          </p>
        </div>
        <Button
          className={`shrink-0 ${watched ? "border-primary bg-primary/12 text-primary hover:bg-primary/12" : "text-muted hover:border-primary hover:bg-transparent hover:text-primary"}`}
          onClick={() => onWatchedChange(!watched)}
          variant={BUTTON_VARIANT.OUTLINE}
        >
          <EyeIcon className="size-5" watched={watched} />
          {watched ? "Marcar no vista" : "Marcar vista"}
        </Button>
      </div>
    </section>
  );
}

function TrailerDialog({
  movieTitle,
  trailerKey,
  onClose,
}: {
  movieTitle: string;
  trailerKey: string;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-8"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.08 : 0.18 }}
    >
      <button
        aria-label="Cerrar overlay del trailer"
        className="absolute inset-0 size-full bg-overlay backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <motion.section
        aria-label={`Trailer de ${movieTitle}`}
        aria-modal="true"
        animate={{ transform: "translate3d(0, 0, 0) scale(1)" }}
        className="relative z-10 w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-floating"
        initial={
          shouldReduceMotion
            ? undefined
            : { transform: "translate3d(0, 0.75rem, 0) scale(0.98)" }
        }
        role="dialog"
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      >
        <Button
          aria-label="Cerrar trailer"
          autoFocus
          className="absolute right-3 top-3 z-10 rounded-full border border-border bg-background/85 text-foreground backdrop-blur-sm hover:bg-background"
          onClick={onClose}
          variant={BUTTON_VARIANT.ICON}
        >
          <CloseIcon className="size-5" />
        </Button>
        <div className="aspect-video bg-surface-muted">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="size-full border-0"
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?rel=0`}
            title={`Trailer de ${movieTitle}`}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}

export function MovieDetailScreen({
  pageData,
  publicReviews,
  onClose,
  createPersistence = createMoviePersistence,
}: MovieDetailScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeDetail, setActiveDetail] = useState<ActiveDetail>({
    pageData,
    publicReviews,
  });
  const [originalMovieId] = useState(pageData.movie.id);
  const [originalViewerState, setOriginalViewerState] =
    useState<ViewerMovieState>(pageData.viewerState);
  const { movie, reviewSummary } = activeDetail.pageData;
  const [viewerState, setViewerState] = useState<ViewerMovieState>(
    pageData.viewerState,
  );
  const [myReview, setMyReview] = useState<Review | null>(
    activeDetail.pageData.myReview,
  );
  const [editorMode, setEditorMode] = useState<ReviewEditorMode>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const year = movie.releaseDate?.slice(0, 4) ?? "Sin fecha";
  const runtime = formatRuntime(movie.runtime);
  const showOriginalTitle = movie.originalTitle !== movie.title;
  const reaction = viewerState.reaction;
  const watched = viewerState.watchedAt !== null;
  const isOriginalMovie = movie.id === originalMovieId;
  // Bound to the movie on screen, so browsing to a similar one keeps writing to
  // the right record instead of disabling itself.
  const activePersistence = useMemo(
    () => createPersistence(movie.id),
    [createPersistence, movie.id],
  );

  useEffect(() => {
    document
      .getElementById("movie-detail-dialog")
      ?.querySelector<HTMLButtonElement>('[aria-label="Cerrar detalle"]')
      ?.focus();
  }, [movie.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (trailerOpen) {
        setTrailerOpen(false);
      } else if (editorMode) {
        setEditorMode(null);
      } else {
        onClose(originalViewerState);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorMode, onClose, originalViewerState, trailerOpen]);

  /** Rolls the optimistic state back and reports it, so a rejected write never
   * leaves the screen showing something the database does not hold. */
  function persistViewerState(
    write: (() => Promise<unknown>) | null,
    previousState: ViewerMovieState,
    failureMessage: string,
  ) {
    if (!write) {
      return;
    }

    // Wrapped so a callback that throws synchronously cannot escape into the
    // click handler and take the screen down with it.
    void (async () => write())().catch(() => {
      setViewerState(previousState);
      setStatusMessage(failureMessage);
    });
  }

  function handleReactionChange(nextReaction: MovieReaction) {
    const previousState = viewerState;
    const nextState = { ...viewerState, reaction: nextReaction };

    setViewerState(nextState);
    if (isOriginalMovie) {
      setOriginalViewerState(nextState);
    }
    setStatusMessage(
      nextReaction === "LIKE" ? "Marcaste Me gusta" : "Marcaste No me gusta",
    );
    persistViewerState(
      () => activePersistence.setReaction(nextReaction),
      previousState,
      "No pudimos guardar tu reacción.",
    );
  }

  function handleClearReaction() {
    const previousState = viewerState;
    const nextState = { ...viewerState, reaction: null };

    setViewerState(nextState);
    if (isOriginalMovie) {
      setOriginalViewerState(nextState);
    }
    setStatusMessage("Eliminaste tu reacción. El estado Vista no cambió.");
    persistViewerState(
      () => activePersistence.clearReaction(),
      previousState,
      "No pudimos eliminar tu reacción.",
    );
  }

  function handleWatchedChange(nextWatched: boolean) {
    const previousState = viewerState;
    const nextState = {
      ...viewerState,
      watchedAt: nextWatched
        ? (viewerState.watchedAt ?? new Date().toISOString())
        : null,
    };

    setViewerState(nextState);
    if (isOriginalMovie) {
      setOriginalViewerState(nextState);
    }
    setStatusMessage(
      nextWatched
        ? "Marcaste la película como Vista"
        : "Marcaste la película como No vista",
    );
    persistViewerState(
      () => activePersistence.setWatched(nextWatched),
      previousState,
      "No pudimos guardar el estado Vista.",
    );
  }

  function handleSaveReview(draft: UpsertReviewRequest) {
    const savedMessage =
      editorMode === "edit" ? "Reseña actualizada" : "Reseña publicada";

    setEditorMode(null);

    // With persistence the stored review is awaited instead of guessed: the
    // author and identifiers belong to the server, not to this screen.
    {
      void (async () => activePersistence.saveReview(draft))().then(
        (savedReview) => {
          setMyReview(savedReview);
          setStatusMessage(savedMessage);
        },
        () => {
          setStatusMessage("No pudimos guardar tu reseña.");
        },
      );

      return;
    }

    const timestamp = new Date().toISOString();

    setMyReview((currentReview) => ({
      id: currentReview?.id ?? "20000000-0000-4000-8000-000000000001",
      movieId: movie.id,
      author: currentReview?.author ?? {
        displayName: activeDetail.pageData.myReview?.author.displayName ?? "Tú",
        avatarUrl: null,
      },
      ...draft,
      isMine: true,
      createdAt: currentReview?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }));
    setStatusMessage(savedMessage);
  }

  function handleDeleteReview() {
    const previousReview = myReview;

    setMyReview(null);
    setStatusMessage("Reseña eliminada");

    void (async () => activePersistence.deleteReview())().catch(() => {
      setMyReview(previousReview);
      setStatusMessage("No pudimos eliminar tu reseña.");
    });
  }

  async function handleSelectSimilarMovie(movieToOpen: MovieSummary) {
    const [nextPageData, reviews] = await Promise.all([
      fetchMovieDetail(movieToOpen.id),
      fetchMovieReviews(movieToOpen.id),
    ]);

    setActiveDetail({ pageData: nextPageData, publicReviews: reviews.data });
    setViewerState(nextPageData.viewerState);
    setMyReview(nextPageData.myReview);
    setEditorMode(null);
    setTrailerOpen(false);
    setStatusMessage(`Abriste ${nextPageData.movie.title}`);
  }

  return (
    <motion.section
      aria-label={`Detalle de ${movie.title}`}
      aria-modal="true"
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      id="movie-detail-dialog"
      role="dialog"
      transition={{ duration: shouldReduceMotion ? 0.08 : 0.2 }}
    >
      <p aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      <header className="relative min-h-[32rem] overflow-hidden sm:min-h-[38rem] lg:min-h-[42rem]">
        <MovieArtwork
          className="absolute inset-0 bg-[center_28%]"
          kind="backdrop"
          movie={movie}
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/20 via-background/25 to-background" />
        <div className="absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-background via-background/78 to-transparent" />

        <Button
          aria-label="Cerrar detalle"
          autoFocus
          className="absolute left-4 top-4 z-10 rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm hover:border-primary hover:bg-background/80 hover:text-primary sm:left-6 sm:top-6"
          onClick={() => onClose(originalViewerState)}
          variant={BUTTON_VARIANT.ICON}
        >
          <BackIcon className="size-5" />
        </Button>

        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-7xl items-end gap-5 px-4 pb-7 sm:gap-7 sm:px-8 lg:px-12">
          <MovieArtwork
            className="aspect-[2/3] w-28 shrink-0 rounded-lg border border-border shadow-floating sm:w-36 lg:w-44"
            movie={movie}
          />
          <div className="min-w-0 pb-1">
            <h1 className="font-display text-3xl font-semibold leading-none tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
              {movie.title}
            </h1>
            {showOriginalTitle ? (
              <p className="mt-2 text-sm text-muted sm:text-base">
                Título original: {movie.originalTitle}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted sm:text-base">
              <span>{year}</span>
              {runtime ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{runtime}</span>
                </>
              ) : null}
              {movie.genres.map((genre) => (
                <span className="contents" key={genre.id}>
                  <span aria-hidden="true">·</span>
                  <span>{genre.name}</span>
                </span>
              ))}
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1.5 font-mono text-xs text-primary">
              <StarIcon className="size-3.5" />
              {movie.tmdbRating.toFixed(1)} TMDB
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-28 sm:px-8 lg:px-12">
        {movie.trailer ? (
          <Button
            className="min-h-14 w-full bg-foreground text-background shadow-none hover:bg-primary-hover"
            onClick={() => setTrailerOpen(true)}
            size={CONTROL_SIZE.LG}
          >
            <PlayIcon className="size-5" />
            Ver trailer
          </Button>
        ) : null}

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:gap-16">
          <div className="min-w-0 space-y-10">
            <section aria-labelledby="synopsis-heading">
              <h2
                className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
                id="synopsis-heading"
              >
                Sinopsis
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/90 sm:text-lg sm:leading-8">
                {movie.overview || "Sin sinopsis disponible."}
              </p>
            </section>

            {movie.director ? (
              <section aria-labelledby="director-heading">
                <h2
                  className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
                  id="director-heading"
                >
                  Dirección
                </h2>
                <p className="mt-3 font-display text-lg font-semibold text-foreground">
                  {movie.director.name}
                </p>
              </section>
            ) : null}

            {movie.cast.length > 0 ? (
              <section aria-labelledby="cast-heading">
                <h2
                  className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
                  id="cast-heading"
                >
                  Reparto
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {movie.cast.slice(0, 4).map((castMember) => (
                    <li className="min-w-0" key={castMember.id}>
                      <Avatar
                        alt={castMember.name}
                        className="bg-surface-elevated! text-muted! ring-1 ring-border"
                        initials={getInitials(castMember.name)}
                        size="lg"
                      />
                      <p className="mt-3 text-sm font-medium leading-5 text-foreground">
                        {castMember.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {castMember.character}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <PersonalMovieState
              onClearReaction={handleClearReaction}
              onReactionChange={handleReactionChange}
              onWatchedChange={handleWatchedChange}
              reaction={reaction}
              watched={watched}
            />

            <SimilarMoviesSection
              key={movie.id}
              movieId={movie.id}
              onSelectMovie={handleSelectSimilarMovie}
            />
          </div>

          <MovieReviews
            editorMode={editorMode}
            myReview={myReview}
            onCloseEditor={() => setEditorMode(null)}
            onDeleteReview={handleDeleteReview}
            onOpenCreate={() => setEditorMode("create")}
            onOpenEdit={() => setEditorMode("edit")}
            onSaveReview={handleSaveReview}
            publicReviews={activeDetail.publicReviews}
            summary={reviewSummary}
          />
        </div>
      </div>

      <AnimatePresence>
        {trailerOpen && movie.trailer ? (
          <TrailerDialog
            key={movie.trailer.key}
            movieTitle={movie.title}
            onClose={() => setTrailerOpen(false)}
            trailerKey={movie.trailer.key}
          />
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
