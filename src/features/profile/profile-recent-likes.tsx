import Link from "next/link";

import type { LikedMovieItem } from "@/contracts/likes";
import { MovieArtwork } from "@/components/shared/movie-artwork";
import { movieDetailPath } from "@/features/movie-detail/movie-slug";

interface ProfileRecentLikesProps {
  items: LikedMovieItem[];
}

/** The profile was avatar, chips, three numbers and text -- not one poster, in
 * an app about films. These are the last few, as a door into the library
 * rather than a second copy of it.
 *
 * Links rather than buttons that fetch: the detail has an address now, so
 * these are addresses. Opening one in a new tab works, and so does the middle
 * mouse button somebody uses without thinking about it. */
export function ProfileRecentLikes({ items }: ProfileRecentLikesProps) {
  if (items.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-border bg-surface-elevated p-6 text-sm leading-6 text-muted">
        Todavía no marcaste ninguna con me gusta. Las que elijas en Descubrir
        aparecen acá.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
        {items.map((item) => (
          <li className="min-w-0" key={item.movie.id}>
            <Link
              aria-label={`Ver ${item.movie.title}`}
              className="group block w-full focus-visible:outline-none"
              href={movieDetailPath(item.movie.id, item.movie.title)}
            >
              <MovieArtwork
                className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-border transition-[border-color] duration-fast ease-ui group-hover:border-primary/60 group-focus-visible:border-primary"
                movie={item.movie}
              />
              <p className="mt-2 line-clamp-2 text-xs leading-4 text-muted transition-colors duration-fast ease-ui group-hover:text-foreground">
                {item.movie.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        className="mt-4 inline-flex text-sm font-medium text-primary transition-colors duration-fast ease-ui hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/liked"
      >
        Ver toda la biblioteca
      </Link>
    </>
  );
}
