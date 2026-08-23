"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface LikedMovieMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

/** Marks both halves of one card's menu. The dots and the list they open sit in
 * different slots of the card, so a press counts as "inside" by carrying this
 * rather than by living under one shared node. */
export function menuAttributes(movieId: number) {
  return { "data-liked-menu": String(movieId) } as const;
}

export function menuPanelId(movieId: number) {
  return `liked-menu-${movieId}`;
}

function DotsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-6"
      fill="currentColor"
      viewBox="0 0 24 16"
    >
      <circle cx="5" cy="8" r="1.25" />
      <circle cx="12" cy="8" r="1.25" />
      <circle cx="19" cy="8" r="1.25" />
    </svg>
  );
}

interface LikedMovieMenuTriggerProps {
  movieId: number;
  title: string;
  open: boolean;
  onToggle: () => void;
}

/** The dots were a decorative glyph. They are the control now, and the only
 * one: no plus that turns into a cross, just the same three dots the card
 * always had.
 *
 * The card underneath is one big button, so the press stops here instead of
 * reaching the surface that would open the detail overlay. */
export function LikedMovieMenuTrigger({
  movieId,
  title,
  open,
  onToggle,
}: LikedMovieMenuTriggerProps) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      {...menuAttributes(movieId)}
    >
      <button
        aria-controls={menuPanelId(movieId)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Acciones para ${title}`}
        className="mb-1 inline-flex h-7 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-ui hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-surface-muted aria-expanded:text-foreground"
        onClick={onToggle}
        type="button"
      >
        <DotsIcon />
      </button>
    </div>
  );
}

interface LikedMovieMenuPanelProps {
  movieId: number;
  title: string;
  open: boolean;
  actions: readonly LikedMovieMenuAction[];
}

/** Unfolds under the title, in the flow of the card. The height is animated
 * along with the items so the grid is pushed down over the same moment rather
 * than jumping to make room before anything is there to fill it. */
export function LikedMovieMenuPanel({
  movieId,
  title,
  open,
  actions,
}: LikedMovieMenuPanelProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          initial={
            shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
          }
          key={menuPanelId(movieId)}
          onClick={(event) => event.stopPropagation()}
          transition={{
            duration: shouldReduceMotion ? 0.01 : 0.24,
            ease: [0.23, 1, 0.32, 1],
          }}
          {...menuAttributes(movieId)}
        >
          <div
            aria-label={`Acciones para ${title}`}
            className="flex flex-col gap-2 pt-3"
            id={menuPanelId(movieId)}
            role="menu"
          >
            {/* The stagger runs downward, away from the dots, so the list reads
             * as coming out of the control that opened it. */}
            {actions.map((action, index) => (
              <motion.button
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="inline-flex w-full items-center gap-2 rounded-full border border-border bg-surface-elevated px-3.5 py-2 text-left text-sm font-medium text-foreground shadow-floating transition-colors duration-fast ease-ui hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: -6 }
                }
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: -8 }
                }
                key={action.id}
                onClick={action.onSelect}
                role="menuitem"
                transition={{
                  delay: shouldReduceMotion ? 0 : index * 0.045,
                  duration: shouldReduceMotion ? 0.01 : 0.18,
                  ease: [0.23, 1, 0.32, 1],
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                >
                  {action.icon}
                </span>
                {action.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
