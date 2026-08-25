import "server-only";

import type { MovieDetail } from "@/contracts";

import type {
  ReviewRepository,
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import { TMDB_LANGUAGE } from "../../integrations/tmdb/config";
import type { TmdbAdapter } from "../../integrations/tmdb";

import { buildTasteProfile, type TasteProfile } from "./taste-profile";

/** Reactions are read as a recent window: what somebody is into right now is
 * the useful thing, and an old enthusiasm going quiet is the point. */
const REACTION_WINDOW_PAGE = 1;
/** People are not. A taste in them accumulates over years and the repository
 * counts it in one query, so there is no window to choose. */
const MAX_PEOPLE = 8;

export type TasteProfilePorts = {
  interactions: Pick<
    UserMovieInteractionRepository,
    | "findLikesByUser"
    | "findDislikesByUser"
    | "findTopCastByUser"
    | "findTopDirectorsByUser"
  >;
  preferences: Pick<UserPreferencesRepository, "findByUserId">;
  reviews: Pick<ReviewRepository, "findByUser">;
  catalog: Pick<TmdbAdapter, "getMovieDetail">;
};

/** Assembles everything the taste profile is read from. Two callers need it --
 * the deck and the profile screen that explains the deck -- and they must not
 * be able to drift into reading the viewer differently. */
export type LoadedTasteProfile = {
  profile: TasteProfile;
  /** Films the viewer said yes to, however they said it. The screen that
   * explains the profile needs to know whether there was enough to read, and
   * it must count what the profile actually counted. */
  positiveSignals: number;
};

export async function loadTasteProfile(
  userId: string,
  ports: TasteProfilePorts,
): Promise<LoadedTasteProfile> {
  const [preferences, liked, disliked, reviews, cast, crew] = await Promise.all(
    [
      ports.preferences.findByUserId(userId),
      ports.interactions.findLikesByUser(userId, REACTION_WINDOW_PAGE),
      ports.interactions.findDislikesByUser(userId, REACTION_WINDOW_PAGE),
      ports.reviews.findByUser(userId),
      ports.interactions.findTopCastByUser(userId, TMDB_LANGUAGE, MAX_PEOPLE),
      ports.interactions.findTopDirectorsByUser(
        userId,
        TMDB_LANGUAGE,
        MAX_PEOPLE,
      ),
    ],
  );

  // A reviewed film is spoken for. Its reaction is dropped rather than added
  // to, so the same opinion is not paid twice.
  const reviewedIds = new Set(reviews.map((review) => review.movieId));
  const unreviewed = (records: UserMovieInteractionRecord[]) =>
    records.filter((record) => !reviewedIds.has(record.movieId));

  const [likedDetails, dislikedDetails, reviewedDetails] = await Promise.all([
    resolveDetails(ports, unreviewed(liked).map((record) => record.movieId)),
    resolveDetails(ports, unreviewed(disliked).map((record) => record.movieId)),
    resolveDetails(ports, reviews.map((review) => review.movieId)),
  ]);
  const verdictById = new Map(
    reviews.map((review) => [review.movieId, review.verdict]),
  );

  const reviewed = reviewedDetails.filter(
    (movie) => verdictById.get(movie.id) === "RECOMMENDED",
  );

  return {
    profile: buildTasteProfile({
      preferredGenreIds: preferences?.preferredGenreIds ?? [],
      liked: likedDetails,
      disliked: dislikedDetails,
      reviewed,
      panned: reviewedDetails.filter(
        (movie) => verdictById.get(movie.id) === "NOT_WORTH_IT",
      ),
      cast,
      crew,
    }),
    positiveSignals: likedDetails.length + reviewed.length,
  };
}

/** A movie the provider can no longer resolve drops out rather than failing
 * the profile: one retired title must not empty somebody's taste. */
async function resolveDetails(
  ports: TasteProfilePorts,
  movieIds: number[],
): Promise<MovieDetail[]> {
  const results = await Promise.allSettled(
    movieIds.map((movieId) => ports.catalog.getMovieDetail(movieId)),
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<MovieDetail> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
}
