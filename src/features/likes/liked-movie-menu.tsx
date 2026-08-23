"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface LikedMovieMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

interface LikedMovieMenuProps {
  title: string;
  actions: readonly LikedMovieMenuAction[];
  disabled?: boolean;
}

function DotsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-6" fill="currentColor" viewBox="0 0 24 16">
      <circle cx="5" cy="8" r="1.25" />
      <circle cx="12" cy="8" r="1.25" />
      <circle cx="19" cy="8" r="1.25" />
    </svg>
  );
}

/** The dots were a decorative glyph. They are the control now, and the only
 * one: no plus that turns into a cross, just the same three dots the card
 * always had, with the actions unfolding from them.
 *
 * The card underneath is one big button, so every press here stops before it
 * reaches the surface that would open the detail overlay. */
export function LikedMovieMenu({
  title,
  actions,
  disabled = false,
}: LikedMovieMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      className="relative"
      onClick={(event) => event.stopPropagation()}
      ref={container}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Acciones para ${title}`}
        className="mb-1 inline-flex h-7 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-ui hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-surface-muted aria-expanded:text-foreground disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <DotsIcon />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="absolute bottom-full right-0 z-30 mb-2 flex flex-col items-end gap-2"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="menu"
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.12 }}
          >
            {/* Listed order reads top to bottom, and the stagger runs the other
             * way: the one nearest the dots arrives first, so the stack unfolds
             * out of the trigger rather than appearing all at once. */}
            {actions.map((action, index) => (
              <motion.button
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="inline-flex w-max items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface-elevated px-3.5 py-2 text-sm font-medium text-foreground shadow-floating transition-colors duration-fast ease-ui hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.9, y: 6 }
                }
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.9, y: 10 }
                }
                key={action.id}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                role="menuitem"
                transition={{
                  delay: shouldReduceMotion
                    ? 0
                    : (actions.length - 1 - index) * 0.045,
                  duration: shouldReduceMotion ? 0.01 : 0.18,
                  ease: [0.23, 1, 0.32, 1],
                }}
                type="button"
              >
                <span aria-hidden="true" className="text-muted-foreground">
                  {action.icon}
                </span>
                {action.label}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
