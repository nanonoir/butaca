"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, useReducedMotion } from "motion/react";

import {
  BUTI_ACTIVITY,
  ButiMascot,
  type ButiActivity,
} from "@/components/shared/buti-mascot";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MatchInsight } from "@/contracts/discover";
import type { MovieSummary } from "@/contracts/movies";

import {
  toChatTurns,
  toContractMessages,
  type ChatUiMessage,
} from "@/features/chat/chat-turns";

import { getButiInsight } from "./buti-recommendation";

const QUICK_PROMPTS = [
  "¿Por qué esta?",
  "Ciencia ficción corta",
  "Algo intenso para esta noche",
  "Algo para reírme",
] as const;

interface ButiAssistantDrawerProps {
  movie: MovieSummary;
  insight: MatchInsight;
  onClose: () => void;
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

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CompactRecommendationRow({ movies }: { movies: MovieSummary[] }) {
  if (movies.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Recomendaciones de Buti"
      className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {movies.map((movie) => (
        <li
          className="w-[7.75rem] shrink-0 snap-start [&_article]:gap-2 [&_h3]:line-clamp-1 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:text-xs"
          key={movie.id}
        >
          <MoviePosterCard
            articleLabel={`Recomendación: ${movie.title}`}
            poster={<MovieArtwork className="size-full" movie={movie} />}
            presentationSlot={
              <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 font-mono text-[0.625rem] text-primary backdrop-blur-sm">
                <span aria-hidden="true">★</span>
                {movie.tmdbRating.toFixed(1)}
              </span>
            }
            title={movie.title}
            year={movie.releaseDate?.slice(0, 4)}
          />
        </li>
      ))}
    </ul>
  );
}

export function ButiAssistantDrawer({
  movie,
  insight,
  onClose,
}: ButiAssistantDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const butiInsight = getButiInsight(movie, insight);
  const [draft, setDraft] = useState("");
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  /** The same assistant the /ai screen talks to, told which card is on screen
   * so "¿por qué esta?" has a subject. It used to answer every question with
   * one hardcoded sentence built from the insight above. */
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: uiMessages }) => ({
        body: {
          messages: toContractMessages(uiMessages as ChatUiMessage[]),
          aboutMovieId: movie.id,
        },
      }),
    }),
  });
  const turns = toChatTurns(messages as ChatUiMessage[]);
  const pending = status === "submitted" || status === "streaming";
  const activity: ButiActivity = pending
    ? BUTI_ACTIVITY.TALKING
    : turns.some((turn) => turn.assistant)
      ? BUTI_ACTIVITY.JUMPING
      : BUTI_ACTIVITY.IDLE;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const conversation = conversationScrollRef.current;

    if (!conversation || typeof conversation.scrollTo !== "function") {
      return;
    }

    conversation.scrollTo({
      behavior: "smooth",
      top: conversation.scrollHeight,
    });
  }, [messages.length]);

  function submitPrompt(prompt: string) {
    const content = prompt.trim();

    if (!content || pending) {
      return;
    }

    setDraft("");
    void sendMessage({ text: content });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(draft);
  }

  function startNewConversation() {
    setDraft("");
    setMessages([]);
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60]"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.08 : 0.18 }}
    >
      <button
        aria-label="Cerrar panel al hacer clic fuera"
        className="absolute inset-0 size-full bg-overlay/60 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />

      <motion.aside
        aria-label={`Asistente de Buti sobre ${movie.title}`}
        aria-modal="true"
        animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
        className="absolute inset-x-3 bottom-3 top-[clamp(6.5rem,15dvh,9.5rem)] flex flex-col overflow-hidden rounded-xl border border-primary/25 bg-surface-elevated shadow-floating min-[980px]:inset-y-2 min-[980px]:left-auto min-[980px]:right-2 min-[980px]:w-[28rem]"
        exit={
          shouldReduceMotion
            ? { opacity: 0 }
            : { opacity: 0, transform: "translate3d(1.5rem, 0, 0)" }
        }
        initial={
          shouldReduceMotion
            ? { opacity: 0 }
            : { opacity: 0, transform: "translate3d(2rem, 0, 0)" }
        }
        role="dialog"
        transition={{
          duration: shouldReduceMotion ? 0.08 : 0.22,
          ease: [0.23, 1, 0.32, 1],
        }}
      >
        <header
          className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3.5"
          data-testid="buti-assistant-header"
        >
          <ButiMascot
            activity={activity}
            className="size-10"
            match={butiInsight.match}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-foreground">
              Buti
            </h2>
            <p className="truncate text-xs text-muted">
              Conoce tus gustos y tu biblioteca
            </p>
          </div>
          <Button
            aria-label="Nueva conversación"
            className="shrink-0 px-3 min-[980px]:hidden"
            onClick={startNewConversation}
            size={CONTROL_SIZE.SM}
            variant={BUTTON_VARIANT.OUTLINE}
          >
            Nueva
          </Button>
          <Button
            aria-label="Cerrar asistente de Buti"
            autoFocus
            className="shrink-0 border border-border"
            onClick={onClose}
            size={CONTROL_SIZE.SM}
            variant={BUTTON_VARIANT.ICON}
          >
            <CloseIcon className="size-5" />
          </Button>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[980px]:[scrollbar-width:auto] min-[980px]:[&::-webkit-scrollbar]:block"
          data-testid="buti-conversation-scroll"
          ref={conversationScrollRef}
        >
          <section aria-label="Conversación con Buti">
            <div className="rounded-lg border border-primary/25 bg-primary/8 px-4 py-3.5 text-sm leading-6 text-foreground/90">
              {butiInsight.opinion}
            </div>

            <p className="mt-4 text-sm text-muted">
              Preguntame por esta película o pedime otra cosa.
            </p>

            <div
              aria-label="Sugerencias rápidas"
              className="mt-4 flex flex-wrap gap-2"
              role="group"
            >
              {QUICK_PROMPTS.map((prompt) => (
                <Button
                  className="w-auto rounded-full px-3 text-xs hover:border-primary hover:bg-transparent hover:text-primary"
                  disabled={pending}
                  key={prompt}
                  onClick={() => submitPrompt(prompt)}
                  size={CONTROL_SIZE.SM}
                  variant={BUTTON_VARIANT.OUTLINE}
                >
                  {prompt}
                </Button>
              ))}
            </div>

            {turns.length > 0 ? (
              <ol className="mt-6 space-y-3">
                {turns.map((turn) => (
                  <li className="space-y-4" key={turn.id}>
                    <div className="ml-8 rounded-lg rounded-br-sm bg-primary px-3.5 py-3 text-sm leading-6 text-primary-foreground">
                      {turn.user.content}
                    </div>
                    {turn.assistant ? (
                      <div className="mr-5 rounded-lg border border-border bg-surface px-3.5 py-3 text-sm leading-6 text-foreground/90">
                        {turn.assistant.content}
                      </div>
                    ) : null}
                    {/* What the recommender actually returned for this turn,
                     * rather than the deck that happened to be on screen. */}
                    <CompactRecommendationRow movies={turn.movies} />
                  </li>
                ))}
              </ol>
            ) : null}

            {pending ? (
              <p className="mt-4 text-sm text-muted" role="status">
                Buti está pensando…
              </p>
            ) : null}

            {error ? (
              <p
                className="mt-4 rounded-lg border border-border bg-surface-muted p-4 text-sm text-foreground"
                role="alert"
              >
                Buti no pudo responder. Probá de nuevo en un momento.
              </p>
            ) : null}
          </section>
        </div>

        <form
          aria-label="Consultar a Buti"
          className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-4 py-3"
          data-testid="buti-assistant-composer"
          onSubmit={handleSubmit}
        >
          <Input
            aria-label="Preguntale a Buti"
            autoComplete="off"
            className="min-h-11 rounded-md px-3 text-sm"
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Preguntale a Buti..."
            value={draft}
          />
          <Button
            aria-label="Enviar consulta"
            className="shrink-0"
            disabled={!draft.trim() || pending}
            size={CONTROL_SIZE.SM}
            type="submit"
            variant={BUTTON_VARIANT.ICON}
          >
            <ArrowIcon className="size-5" />
          </Button>
        </form>
      </motion.aside>
    </motion.div>
  );
}
