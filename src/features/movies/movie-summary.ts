import type { MovieDetail, MovieSummary } from "@/contracts";

/** The catalog only exposes a detail lookup by id, and lists want the summary
 * shape. Shared because three places were doing this same flattening, and the
 * genre ids that arrive as objects have to come back as ids in all of them. */
export function toMovieSummary(detail: MovieDetail): MovieSummary {
  return {
    id: detail.id,
    title: detail.title,
    originalTitle: detail.originalTitle,
    overview: detail.overview,
    posterPath: detail.posterPath,
    backdropPath: detail.backdropPath,
    genreIds: detail.genres.map((genre) => genre.id),
    releaseDate: detail.releaseDate,
    originalLanguage: detail.originalLanguage,
    tmdbRating: detail.tmdbRating,
    tmdbVoteCount: detail.tmdbVoteCount,
  };
}
