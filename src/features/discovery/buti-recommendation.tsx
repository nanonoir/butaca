import {
  BUTI_ACTIVITY,
  BUTI_MATCH,
  ButiMascot,
  type ButiMatch,
} from "@/components/shared/buti-mascot";
import type { MovieSummary } from "@/contracts/movies";

export interface ButiInsight {
  match: ButiMatch;
  opinion: string;
}

const BUTI_INSIGHTS: Readonly<Record<number, ButiInsight>> = {
  129: {
    match: BUTI_MATCH.LOW,
    opinion:
      "Esta aventura queda fuera de tus géneros habituales, pero su fantasía y emoción pueden ser una buena sorpresa.",
  },
  329865: {
    match: BUTI_MATCH.MEDIUM,
    opinion:
      "Otra historia de Denis Villeneuve: ciencia ficción íntima, misterio y una duración más contenida para seguir en ese tono.",
  },
  335984: {
    match: BUTI_MATCH.HIGH,
    opinion:
      "Esta ya dialoga con tus gustos: ciencia ficción, atmósfera noir y el pulso visual de Denis Villeneuve.",
  },
  438631: {
    match: BUTI_MATCH.HIGH,
    opinion:
      "Denis Villeneuve otra vez: te gustó Blade Runner 2049 y acá vuelve el mismo pulso, con 2 h 35 min de duración.",
  },
  545611: {
    match: BUTI_MATCH.MEDIUM,
    opinion:
      "Acción, ciencia ficción y una historia familiar muy distinta: buena opción si hoy querés algo intenso y sorprendente.",
  },
};

interface ButiRecommendationProps {
  movie: MovieSummary;
  onOpenAssistant: (trigger: HTMLButtonElement) => void;
}

export function getButiInsight(movie: MovieSummary): ButiInsight {
  return (
    BUTI_INSIGHTS[movie.id] ?? {
      match: BUTI_MATCH.MEDIUM,
      opinion: `${movie.title} encaja con lo que venís viendo y tiene ${movie.tmdbRating.toFixed(1)} en TMDB.`,
    }
  );
}

export function ButiRecommendation({
  movie,
  onOpenAssistant,
}: ButiRecommendationProps) {
  const insight = getButiInsight(movie);

  return (
    <aside
      aria-label={`Buti opina sobre ${movie.title}`}
      className="mx-auto w-full max-w-[17rem] self-center min-[980px]:col-start-2 min-[980px]:row-start-1 min-[1180px]:col-start-3"
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
          {insight.opinion}
        </p>
        <span
          aria-hidden="true"
          className="absolute -bottom-2 left-6 size-4 rotate-45 border-b border-r border-primary/25 bg-surface-elevated"
        />
      </div>

      <div className="mt-4 flex items-center gap-3 px-1">
        <div className="relative shrink-0">
          <ButiMascot
            activity={
              insight.match === BUTI_MATCH.HIGH
                ? BUTI_ACTIVITY.JUMPING
                : BUTI_ACTIVITY.IDLE
            }
            className="size-[4.75rem]"
            key={movie.id}
            match={insight.match}
          />
          <button
            aria-label={`Abrir asistente de Buti sobre ${movie.title}`}
            className="absolute inset-0 rounded-[1.35rem] transition-[box-shadow] duration-fast ease-ui hover:ring-2 hover:ring-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
