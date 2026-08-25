"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { MovieArtwork } from "@/components/shared/movie-artwork";
import {
  getTmdbImageUrl,
  TMDB_IMAGE_SIZE,
} from "@/integrations/tmdb/image-url";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import type { MovieDetailPageData } from "@/contracts/movie-detail";
import type { MovieReaction, ViewerMovieState } from "@/contracts/interactions";
import type { CastMember, MovieSummary } from "@/contracts/movies";
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

const HEART_OUTLINE =
  "M20.4 8.8c0 4.6-8.4 9.2-8.4 9.2S3.6 13.4 3.6 8.8A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 8.4 2.2Z";

function HeartIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path
        d={HEART_OUTLINE}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** The same heart with a split down it. A cross said "no" but said nothing
 * about what it was answering; this one is legibly the other half of the
 * pair, which is what a viewer is choosing between. */
function BrokenHeartIcon({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path
        d={HEART_OUTLINE}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 6.7 10.2 10.2l3 1.5-2.1 4.5"
        fill="none"
        stroke={
          filled
            ? "var(--color-primary-foreground, currentColor)"
            : "currentColor"
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
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

interface ViewerStateActionsProps {
  className?: string;
  reaction: MovieReaction | null;
  watched: boolean;
  onClearReaction: () => void;
  onReactionChange: (reaction: MovieReaction) => void;
  onWatchedChange: (watched: boolean) => void;
}

/** The three things a viewer does to a movie, sitting on the artwork where
 * they can be reached without scrolling past the synopsis.
 *
 * There is no separate button to undo a reaction any more: pressing the one
 * that is already on turns it off, so each control answers for itself. The
 * labels say which of the two it is about to do, since an icon that means
 * both "like" and "stop liking" cannot be read by anyone who cannot see
 * whether it is lit. */
/** Four is what fits one row on a wide screen and two on a narrow one, and on
 * a narrow one the cast sits ahead of the reviews -- so every extra row here
 * is a row between a viewer and what people said about the film. */
const COLLAPSED_CAST = 4;

interface CastSectionProps {
  cast: CastMember[];
}

/** TMDB bills the cast in order, and its tail is uncredited extras: The Dark
 * Knight lists 138 people, of whom only 90 have a photograph at all. The
 * contract keeps the first 20, which is the cast anyone means, and where
 * almost every face is actually there. */
function CastSection({ cast }: CastSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const visibleCast = expanded ? cast : cast.slice(0, COLLAPSED_CAST);

  return (
    <section aria-labelledby="cast-heading">
      <h2
        className="font-mono text-xs uppercase tracking-[0.14em] text-muted"
        id="cast-heading"
      >
        Reparto
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
        {visibleCast.map((castMember, index) => (
          <motion.li
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0"
            initial={
              // Only what the press revealed moves; the first four were
              // already on screen and have no business re-entering.
              index < COLLAPSED_CAST || shouldReduceMotion
                ? false
                : { opacity: 0, y: 8 }
            }
            key={castMember.id}
            transition={{
              delay: Math.min((index - COLLAPSED_CAST) * 0.03, 0.3),
              duration: 0.22,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <Avatar
              alt={castMember.name}
              className="bg-surface-elevated! text-muted! ring-1 ring-border"
              initials={getInitials(castMember.name)}
              size="lg"
              // Null for anyone TMDB has no photograph of, which drops the
              // avatar back to initials on its own.
              src={
                getTmdbImageUrl(
                  castMember.profilePath,
                  TMDB_IMAGE_SIZE.PROFILE,
                ) ?? undefined
              }
            />
            <p className="mt-3 text-sm font-medium leading-5 text-foreground">
              {castMember.name}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {castMember.character}
            </p>
          </motion.li>
        ))}
      </ul>
      {cast.length > COLLAPSED_CAST ? (
        <Button
          aria-expanded={expanded}
          className="mt-5"
          onClick={() => setExpanded((current) => !current)}
          variant={BUTTON_VARIANT.OUTLINE}
        >
          {expanded ? "Ver menos" : `Ver todo el reparto (${cast.length})`}
        </Button>
      ) : null}
    </section>
  );
}

function ViewerStateActions({
  className,
  reaction,
  watched,
  onClearReaction,
  onReactionChange,
  onWatchedChange,
}: ViewerStateActionsProps) {
  const actions = [
    {
      id: "LIKE" as const,
      on: reaction === "LIKE",
      label: reaction === "LIKE" ? "Quitar me gusta" : "Me gusta",
      icon: (filled: boolean) => (
        <HeartIcon className="size-5 sm:size-6" filled={filled} />
      ),
      press: () =>
        reaction === "LIKE" ? onClearReaction() : onReactionChange("LIKE"),
    },
    {
      id: "DISLIKE" as const,
      on: reaction === "DISLIKE",
      label: reaction === "DISLIKE" ? "Quitar no me gusta" : "No me gusta",
      icon: (filled: boolean) => (
        <BrokenHeartIcon className="size-5 sm:size-6" filled={filled} />
      ),
      press: () =>
        reaction === "DISLIKE"
          ? onClearReaction()
          : onReactionChange("DISLIKE"),
    },
    {
      id: "WATCHED" as const,
      on: watched,
      label: watched ? "Marcar no vista" : "Marcar vista",
      icon: () => <EyeIcon className="size-5 sm:size-6" watched={watched} />,
      press: () => onWatchedChange(!watched),
    },
  ];

  return (
    <div
      aria-label="Tu estado"
      className={cn("flex items-center gap-2 sm:gap-3", className)}
      role="group"
    >
      {actions.map((action) => (
        <button
          aria-label={action.label}
          aria-pressed={action.on}
          className={cn(
            // It sits over the backdrop image, so it carries its own ground
            // rather than trusting whatever frame of the movie is behind it.
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-colors duration-fast ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:size-14",
            action.on
              ? "border-primary bg-primary/20 text-primary"
              : "border-border bg-background/80 text-foreground hover:border-primary hover:text-primary",
          )}
          key={action.id}
          onClick={action.press}
          title={action.label}
          type="button"
        >
          {action.icon(action.on)}
        </button>
      ))}
    </div>
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

        {/* Wrapping until lg: below it the title needs the whole row, so the
         * controls take one of their own underneath rather than squeezing a
         * six line heading next to them. */}
        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-7xl flex-wrap items-end gap-x-5 gap-y-5 px-4 pb-7 sm:gap-x-7 sm:px-8 lg:flex-nowrap lg:px-12">
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
          <ViewerStateActions
            className="w-full justify-end lg:ml-auto lg:w-auto lg:pb-1"
            onClearReaction={handleClearReaction}
            onReactionChange={handleReactionChange}
            onWatchedChange={handleWatchedChange}
            reaction={reaction}
            watched={watched}
          />
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
              <CastSection cast={movie.cast} key={movie.id} />
            ) : null}
          </div>

          {/* Second in the source, so on one column it reads right after the
           * cast: what other people said about this movie comes before a list
           * of other movies. Placed back beside them from lg up, where both
           * columns are visible at once and order stops meaning sequence. */}
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
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

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <SimilarMoviesSection
              key={movie.id}
              movieId={movie.id}
              onSelectMovie={handleSelectSimilarMovie}
            />
          </div>
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
