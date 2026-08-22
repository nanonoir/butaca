import {
  BUTI_ACTIVITY,
  BUTI_MATCH,
  ButiMascot,
  type ButiMatch,
} from "@/components/shared/buti-mascot";
import type { MatchInsight, MatchTier } from "@/contracts/discover";
import type { MovieSummary } from "@/contracts/movies";

export interface ButiInsight {
  match: ButiMatch;
  opinion: string;
}

const MATCH_BY_TIER: Readonly<Record<MatchTier, ButiMatch>> = {
  high: BUTI_MATCH.HIGH,
  medium: BUTI_MATCH.MEDIUM,
  low: BUTI_MATCH.LOW,
};

function joinGenres(genres: string[]): string {
  const [first, second] = genres;

  return second ? `${first} y ${second}` : (first ?? "");
}

/** Several phrasings per case, picked by movie id. Almost every candidate
 * matches two of the viewer's genres, so a single template made the whole deck
 * read the same; the id keeps a given movie's line stable while it is on
 * screen. */
const MATCHED_PHRASES: Readonly<Record<"high" | "medium", readonly string[]>> =
  {
    high: [
      "{genres}: justo lo que venís marcando.",
      "Da en el clavo con {genres}, tus dos fuertes.",
      "{genres}, y de lo mejor que encontré para vos hoy.",
    ],
    medium: [
      "{genres}, aunque hoy encontré cosas que te pegan más.",
      "Va por {genres}, sin ser lo más redondo de la tanda.",
      "{genres}: entra, pero no es la que más te representa.",
    ],
  };

const SINGLE_GENRE_PHRASES = [
  "{genres} es de lo que más mirás, y puntúa {rating} en TMDB.",
  "Tira para {genres}, con {rating} en TMDB.",
] as const;

const OFF_PROFILE_PHRASES = [
  "Se sale de tus géneros habituales, pero puntúa {rating} en TMDB.",
  "Nada que ver con lo que venís viendo; va por su {rating} en TMDB.",
] as const;

function pick(phrases: readonly string[], movieId: number): string {
  return phrases[movieId % phrases.length] ?? phrases[0]!;
}

function fill(phrase: string, genres: string, rating: string): string {
  return phrase.replace("{genres}", genres).replace("{rating}", rating);
}

/** Says why the recommender picked the movie, using the genres it actually
 * weighed. It used to read a table keyed by five fixture ids, so once Discover
 * started serving real recommendations almost every card fell through to the
 * same sentence. */
export function getButiInsight(
  movie: MovieSummary,
  insight: MatchInsight,
): ButiInsight {
  const match = MATCH_BY_TIER[insight.tier];
  const matched = joinGenres(insight.matchedGenres);
  const clashing = joinGenres(insight.clashingGenres);
  const rating = movie.tmdbRating.toFixed(1);

  if (clashing) {
    return {
      match,
      opinion: matched
        ? `${matched} van con lo tuyo, aunque ${clashing.toLowerCase()} es lo que venís descartando.`
        : `Se apoya en ${clashing.toLowerCase()}, que venís descartando, pero puntúa ${rating} en TMDB.`,
    };
  }

  if (insight.matchedGenres.length > 1 && insight.tier !== "low") {
    return {
      match,
      opinion: fill(
        pick(MATCHED_PHRASES[insight.tier], movie.id),
        matched,
        rating,
      ),
    };
  }

  if (matched) {
    return {
      match,
      opinion: fill(pick(SINGLE_GENRE_PHRASES, movie.id), matched, rating),
    };
  }

  return {
    match,
    opinion: fill(pick(OFF_PROFILE_PHRASES, movie.id), matched, rating),
  };
}

interface ButiRecommendationProps {
  movie: MovieSummary;
  insight: MatchInsight;
  onOpenAssistant: (trigger: HTMLButtonElement) => void;
}

function getButiActivity(match: ButiMatch) {
  return match === BUTI_MATCH.HIGH ? BUTI_ACTIVITY.JUMPING : BUTI_ACTIVITY.IDLE;
}

export function ButiMobileRecommendation({
  movie,
  insight,
  onOpenAssistant,
}: ButiRecommendationProps) {
  const butiInsight = getButiInsight(movie, insight);

  return (
    <button
      aria-label={`Abrir asistente de Buti sobre ${movie.title} desde el resumen`}
      className="flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-surface-elevated px-3 py-2.5 text-left transition-[background-color,border-color,transform] duration-fast ease-ui hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.985] min-[980px]:hidden"
      onClick={(event) => onOpenAssistant(event.currentTarget)}
      type="button"
    >
      <ButiMascot
        activity={getButiActivity(butiInsight.match)}
        className="size-12"
        key={movie.id}
        match={butiInsight.match}
      />
      <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 text-foreground/85">
        {butiInsight.opinion}
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 px-1 text-2xl leading-none text-primary"
      >
        ›
      </span>
    </button>
  );
}

export function ButiRecommendation({
  movie,
  insight,
  onOpenAssistant,
}: ButiRecommendationProps) {
  const butiInsight = getButiInsight(movie, insight);

  return (
    <aside
      aria-label={`Buti opina sobre ${movie.title}`}
      className="mx-auto hidden w-full max-w-[17rem] self-center min-[980px]:col-start-2 min-[980px]:row-start-1 min-[980px]:block min-[1180px]:col-start-3"
    >
      <div className="relative rounded-xl border border-primary/25 bg-surface-elevated px-5 py-4">
        <p className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-primary">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-primary"
          />
          Buti opina
        </p>
        <p className="mt-3 text-sm leading-6 text-foreground/90">
          {butiInsight.opinion}
        </p>
        <span
          aria-hidden="true"
          className="absolute -bottom-2 left-6 size-4 rotate-45 border-b border-r border-primary/25 bg-surface-elevated"
        />
      </div>

      <div className="mt-4 flex items-center gap-3 px-1">
        <div className="relative shrink-0">
          <ButiMascot
            activity={getButiActivity(butiInsight.match)}
            className="size-[4.75rem]"
            key={movie.id}
            match={butiInsight.match}
          />
          <button
            aria-label={`Abrir asistente de Buti sobre ${movie.title}`}
            className="absolute inset-0 rounded-[1.35rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => onOpenAssistant(event.currentTarget)}
            type="button"
          />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Buti</p>
          <button
            aria-label={`Preguntale a Buti sobre ${movie.title}`}
            className="mt-1 inline-flex min-h-8 items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 text-xs font-semibold text-primary transition-[background-color,border-color,color] duration-fast ease-ui hover:border-primary/35 hover:bg-primary/15 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => onOpenAssistant(event.currentTarget)}
            type="button"
          >
            Preguntale
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
