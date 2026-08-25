"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";

interface InlineMovieSearchProps {
  draft: string;
  submittedQuery: string | null;
  isLoading: boolean;
  isOpen: boolean;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onOpenChange: (isOpen: boolean) => void;
  layoutId: string;
  inputId: string;
  triggerId?: string;
  showFieldLabel?: boolean;
  helperText?: string;
  triggerLabel?: string;
  clearLabel?: string;
  searchAriaLabel?: string;
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

export function InlineMovieSearch({
  draft,
  submittedQuery,
  isLoading,
  isOpen,
  onDraftChange,
  onSubmit,
  onClear,
  onOpenChange,
  layoutId,
  inputId,
  triggerId,
  showFieldLabel = false,
  helperText,
  triggerLabel = "Abrir buscador de películas",
  clearLabel = "Limpiar búsqueda",
  searchAriaLabel = "Buscar películas",
}: InlineMovieSearchProps) {
  const shouldReduceMotion = useReducedMotion();
  const wasOpen = useRef(isOpen);
  const helperId = `${inputId}-help`;
  const resolvedTriggerId = triggerId ?? `${inputId}-trigger`;
  const canClear = submittedQuery !== null && draft === submittedQuery;
  const transition = {
    layout: {
      duration: shouldReduceMotion ? 0.01 : 0.2,
      ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
    },
  };

  useEffect(() => {
    if (!isOpen && wasOpen.current) {
      queueMicrotask(() =>
        document.getElementById(resolvedTriggerId)?.focus(),
      );
    }

    wasOpen.current = isOpen;
  }, [isOpen, resolvedTriggerId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoading) {
      onSubmit();
    }
  }

  function clearAndClose() {
    onClear();
    onOpenChange(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearAndClose();
    }
  }

  return (
    <div className={isOpen && (showFieldLabel || helperText) ? "space-y-2" : undefined}>
      {isOpen && showFieldLabel ? (
        <label className="block text-sm font-medium text-foreground" htmlFor={inputId}>
          Buscar películas
        </label>
      ) : null}
      <AnimatePresence initial={false} mode="popLayout">
        {isOpen ? (
          <motion.form
            aria-label={searchAriaLabel}
            className="flex w-full items-center rounded-full border border-primary/25 bg-primary/5 pl-1 text-primary transition-[background-color,border-color] duration-ui ease-ui focus-within:border-primary/45 focus-within:bg-primary/10 sm:w-[min(100%,26rem)]"
            key="inline-movie-search-form"
            layoutId={layoutId}
            onSubmit={handleSubmit}
            role="search"
            transition={transition}
          >
            <div className="relative min-w-0 flex-1">
              {showFieldLabel ? null : (
                <label className="sr-only" htmlFor={inputId}>
                  Buscar películas
                </label>
              )}
              <input
                aria-describedby={isOpen && helperText ? helperId : undefined}
                autoFocus
                className="min-h-11 w-full rounded-full border-0 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted md:text-sm"
                id={inputId}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar películas"
                value={draft}
              />
            </div>
            {canClear ? (
              <Button
                aria-label={clearLabel}
                className="shrink-0 rounded-full text-primary hover:bg-primary/10 hover:text-primary-hover"
                onClick={clearAndClose}
                size={CONTROL_SIZE.MD}
                type="button"
                variant={BUTTON_VARIANT.ICON}
              >
                <CrossIcon className="size-5" />
              </Button>
            ) : (
              <Button
                aria-label="Buscar películas"
                className="shrink-0 rounded-full text-primary hover:bg-primary/10 hover:text-primary-hover"
                disabled={isLoading}
                size={CONTROL_SIZE.MD}
                type="submit"
                variant={BUTTON_VARIANT.ICON}
              >
                <SearchIcon className="size-4" />
              </Button>
            )}
          </motion.form>
        ) : (
          <motion.div
            className="w-full sm:w-auto"
            key="inline-movie-search-trigger"
            layoutId={layoutId}
            transition={transition}
          >
            <Button
              aria-expanded={isOpen}
              aria-label={triggerLabel}
              className="w-full rounded-full border-primary/25 bg-primary/5 px-4 text-primary hover:border-primary/45 hover:bg-primary/10 aria-expanded:border-primary/45 aria-expanded:bg-primary/15 sm:w-auto"
              onClick={() => onOpenChange(true)}
              id={resolvedTriggerId}
              size={CONTROL_SIZE.SM}
              variant={BUTTON_VARIANT.OUTLINE}
            >
              <SearchIcon className="size-4" />
              Buscar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {isOpen && helperText ? (
        <p className="text-sm text-muted" id={helperId}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
