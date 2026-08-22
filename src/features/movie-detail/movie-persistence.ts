import type { MovieReaction, UpsertReviewRequest, Review } from "@/contracts";
import {
  removeMovieReaction,
  setMovieReaction,
  setMovieWatched,
} from "@/features/interactions/interaction-client";
import {
  deleteMovieReview,
  upsertMovieReview,
} from "@/features/reviews/review-client";

export interface MovieDetailPersistence {
  setReaction: (reaction: MovieReaction) => Promise<unknown>;
  clearReaction: () => Promise<unknown>;
  setWatched: (watched: boolean) => Promise<unknown>;
  saveReview: (draft: UpsertReviewRequest) => Promise<Review>;
  deleteReview: () => Promise<unknown>;
}

export type CreateMoviePersistence = (
  movieId: number,
) => MovieDetailPersistence;

/** Built per movie id rather than per screen. Binding it to a single id was
 * what forced the detail modal to disable writes while browsing a similar
 * movie: the calls would have been attributed to the movie the modal opened
 * with. */
export const createMoviePersistence: CreateMoviePersistence = (movieId) => ({
  setReaction: (reaction) => setMovieReaction(movieId, reaction),
  clearReaction: () => removeMovieReaction(movieId),
  setWatched: (watched) => setMovieWatched(movieId, watched),
  saveReview: (draft) => upsertMovieReview(movieId, draft),
  deleteReview: () => deleteMovieReview(movieId),
});
