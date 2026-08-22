import type { ReactNode } from "react";

export interface MoviePosterCardProps {
  title: string;
  year?: string;
  poster: ReactNode;
  presentationSlot?: ReactNode;
  metadataSlot?: ReactNode;
  articleLabel?: string;
  actionLabel?: string;
  pressed?: boolean;
  onSelect?: () => void;
}

export function MoviePosterCard({
  title,
  year,
  poster,
  presentationSlot,
  metadataSlot,
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
      <figure className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-muted">
        {poster}
        {presentationSlot ? (
          <div className="absolute inset-x-3 bottom-3 flex justify-end">
            {presentationSlot}
          </div>
        ) : null}
      </figure>
      <div className="flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-lg font-medium leading-tight text-foreground">
            {title}
          </h3>
          {year ? <p className="mt-1 text-sm text-muted">{year}</p> : null}
        </div>
        {metadataSlot ? <div className="shrink-0">{metadataSlot}</div> : null}
      </div>
      {onSelect ? (
        <button
          aria-label={actionLabel ?? `Ver detalle de ${title}`}
          aria-pressed={pressed}
          className="absolute inset-0 z-10 cursor-pointer rounded-lg bg-transparent transition-[background-color,box-shadow] duration-fast ease-ui hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-primary/10"
          onClick={onSelect}
          type="button"
        />
      ) : null}
    </article>
  );
}
