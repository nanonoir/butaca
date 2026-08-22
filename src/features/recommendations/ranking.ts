import type { MovieSummary } from "@/contracts";

import type { TasteProfile } from "./taste-profile";

/** Ratings only break ties between movies the profile likes equally well, so
 * the ranking stays a taste match rather than a popularity chart. */
const RATING_WEIGHT = 0.2;
const VOTE_CONFIDENCE_VOTES = 1_000;
const MAX_RATING = 10;

export type ScoredMovie = {
  movie: MovieSummary;
  score: number;
};

/** A movie with 3 votes and a 10 average is not better evidence than one with
 * 4_000 votes and an 8, so the rating is damped by how many votes back it. */
function qualityPrior(movie: MovieSummary): number {
  const confidence = Math.min(movie.tmdbVoteCount / VOTE_CONFIDENCE_VOTES, 1);

  return (movie.tmdbRating / MAX_RATING) * confidence * RATING_WEIGHT;
}

export function scoreMovie(movie: MovieSummary, profile: TasteProfile): number {
  const genreScore = movie.genreIds.reduce(
    (total, genreId) => total + (profile.genreWeights[genreId] ?? 0),
    0,
  );

  return genreScore + qualityPrior(movie);
}

/** Ranking is ours, not the provider's: TMDB supplies candidates and this
 * decides the order. Ties fall back to the movie id so the batch is stable
 * between identical requests. */
export function rankMovies(
  movies: MovieSummary[],
  profile: TasteProfile,
  limit: number,
): MovieSummary[] {
  return movies
    .map<ScoredMovie>((movie) => ({ movie, score: scoreMovie(movie, profile) }))
    .sort(
      (left, right) =>
        right.score - left.score || left.movie.id - right.movie.id,
    )
    .slice(0, limit)
    .map(({ movie }) => movie);
}

export function excludeMovies(
  movies: MovieSummary[],
  excludedMovieIds: Iterable<number>,
): MovieSummary[] {
  const excluded = new Set(excludedMovieIds);
  const seen = new Set<number>();

  return movies.filter((movie) => {
    // Candidate pages overlap, so duplicates are dropped here too.
    if (excluded.has(movie.id) || seen.has(movie.id)) {
      return false;
    }

    seen.add(movie.id);

    return true;
  });
}
