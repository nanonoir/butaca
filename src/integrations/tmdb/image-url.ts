const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const TMDB_IMAGE_SIZE = {
  POSTER: "w780",
  BACKDROP: "w1280",
} as const;

type TmdbImageSize = (typeof TMDB_IMAGE_SIZE)[keyof typeof TMDB_IMAGE_SIZE];

export function getTmdbImageUrl(path: string | null, size: TmdbImageSize) {
  if (!path) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${TMDB_IMAGE_BASE_URL}/${size}${normalizedPath}`;
}
