"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";

import { MovieArtwork } from "@/components/shared/movie-artwork";
import { PageHeader } from "@/components/shared/page-header";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MovieReaction, ViewerMovieState } from "@/contracts/interactions";
import type { RecommendedMovie } from "@/contracts/discover";
import type { MovieSummary } from "@/contracts/movies";
import { getMovieDetailExperienceFixture } from "@/fixtures/movie-details";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { MovieDetailScreen } from "@/features/movie-detail/movie-detail-screen";
import { SearchGrid } from "@/features/movies/components/search-grid";
import { fetchSearchMovies } from "@/features/movies/movie-catalog-client";
import { useMovieSearch } from "@/features/movies/hooks/use-movie-search";
import { fetchMovieReviews } from "@/features/reviews/review-client";

import { ButiAssistantDrawer } from "./buti-assistant-drawer";
import {
  ButiMobileRecommendation,
  ButiRecommendation,
} from "./buti-recommendation";
import { setMovieReaction } from "@/features/interactions/interaction-client";
import { fetchDiscoverBatch } from "@/features/recommendations/discover-client";

import { resolveSwipeIntent, SWIPE_INTENT } from "./resolve-swipe-intent";

/** Cards left before another batch is requested. Five leaves room for the
 * request to land while the viewer keeps swiping. */
const REFILL_THRESHOLD = 5;

interface DiscoverScreenProps {
  movies: RecommendedMovie[];
}

interface DiscoverMovieCardProps {
  movie: MovieSummary;
  exitReaction: MovieReaction | null;
  onOpenDetail: () => void;
  onReact: (reaction: MovieReaction) => void;
}

interface SearchDetailExperience {
  pageData: Awaited<ReturnType<typeof fetchMovieDetail>>;
  publicReviews: Awaited<ReturnType<typeof fetchMovieReviews>>["data"];
}

const GENRE_NAMES: Readonly<Record<number, string>> = {
  12: "Aventura",
  14: "Fantasía",
  16: "Animación",
  18: "Drama",
  28: "Acción",
  35: "Comedia",
  51: "Familia",
  53: "Thriller",
  878: "Ciencia ficción",
  9648: "Misterio",
  10749: "Romance",
  10751: "Familia",
};

const HOW_IT_WORKS = [
  { symbol: "→", label: "Me gusta" },
  { symbol: "←", label: "Paso" },
  { symbol: "↑", label: "Ver detalle" },
] as const;

const CARD_SPRING = {
  type: "spring",
  stiffness: 360,
  damping: 32,
} as const;

function CrossIcon({ className }: { className?: string }) {
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

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M20.7 8.8c0 4.9-8.7 9.6-8.7 9.6S3.3 13.7 3.3 8.8A4.5 4.5 0 0 1 12 6.5a4.5 4.5 0 0 1 8.7 2.3Z" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m7 11 5-5 5 5M12 6v12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
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

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m12 4 1.15 4.85L18 10l-4.85 1.15L12 16l-1.15-4.85L6 10l4.85-1.15L12 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        cx="10.75"
        cy="10.75"
        r="5.75"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m15 15 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getMovieYear(movie: MovieSummary) {
  return movie.releaseDate?.slice(0, 4) ?? "Sin fecha";
}

function getMovieGenres(movie: MovieSummary) {
  return movie.genreIds
    .map((genreId) => GENRE_NAMES[genreId])
    .filter((genre): genre is string => Boolean(genre))
    .slice(0, 2);
}

function HowItWorks() {
  return (
    <aside className="hidden max-w-[13rem] self-center min-[1180px]:col-start-1 min-[1180px]:row-start-1 min-[1180px]:block">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
        Cómo funciona
      </p>
      <ul className="mt-4 space-y-3">
        {HOW_IT_WORKS.map(({ symbol, label }) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-secondary font-mono text-xs text-primary">
              {symbol}
            </span>
            <span className="font-medium text-foreground">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm leading-6 text-muted">
        Arrastrá la película o usá los controles. Cada gesto ajusta lo que viene
        después.
      </p>
    </aside>
  );
}

function NextMovieCard({ movie }: { movie: MovieSummary }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 translate-x-3 translate-y-3 rotate-[2deg] scale-[0.985] overflow-hidden rounded-xl border border-primary/25 bg-surface-muted opacity-75 shadow-floating"
      data-motion-ambient
      data-testid="next-movie-card"
    >
      <MovieArtwork className="absolute inset-0" movie={movie} />
      <div className="absolute inset-0 bg-overlay/35" />
    </div>
  );
}

function DiscoverMovieCard({
  movie,
  exitReaction,
  onOpenDetail,
  onReact,
}: DiscoverMovieCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotation = useTransform(x, [-280, 0, 280], [-7, 0, 7]);
  const likeOpacity = useTransform(x, [24, 118], [0, 1]);
  const passOpacity = useTransform(x, [-118, -24], [1, 0]);
  const detailOpacity = useTransform(y, [-118, -26], [1, 0]);
  const genres = getMovieGenres(movie);

  function resetPosition() {
    void animate(x, 0, CARD_SPRING);
    void animate(y, 0, CARD_SPRING);
  }

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    const intent = resolveSwipeIntent({
      offsetX: info.offset.x,
      offsetY: info.offset.y,
      velocityX: info.velocity.x,
      velocityY: info.velocity.y,
    });

    if (intent === SWIPE_INTENT.DETAIL) {
      resetPosition();
      onOpenDetail();
      return;
    }

    if (intent === SWIPE_INTENT.LIKE || intent === SWIPE_INTENT.DISLIKE) {
      onReact(intent);
      return;
    }

    resetPosition();
  }

  const exitTransform =
    exitReaction === SWIPE_INTENT.LIKE
      ? "translate3d(42rem, 1.5rem, 0) rotate(12deg)"
      : "translate3d(-42rem, 1.5rem, 0) rotate(-12deg)";

  return (
    <motion.div
      animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
      className="absolute inset-0 z-10"
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : { opacity: 0, transform: exitTransform }
      }
      initial={
        shouldReduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              transform: "translate3d(0, 1rem, 0) scale(0.98)",
            }
      }
      transition={{
        duration: shouldReduceMotion ? 0.08 : 0.24,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <motion.article
        aria-describedby={`discover-hint-${movie.id}`}
        className="relative size-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-border bg-surface-muted shadow-floating active:cursor-grabbing"
        data-motion-transform
        data-testid="current-movie-card"
        drag={shouldReduceMotion ? false : true}
        dragConstraints={{ bottom: 0, left: 0, right: 0, top: 0 }}
        dragElastic={{ bottom: 0.12, left: 0.82, right: 0.82, top: 0.72 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ rotate: rotation, x, y }}
      >
        <MovieArtwork className="absolute inset-0" movie={movie} />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-background via-background/65 to-transparent" />

        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute left-5 top-5 rotate-[-5deg] rounded-sm border border-primary bg-background/80 px-3 py-2 font-mono text-xs font-semibold tracking-[0.12em] text-primary backdrop-blur-sm"
          style={{ opacity: likeOpacity }}
        >
          ME GUSTA
        </motion.span>
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute right-5 top-5 rotate-[5deg] rounded-sm border border-foreground/70 bg-background/80 px-3 py-2 font-mono text-xs font-semibold tracking-[0.12em] text-foreground backdrop-blur-sm"
          style={{ opacity: passOpacity }}
        >
          PASO
        </motion.span>
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-primary bg-background/80 px-3 py-2 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-primary backdrop-blur-sm"
          style={{ opacity: detailOpacity }}
        >
          Más información
        </motion.span>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
          <h2 className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-4xl">
            {movie.title}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted sm:text-base">
            <span>{getMovieYear(movie)}</span>
            {genres.map((genre) => (
              <span className="contents" key={genre}>
                <span aria-hidden="true">·</span>
                <span>{genre}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 font-mono text-xs text-primary sm:ml-1">
              <StarIcon className="size-3.5" />
              {movie.tmdbRating.toFixed(1)} TMDB
            </span>
          </div>
          <p className="sr-only" id={`discover-hint-${movie.id}`}>
            Deslizá a la derecha para indicar Me gusta, a la izquierda para
            pasar o hacia arriba para ver más información.
          </p>
        </div>
      </motion.article>
    </motion.div>
  );
}

function ReactionControls({
  movie,
  onOpenDetail,
  onReact,
}: {
  movie: MovieSummary;
  onOpenDetail: () => void;
  onReact: (reaction: MovieReaction) => void;
}) {
  return (
    <div
      aria-label="Acciones de la película"
      className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6"
      role="group"
    >
      <div className="flex flex-col items-center gap-2">
        <Button
          aria-label="No me gusta"
          className="size-16 rounded-full border-border p-0 text-foreground hover:border-primary hover:bg-transparent hover:text-primary"
          onClick={() => onReact(SWIPE_INTENT.DISLIKE)}
          size={CONTROL_SIZE.LG}
          variant={BUTTON_VARIANT.OUTLINE}
        >
          <CrossIcon className="size-7" />
        </Button>
        <span className="text-xs font-medium text-muted">No me gusta</span>
      </div>

      <Button
        aria-label={`Más información sobre ${movie.title}`}
        className="mt-2 rounded-full px-3 text-muted hover:bg-transparent hover:text-primary sm:px-5"
        onClick={onOpenDetail}
        variant={BUTTON_VARIANT.GHOST}
      >
        <ArrowUpIcon className="size-4" />
        <span>Más información</span>
      </Button>

      <div className="flex flex-col items-center gap-2">
        <Button
          aria-label="Me gusta"
          className="size-16 rounded-full p-0"
          onClick={() => onReact(SWIPE_INTENT.LIKE)}
          size={CONTROL_SIZE.LG}
        >
          <HeartIcon className="size-7" />
        </Button>
        <span className="text-xs font-medium text-primary">Me gusta</span>
      </div>
    </div>
  );
}

function EndOfStack({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex aspect-[2/3] h-[min(52svh,38rem)] max-h-[38rem] max-w-full flex-col items-center justify-center rounded-xl border border-border bg-surface-muted px-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/12 text-primary">
        <SparkIcon className="size-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">
        Estás al día
      </h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
        Ya recorriste las recomendaciones preparadas para esta sesión.
      </p>
      <Button className="mt-6" onClick={onRestart}>
        Volver a empezar
      </Button>
    </div>
  );
}

export function DiscoverScreen({ movies }: DiscoverScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deck, setDeck] = useState(movies);
  const loadingRef = useRef(false);
  const [exhausted, setExhausted] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailMovie, setDetailMovie] = useState<MovieSummary | null>(null);
  const movieSearch = useMovieSearch(fetchSearchMovies);
  const [searchDetail, setSearchDetail] =
    useState<SearchDetailExperience | null>(null);
  const [exitReaction, setExitReaction] = useState<MovieReaction | null>(null);
  const [lastAction, setLastAction] = useState("");
  const assistantTrigger = useRef<HTMLButtonElement | null>(null);
  const searchTrigger = useRef<HTMLButtonElement | null>(null);
  const searchDetailTrigger = useRef<HTMLElement | null>(null);
  const current = deck[currentIndex];
  const currentMovie = current?.movie;
  const nextMovie = deck[currentIndex + 1]?.movie;
  const detailExperience = detailMovie
    ? getMovieDetailExperienceFixture(detailMovie)
    : null;

  useEffect(() => {
    if (!assistantOpen) {
      assistantTrigger.current?.focus();
    }
  }, [assistantOpen]);

  function openAssistant(trigger: HTMLButtonElement) {
    assistantTrigger.current = trigger;
    setAssistantOpen(true);
  }

  /** Refills before the deck runs out so the swipe never stops on an empty
   * screen. The ids on screen travel with the request: they are not reacted to
   * yet, so the server cannot know to leave them out.
   *
   * The in-flight guard is a ref rather than state on purpose. As a dependency
   * it would re-run this effect the moment it flipped, and the cleanup would
   * cancel the request that had just been sent. */
  useEffect(() => {
    if (exhausted || loadingRef.current) {
      return;
    }

    if (deck.length - currentIndex > REFILL_THRESHOLD) {
      return;
    }

    loadingRef.current = true;

    void fetchDiscoverBatch(deck.map((entry) => entry.movie.id))
      .then((batch) => {
        if (batch.movies.length === 0) {
          setExhausted(true);
          return;
        }

        setDeck((current) => [...current, ...batch.movies]);
      })
      .catch(() => {
        // Stop retrying on every swipe; the end-of-deck view takes over.
        setExhausted(true);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [currentIndex, deck, exhausted]);

  function handleReaction(reaction: MovieReaction) {
    if (!currentMovie) {
      return;
    }

    const { id: movieId, title } = currentMovie;

    setExitReaction(reaction);
    setLastAction(
      `${title}: ${reaction === SWIPE_INTENT.LIKE ? "Me gusta" : "Paso"}`,
    );
    setCurrentIndex((index) => index + 1);

    // The card advances immediately because holding it back would stall the
    // swipe. A rejected write is announced instead of rolled back: putting a
    // dismissed card back on the stack is more disorienting than reporting it.
    void (async () => setMovieReaction(movieId, reaction))().catch(() => {
      setLastAction(`No pudimos guardar tu reacción sobre ${title}.`);
    });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    movieSearch.submit();
  }

  function handleSearchPageChange(page: number) {
    movieSearch.changePage(page);
  }

  function clearSearch() {
    movieSearch.clear();
  }

  function closeSearch() {
    clearSearch();
    setSearchOpen(false);
    queueMicrotask(() => searchTrigger.current?.focus());
  }

  function toggleSearch(event: React.MouseEvent<HTMLButtonElement>) {
    searchTrigger.current = event.currentTarget;

    if (searchOpen) {
      closeSearch();
      return;
    }

    setSearchOpen(true);
  }

  function retrySearch() {
    movieSearch.retry();
  }

  function openSearchDetail(movie: MovieSummary) {
    searchDetailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    void Promise.all([
      fetchMovieDetail(movie.id),
      fetchMovieReviews(movie.id),
    ]).then(
      ([pageData, reviews]) => {
        setSearchDetail({ pageData, publicReviews: reviews.data });
      },
      () => {
        // Search detail errors are intentionally kept local to the existing
        // search presentation instead of discarding search state.
      },
    );
  }

  function handleSearchDetailClose() {
    setSearchDetail(null);
    queueMicrotask(() => searchDetailTrigger.current?.focus());
  }

  function handleDetailClose(viewerState: ViewerMovieState) {
    setDetailMovie(null);

    if (viewerState.reaction !== null && detailMovie?.id === currentMovie?.id) {
      handleReaction(viewerState.reaction);
    }
  }

  function restartStack() {
    setCurrentIndex(0);
    setExitReaction(null);
    setLastAction("");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 py-2 md:gap-8 md:py-4">
      <div
        aria-hidden={
          detailExperience || searchDetail || assistantOpen ? true : undefined
        }
        className="contents"
        inert={
          detailExperience || searchDetail || assistantOpen ? true : undefined
        }
      >
        <PageHeader
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                aria-controls="discover-search-panel"
                aria-expanded={searchOpen}
                aria-label={
                  searchOpen
                    ? "Cerrar buscador de películas"
                    : "Abrir buscador de películas"
                }
                className="rounded-full border-primary/25 bg-primary/5 px-4 text-primary hover:border-primary/45 hover:bg-primary/10 aria-expanded:border-primary/45 aria-expanded:bg-primary/15"
                onClick={toggleSearch}
                size={CONTROL_SIZE.SM}
                variant={BUTTON_VARIANT.OUTLINE}
              >
                <SearchIcon className="size-4" />
                Buscar
              </Button>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary/10 px-3.5 font-mono text-[0.6875rem] font-semibold text-primary">
                <SparkIcon className="size-3.5" />
                Afinado hoy
              </span>
            </div>
          }
          eyebrow="Para vos"
          title="Descubrir"
        />

        <AnimatePresence initial={false} mode="popLayout">
          {searchOpen ? (
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface-elevated/75 p-4 shadow-floating backdrop-blur-sm"
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.99, y: -8 }
              }
              id="discover-search-panel"
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.985, y: -12 }
              }
              key="discover-search-panel"
              transition={{
                duration: shouldReduceMotion ? 0.01 : 0.3,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              <form
                aria-label="Búsqueda de películas"
                onSubmit={handleSearchSubmit}
                role="search"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <label
                    className="text-sm font-semibold text-foreground"
                    htmlFor="discover-search-input"
                  >
                    Buscar películas
                  </label>
                  <Button
                    aria-label="Cerrar búsqueda"
                    className="rounded-full text-muted hover:text-foreground"
                    onClick={closeSearch}
                    size={CONTROL_SIZE.SM}
                    variant={BUTTON_VARIANT.ICON}
                  >
                    <CrossIcon className="size-5" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <Input
                    aria-describedby="discover-search-helper"
                    autoFocus
                    id="discover-search-input"
                    onChange={(event) =>
                      movieSearch.setDraft(event.target.value)
                    }
                    placeholder="Escribí un título"
                    value={movieSearch.draft}
                  />
                  <Button
                    className="w-full sm:min-w-28 sm:w-auto"
                    disabled={movieSearch.isLoading}
                    type="submit"
                  >
                    <SearchIcon className="size-4" />
                    Buscar
                  </Button>
                </div>

                <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted" id="discover-search-helper">
                    Buscá por título y presioná Enter para ver resultados.
                  </p>
                  {movieSearch.submittedQuery ? (
                    <Button
                      onClick={clearSearch}
                      size={CONTROL_SIZE.SM}
                      type="button"
                      variant={BUTTON_VARIANT.GHOST}
                    >
                      Limpiar búsqueda
                    </Button>
                  ) : null}
                </div>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <p aria-live="polite" className="sr-only" role="status">
          {lastAction}
        </p>

        {movieSearch.submittedQuery ? (
          <motion.div
            layout={shouldReduceMotion ? false : "position"}
            layoutDependency={searchOpen}
            transition={{
              layout: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
            }}
          >
            <SearchGrid
              error={movieSearch.hasError}
              isLoading={movieSearch.isLoading}
              onPageChange={handleSearchPageChange}
              onRetry={retrySearch}
              onSelectMovie={openSearchDetail}
              query={movieSearch.submittedQuery}
              results={movieSearch.results}
            />
          </motion.div>
        ) : (
          <motion.section
            aria-labelledby="discover-stack-title"
            className="grid min-h-0 flex-1 items-center gap-8 min-[980px]:grid-cols-[minmax(26rem,34rem)_minmax(15rem,17rem)] min-[1180px]:grid-cols-[13rem_minmax(26rem,34rem)_minmax(15rem,17rem)] min-[1180px]:gap-10"
            layout={shouldReduceMotion ? false : "position"}
            layoutDependency={searchOpen}
            transition={{
              layout: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
            }}
          >
            <h2 className="sr-only" id="discover-stack-title">
              Recomendaciones de películas
            </h2>
            <HowItWorks />

            <div
              className="mx-auto flex w-full max-w-[34rem] flex-col gap-3 min-[980px]:col-start-1 min-[980px]:row-start-1 min-[1180px]:col-start-2"
              data-testid="movie-stack-column"
            >
              {currentMovie ? (
                <>
                  <div
                    className="relative mx-auto aspect-[2/3] h-[min(52svh,38rem)] max-h-[38rem] max-w-full min-[980px]:h-[min(66svh,42rem)] min-[980px]:max-h-[42rem]"
                    data-testid="discover-poster-frame"
                  >
                    {nextMovie ? <NextMovieCard movie={nextMovie} /> : null}
                    <AnimatePresence custom={exitReaction} initial={false}>
                      <DiscoverMovieCard
                        key={currentMovie.id}
                        exitReaction={exitReaction}
                        movie={currentMovie}
                        onOpenDetail={() => setDetailMovie(currentMovie)}
                        onReact={handleReaction}
                      />
                    </AnimatePresence>
                  </div>

                  <ButiMobileRecommendation
                    movie={currentMovie}
                    insight={current!.insight}
                    onOpenAssistant={openAssistant}
                  />

                  <p className="text-center font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground lg:hidden">
                    Deslizá la card o usá los controles
                  </p>
                  <div className="hidden justify-center lg:flex">
                    <p className="rounded-full border border-border bg-background/35 px-4 py-2 font-mono text-[0.625rem] tracking-[0.08em] text-muted">
                      ← paso&nbsp;&nbsp; | &nbsp;&nbsp;↑ detalle&nbsp;&nbsp; |
                      &nbsp;&nbsp;me gusta →
                    </p>
                  </div>

                  <ReactionControls
                    movie={currentMovie}
                    onOpenDetail={() => setDetailMovie(currentMovie)}
                    onReact={handleReaction}
                  />
                </>
              ) : (
                <EndOfStack onRestart={restartStack} />
              )}
            </div>

            {currentMovie ? (
              <ButiRecommendation
                movie={currentMovie}
                insight={current!.insight}
                onOpenAssistant={openAssistant}
              />
            ) : (
              <div
                aria-hidden="true"
                className="hidden text-right font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground min-[980px]:col-start-2 min-[980px]:row-start-1 min-[980px]:block min-[1180px]:col-start-3"
              >
                {deck.length} / {deck.length}
              </div>
            )}
          </motion.section>
        )}
      </div>

      <AnimatePresence>
        {assistantOpen && currentMovie ? (
          <ButiAssistantDrawer
            key={`buti-drawer-${currentMovie.id}`}
            movie={currentMovie}
            insight={current!.insight}
            onClose={() => setAssistantOpen(false)}
            recommendations={deck
              .map((entry) => entry.movie)
              .filter((movie) => movie.id !== currentMovie.id)
              .slice(0, 3)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {detailExperience ? (
          <MovieDetailScreen
            key={detailExperience.pageData.movie.id}
            onClose={handleDetailClose}
            pageData={detailExperience.pageData}
            publicReviews={detailExperience.publicReviews}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {searchDetail ? (
          <MovieDetailScreen
            key={searchDetail.pageData.movie.id}
            onClose={handleSearchDetailClose}
            pageData={searchDetail.pageData}
            publicReviews={searchDetail.publicReviews}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
