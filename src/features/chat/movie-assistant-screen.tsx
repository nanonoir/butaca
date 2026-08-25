"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import {
  toChatTurns,
  toContractMessages,
  type ChatTurn,
  type ChatUiMessage,
} from "./chat-turns";

import {
  BUTI_ACTIVITY,
  BUTI_MATCH,
  ButiMascot,
} from "@/components/shared/buti-mascot";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { MoviePosterCard } from "@/components/shared/movie-poster-card";
import { movieDetailPath } from "@/features/movie-detail/movie-slug";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMovie } from "@/contracts/chat";

const SUGGESTED_PROMPTS = [
  "Algo para reírme",
  "Ciencia ficción corta",
  "Algo parecido a Dune",
  "Una película para ver en pareja",
  "Algo intenso para esta noche",
  "Una película poco conocida",
] as const;

const MESSAGE_SCROLL_MARGIN = 24;

interface IconProps {
  className?: string;
}

function ArrowIcon({ className }: IconProps) {
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

function StarIcon({ className }: IconProps) {
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

function AssistantHeader() {
  return (
    <header className="shrink-0 border-b border-border px-5 py-4 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
        <ButiMascot className="size-11" match={BUTI_MATCH.MEDIUM} />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-tight text-foreground">
            Asistente de películas
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Conoce tus gustos y tu biblioteca
          </p>
        </div>
      </div>
    </header>
  );
}

function InitialPromptState({
  onPromptSelect,
}: {
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <section
      aria-labelledby="assistant-question"
      className="w-full py-8 sm:py-12"
    >
      <div className="max-w-2xl">
        <h2
          className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl"
          id="assistant-question"
        >
          ¿Qué querés ver hoy?
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg">
          Pedime por ánimo, duración, compañía o parecido con otra película. Uso
          tus gustos y lo que ya viste.
        </p>
      </div>

      <div
        aria-label="Consultas sugeridas"
        className="mt-8 flex flex-wrap gap-3"
        role="group"
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Button
            className="w-auto rounded-full px-5 text-sm hover:border-primary hover:bg-transparent hover:text-primary sm:min-h-14 sm:px-6 sm:text-base"
            key={prompt}
            onClick={() => onPromptSelect(prompt)}
            variant={BUTTON_VARIANT.OUTLINE}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({ movie }: { movie: ChatMovie }) {
  const year = movie.releaseDate?.slice(0, 4);

  return (
    <MoviePosterCard
      actionLabel={`Ver detalle de ${movie.title}`}
      articleLabel={`Recomendación: ${movie.title}`}
      href={movieDetailPath(movie.id, movie.title)}
      poster={<MovieArtwork className="size-full" movie={movie} />}
      presentationSlot={
        <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1.5 font-mono text-[0.625rem] text-primary shadow-floating backdrop-blur-sm">
          <StarIcon className="size-3" />
          {movie.tmdbRating.toFixed(1)} TMDB
        </span>
      }
      title={movie.title}
      year={year}
    />
  );
}

function Conversation({ turns }: { turns: ChatTurn[] }) {
  return (
    <section aria-label="Conversación" className="w-full">
      <ol className="space-y-12">
        {turns.map((turn, index) => (
          <li className="space-y-7" key={turn.id}>
            <div className="ml-auto max-w-2xl rounded-xl rounded-br-sm bg-primary px-5 py-4 text-primary-foreground sm:px-6">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] opacity-70">
                Vos
              </p>
              <p className="mt-2 text-base leading-7">{turn.user.content}</p>
            </div>

            <div
              className="flex items-start gap-3 sm:gap-4"
              data-testid={
                index === turns.length - 1 ? "latest-buti-message" : undefined
              }
            >
              <ButiMascot
                activity={
                  turn.assistant ? BUTI_ACTIVITY.JUMPING : BUTI_ACTIVITY.TALKING
                }
                className="mt-0.5 size-10"
                match={BUTI_MATCH.HIGH}
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-primary">
                  Buti
                </p>
                {turn.assistant ? (
                  <>
                    <p className="mt-2 max-w-3xl text-base leading-7 text-foreground/90">
                      {turn.assistant.content}
                    </p>

                    {turn.movies.length > 0 ? (
                      <ul
                        aria-label="Recomendaciones"
                        className="mt-7 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5"
                      >
                        {turn.movies.map((movie) => (
                          <li
                            className="min-w-0"
                            key={`${turn.id}-${movie.id}`}
                          >
                            <RecommendationCard movie={movie} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted" role="status">
                    Buti está pensando…
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AssistantComposer({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface/95 px-5 pb-[5.75rem] pt-4 backdrop-blur-md sm:px-8 md:pb-4">
      <form
        aria-label="Consultar al asistente"
        className="mx-auto flex w-full max-w-5xl items-center gap-3"
        onSubmit={handleSubmit}
      >
        <Input
          aria-label="Pedime una película"
          autoComplete="off"
          className="min-h-14 rounded-lg px-5 text-base"
          maxLength={4000}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Pedime una película..."
          value={draft}
        />
        <Button
          aria-label="Enviar consulta"
          className="shrink-0"
          disabled={!draft.trim()}
          size={CONTROL_SIZE.LG}
          type="submit"
          variant={BUTTON_VARIANT.ICON}
        >
          <ArrowIcon className="size-5" />
        </Button>
      </form>
    </div>
  );
}

export function MovieAssistantScreen() {
  const [draft, setDraft] = useState("");
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const { messages, sendMessage, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // The route validates the shared request contract, so the parts the SDK
      // keeps are flattened before they travel.
      prepareSendMessagesRequest: ({ messages: uiMessages }) => ({
        body: { messages: toContractMessages(uiMessages as ChatUiMessage[]) },
      }),
    }),
  });
  const turns = toChatTurns(messages as ChatUiMessage[]);
  const messageCount = turns.reduce(
    (count, turn) => count + 1 + (turn.assistant ? 1 : 0),
    0,
  );
  useEffect(() => {
    if (messageCount === 0) {
      return;
    }

    const conversation = conversationScrollRef.current;
    const latestButiMessage = conversation?.querySelector<HTMLElement>(
      '[data-testid="latest-buti-message"]',
    );

    if (
      !conversation ||
      !latestButiMessage ||
      typeof conversation.scrollTo !== "function"
    ) {
      return;
    }

    const conversationTop = conversation.getBoundingClientRect().top;
    const messageTop = latestButiMessage.getBoundingClientRect().top;
    const targetTop = Math.max(
      0,
      conversation.scrollTop +
        messageTop -
        conversationTop -
        MESSAGE_SCROLL_MARGIN,
    );

    conversation.scrollTo({
      behavior: "smooth",
      top: targetTop,
    });
  }, [messageCount]);

  function submitPrompt(prompt: string) {
    const content = prompt.trim();

    if (!content) {
      return;
    }

    setDraft("");
    void sendMessage({ text: content });
  }

  return (
    <div className="-mx-4 -mb-24 -mt-5 flex min-h-[calc(100dvh-1rem)] flex-col md:-mx-8 md:-my-8">
      <div className="flex h-[calc(100dvh-1rem)] min-h-0 flex-col overflow-hidden">
        <AssistantHeader />

        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8 md:py-12"
          data-testid="movie-assistant-conversation-scroll"
          ref={conversationScrollRef}
        >
          <div className="mx-auto w-full max-w-5xl">
            {turns.length === 0 ? (
              <InitialPromptState onPromptSelect={submitPrompt} />
            ) : (
              <Conversation turns={turns} />
            )}

            {error ? (
              <p
                className="mt-8 rounded-lg border border-border bg-surface-muted p-4 text-sm text-foreground"
                role="alert"
              >
                Buti no pudo responder. Probá de nuevo en un momento.
              </p>
            ) : null}
          </div>
        </div>

        <AssistantComposer
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => submitPrompt(draft)}
        />
      </div>
    </div>
  );
}
