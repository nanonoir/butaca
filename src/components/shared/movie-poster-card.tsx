import type { ReactNode } from "react";

export interface MoviePosterCardProps {
  title: string;
  year?: string;
  poster: ReactNode;
  presentationSlot?: ReactNode;
}

export function MoviePosterCard({
  title,
  year,
  poster,
  presentationSlot,
}: MoviePosterCardProps) {
  return (
    <article className="group flex min-w-0 flex-col gap-3">
      <figure className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-muted">
        {poster}
        {presentationSlot ? (
          <div className="absolute inset-x-3 bottom-3 flex justify-end">
            {presentationSlot}
          </div>
        ) : null}
      </figure>
      <div className="min-w-0">
        <h3 className="truncate font-display text-lg font-medium leading-tight text-foreground">
          {title}
        </h3>
        {year ? <p className="mt-1 text-sm text-muted">{year}</p> : null}
      </div>
    </article>
  );
}
