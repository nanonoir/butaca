import {
  getTmdbImageUrl,
  TMDB_IMAGE_SIZE,
} from "@/integrations/tmdb/image-url";

interface MovieArtworkSource {
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
}

interface MovieArtworkProps {
  movie: MovieArtworkSource;
  kind?: "poster" | "backdrop";
  className?: string;
}

function getArtworkUrl(
  movie: MovieArtworkSource,
  kind: NonNullable<MovieArtworkProps["kind"]>,
) {
  if (kind === "backdrop") {
    return getTmdbImageUrl(
      movie.backdropPath ?? movie.posterPath,
      movie.backdropPath ? TMDB_IMAGE_SIZE.BACKDROP : TMDB_IMAGE_SIZE.POSTER,
    );
  }

  return getTmdbImageUrl(
    movie.posterPath ?? movie.backdropPath,
    movie.posterPath ? TMDB_IMAGE_SIZE.POSTER : TMDB_IMAGE_SIZE.BACKDROP,
  );
}

export function MovieArtwork({
  movie,
  kind = "poster",
  className = "",
}: MovieArtworkProps) {
  const imageUrl = getArtworkUrl(movie, kind);
  const backgroundImage = imageUrl
    ? `url("${imageUrl}")`
    : "repeating-linear-gradient(135deg, transparent 0, transparent 12px, var(--border) 12px, var(--border) 13px)";
  const label = kind === "backdrop" ? "Backdrop" : "Póster";

  return (
    <div
      aria-label={`${label} de ${movie.title}`}
      className={`bg-surface-muted bg-cover bg-center ${className}`}
      role="img"
      style={{ backgroundImage }}
    />
  );
}
