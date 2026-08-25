import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface MoviePosterCardProps {
  title: string;
  year?: string;
  poster: ReactNode;
  presentationSlot?: ReactNode;
  metadataSlot?: ReactNode;
  expansionSlot?: ReactNode;
  articleLabel?: string;
  actionLabel?: string;
  pressed?: boolean;
  onSelect?: () => void;
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function MoviePosterCard({
  title,
  year,
  poster,
  presentationSlot,
  metadataSlot,
  expansionSlot,
  articleLabel,
  actionLabel,
  pressed,
  onSelect,
}: MoviePosterCardProps) {
  return (
    <article
      aria-label={articleLabel}
      className="group relative flex min-w-0 flex-col gap-3"
    >
      <figure
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-lg border bg-surface-muted transition-[border-color,box-shadow] duration-fast ease-ui",
          // A picked movie has to read as picked at a glance, from across the
          // grid: the ring survives whatever artwork is behind it.
          pressed
            ? "border-primary ring-2 ring-primary"
            : "border-border group-hover:border-primary/50",
        )}
      >
        {poster}
        {/* The hover tint lives inside the frame. It used to be painted by the
         * click target, which spans the whole card, so hovering washed over the
         * title and year as well and read as a smudge rather than a highlight. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 transition-colors duration-fast ease-ui",
            pressed
              ? "bg-primary/20"
              : "bg-transparent group-hover:bg-primary/10 group-active:bg-primary/20",
          )}
        />
        {pressed ? (
          <span
            className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-floating"
            data-testid="movie-poster-selected"
          >
            <CheckIcon />
          </span>
        ) : null}
        {presentationSlot ? (
          <div className="absolute inset-x-3 bottom-3 flex justify-end">
            {presentationSlot}
          </div>
        ) : null}
      </figure>
      <div className="flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "line-clamp-2 font-display text-lg font-medium leading-tight transition-colors duration-fast ease-ui",
              pressed
                ? "text-primary"
                : "text-foreground group-hover:text-primary",
            )}
          >
            {title}
          </h3>
          {year ? <p className="mt-1 text-sm text-muted">{year}</p> : null}
        </div>
        {/* Above the click target, which covers the whole tile. A slot meant for
         * controls is useless if the card's own button swallows every press. */}
        {metadataSlot ? (
          <div className="relative z-20 shrink-0">{metadataSlot}</div>
        ) : null}
      </div>
      {/* In flow, under the title row: whatever opens here grows the card and
       * moves the grid down rather than covering the tile below it. */}
      {expansionSlot ? (
        <div className="relative z-20">{expansionSlot}</div>
      ) : null}
      {onSelect ? (
        <button
          aria-label={actionLabel ?? `Ver detalle de ${title}`}
          aria-pressed={pressed}
          // Nothing is painted here any more: the frame reacts instead, so the
          // title and year stay legible while the pointer is over the card.
          className="absolute inset-0 z-10 cursor-pointer rounded-lg bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={onSelect}
          type="button"
        />
      ) : null}
    </article>
  );
}
