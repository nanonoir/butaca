"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

import {
  BUTI_ACTIVITY,
  ButiMascot,
  type ButiActivity,
} from "@/components/shared/buti-mascot";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MovieSummary } from "@/contracts/movies";

import { getButiInsight } from "./buti-recommendation";

const QUICK_PROMPTS = [
  "¿Por qué esta?",
  "Ciencia ficción corta",
  "Algo intenso para esta noche",
  "Algo para reírme",
] as const;

interface DrawerMessage {
  content: string;
  id: string;
  role: "assistant" | "user";
}

interface ButiAssistantDrawerProps {
  movie: MovieSummary;
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

export function ButiAssistantDrawer({
  movie,
  onClose,
}: ButiAssistantDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const insight = getButiInsight(movie);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DrawerMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [activity, setActivity] = useState<ButiActivity>(BUTI_ACTIVITY.IDLE);
  const messageSequence = useRef(0);
  const replyTimer = useRef<number | null>(null);

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

      if (replyTimer.current !== null) {
        window.clearTimeout(replyTimer.current);
      }
    };
  }, [onClose]);

  function submitPrompt(prompt: string) {
    const content = prompt.trim();

    if (!content || pending) {
      return;
    }

    messageSequence.current += 1;
    const sequence = messageSequence.current;

    setMessages((currentMessages) => [
      ...currentMessages,
      { content, id: `drawer-user-${sequence}`, role: "user" },
    ]);
    setDraft("");
    setPending(true);
    setActivity(BUTI_ACTIVITY.TALKING);

    replyTimer.current = window.setTimeout(() => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content: `La recomiendo porque conecta con tus gustos: ${insight.opinion}`,
          id: `drawer-assistant-${sequence}`,
          role: "assistant",
        },
      ]);
      setPending(false);
      setActivity(BUTI_ACTIVITY.JUMPING);
      replyTimer.current = null;
    }, 550);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(draft);
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
        className="absolute inset-x-2 bottom-2 flex h-[min(88dvh,46rem)] flex-col overflow-hidden rounded-xl border border-primary/25 bg-surface-elevated shadow-floating sm:inset-y-2 sm:left-auto sm:right-2 sm:h-auto sm:w-[21rem]"
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
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3.5">
          <ButiMascot
            activity={activity}
            className="size-10"
            match={insight.match}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <section aria-label="Conversación con Buti">
            <div className="rounded-lg border border-primary/25 bg-primary/8 px-4 py-3.5 text-sm leading-6 text-foreground/90">
              {insight.opinion}
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

            {messages.length > 0 ? (
              <ol className="mt-6 space-y-3">
                {messages.map((message) => (
                  <li
                    className={
                      message.role === "user"
                        ? "ml-8 rounded-lg rounded-br-sm bg-primary px-3.5 py-3 text-sm leading-6 text-primary-foreground"
                        : "mr-5 rounded-lg border border-border bg-surface px-3.5 py-3 text-sm leading-6 text-foreground/90"
                    }
                    key={message.id}
                  >
                    {message.content}
                  </li>
                ))}
              </ol>
            ) : null}

            {pending ? (
              <p className="mt-4 text-sm text-muted" role="status">
                Buti está pensando…
              </p>
            ) : null}
          </section>
        </div>

        <form
          aria-label="Consultar a Buti"
          className="flex items-center gap-2 border-t border-border bg-surface px-4 py-3"
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
