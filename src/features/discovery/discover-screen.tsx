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
import type { MovieReaction, ViewerMovieState } from "@/contracts/interactions";
import type { RecommendedMovie } from "@/contracts/discover";
import type { MovieSummary } from "@/contracts/movies";
import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { MovieDetailScreen } from "@/features/movie-detail/movie-detail-screen";
import { InlineMovieSearch } from "@/features/movies/components/inline-movie-search";
import { movieDetailPath } from "@/features/movie-detail/movie-slug";
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
      className="discover-reaction-controls grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6"
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
    <div className="flex aspect-[2/3] h-full min-h-0 max-h-[38rem] max-w-full flex-col items-center justify-center rounded-xl border border-border bg-surface-muted px-8 text-center">
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
  const [searchActive, setSearchActive] = useState(false);
  /** The card in front of somebody, opened for a closer look. It used to be
   * the summary padded with nulls -- no director, no cast, no trailer -- which
   * is exactly what "Más información" promises and did not deliver. */
  const [deckDetail, setDeckDetail] = useState<SearchDetailExperience | null>(
    null,
  );
  const movieSearch = useMovieSearch(fetchSearchMovies);
  const [exitReaction, setExitReaction] = useState<MovieReaction | null>(null);
  const [lastAction, setLastAction] = useState("");
  const assistantTrigger = useRef<HTMLButtonElement | null>(null);
  const current = deck[currentIndex];
  const currentMovie = current?.movie;
  const nextMovie = deck[currentIndex + 1]?.movie;
  const detailExperience = deckDetail;
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

  /** Moves the deck on. Split out because a reaction can arrive already saved
   * -- from the detail -- and re-sending it is a second write for one gesture. */
  function advanceDeck(reaction: MovieReaction) {
    if (!currentMovie) {
      return;
    }

    setExitReaction(reaction);
    setLastAction(
      `${currentMovie.title}: ${reaction === SWIPE_INTENT.LIKE ? "Me gusta" : "Paso"}`,
    );
    setCurrentIndex((index) => index + 1);
  }

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

  function handleSearchPageChange(page: number) {
    movieSearch.changePage(page);
  }

  function retrySearch() {
    movieSearch.retry();
  }

  /** The card in front of somebody stays an overlay on purpose: "Más
   * información" discloses what is already there rather than navigating to it,
   * and the deck is a queue being worked through. Sending somebody to an
   * address and back would leave the card they just decided on still at the
   * front of it. Everything that is a list links instead. */
  function openDeckDetail(movie: MovieSummary) {
    void Promise.all([
      fetchMovieDetail(movie.id),
      fetchMovieReviews(movie.id),
    ]).then(
      ([pageData, reviews]) => {
        setDeckDetail({ pageData, publicReviews: reviews.data });
      },
      () => {
        // A failed lookup leaves the deck exactly as it was rather than
        // throwing an empty overlay over it.
      },
    );
  }

  function handleDetailClose(viewerState: ViewerMovieState) {
    const reactedMovieId = deckDetail?.pageData.movie.id;
    setDeckDetail(null);

    // The detail already saved it. Advancing used to go through the swipe
    // handler, which wrote the same reaction a second time and announced a
    // swipe nobody made.
    if (viewerState.reaction !== null && reactedMovieId === currentMovie?.id) {
      advanceDeck(viewerState.reaction);
    }
  }

  function restartStack() {
    setCurrentIndex(0);
    setExitReaction(null);
    setLastAction("");
  }

  return (
    <div className="discover-screen relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-7 py-2 md:gap-8 md:py-4">
      <div
        aria-hidden={detailExperience || assistantOpen ? true : undefined}
        className="contents"
        inert={detailExperience || assistantOpen ? true : undefined}
      >
        <div className="discover-header relative z-30 shrink-0">
          <PageHeader
            action={
              <div className="w-full sm:w-auto">
                <InlineMovieSearch
                  clearLabel="Volver a descubrir"
                  draft={movieSearch.draft}
                  inputId="discover-search-input"
                  isLoading={movieSearch.isLoading}
                  isOpen={searchActive}
                  layoutId="discover-search-control"
                  onClear={movieSearch.clear}
                  onDraftChange={movieSearch.setDraft}
                  onOpenChange={setSearchActive}
                  onSubmit={movieSearch.submit}
                  submittedQuery={movieSearch.submittedQuery}
                  triggerId="discover-search-trigger"
                />
              </div>
            }
            eyebrow="Para vos"
            title="Descubrir"
          />
        </div>

        <p aria-live="polite" className="sr-only" role="status">
          {lastAction}
        </p>

        {movieSearch.submittedQuery ? (
          <motion.div
            className="min-h-0 flex-1 overflow-y-auto pr-1"
            layout={shouldReduceMotion ? false : "position"}
            transition={{
              layout: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
            }}
          >
            <SearchGrid
              error={movieSearch.hasError}
              isLoading={movieSearch.isLoading}
              onPageChange={handleSearchPageChange}
              onRetry={retrySearch}
              movieHref={(movie) => movieDetailPath(movie.id, movie.title)}
              onSelectMovie={() => undefined}
              query={movieSearch.submittedQuery}
              results={movieSearch.results}
            />
          </motion.div>
        ) : (
          <motion.section
            aria-labelledby="discover-stack-title"
            className="grid min-h-0 min-w-0 flex-1 items-stretch gap-8 min-[980px]:grid-cols-[minmax(26rem,34rem)_minmax(15rem,17rem)] min-[1180px]:grid-cols-[13rem_minmax(26rem,34rem)_minmax(15rem,17rem)] min-[1180px]:gap-10"
            layout={shouldReduceMotion ? false : "position"}
            transition={{
              layout: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
            }}
          >
            <h2 className="sr-only" id="discover-stack-title">
              Recomendaciones de películas
            </h2>
            <HowItWorks />

            <div
              className="discover-stack-column mx-auto grid h-full min-h-0 w-full max-w-[34rem] grid-rows-[minmax(0,1fr)_auto_auto_auto] gap-3 min-[980px]:col-start-1 min-[980px]:row-start-1 min-[1180px]:col-start-2"
              data-testid="movie-stack-column"
            >
              {currentMovie ? (
                <>
                  <div
                    className="relative mx-auto aspect-[2/3] h-full min-h-0 w-auto max-h-[38rem] max-w-full min-[980px]:max-h-[42rem]"
                    data-testid="discover-poster-frame"
                  >
                    {nextMovie ? <NextMovieCard movie={nextMovie} /> : null}
                    <AnimatePresence custom={exitReaction} initial={false}>
                      <DiscoverMovieCard
                        key={currentMovie.id}
                        exitReaction={exitReaction}
                        movie={currentMovie}
                        onOpenDetail={() => openDeckDetail(currentMovie)}
                        onReact={handleReaction}
                      />
                    </AnimatePresence>
                  </div>

                  <div className="discover-mobile-buti min-[980px]:hidden">
                    <ButiMobileRecommendation
                      movie={currentMovie}
                      insight={current!.insight}
                      onOpenAssistant={openAssistant}
                    />
                  </div>

                  <p className="discover-mobile-hint text-center font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground lg:hidden">
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
                    onOpenDetail={() => openDeckDetail(currentMovie)}
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
    </div>
  );
}
