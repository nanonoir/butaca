import "server-only";

import type { MovieDetail, MovieSummary } from "@/contracts";

import type {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import type { TmdbAdapter, TmdbDiscoverOptions } from "../../integrations/tmdb";

import { excludeMovies, rankMovies } from "./ranking";
import { buildTasteProfile, type TasteProfile } from "./taste-profile";

export const DISCOVER_BATCH_SIZE = 20;

/** How many of the profile's strongest genres get their own candidate query.
 * TMDB treats a comma separated `with_genres` as AND, so asking for five
 * genres at once returns almost nothing; one query per genre is what produces
 * the union we actually want. */
const CANDIDATE_GENRE_COUNT = 3;

/** Keeps obscure entries with a handful of votes out of the candidate pool
 * before ranking even starts. */
const MIN_CANDIDATE_VOTE_COUNT = 200;

/** Interactions are read one page deep: recent taste is what should drive the
 * next batch, and it also caps how many detail lookups a request performs. */
const PROFILE_INTERACTION_PAGE = 1;

type PreferencesPort = Pick<UserPreferencesRepository, "findByUserId">;

type InteractionsPort = Pick<
  UserMovieInteractionRepository,
  "findLikesByUser" | "findDislikesByUser" | "findReactedMovieIds"
>;

type CatalogPort = Pick<TmdbAdapter, "getMovieDetail" | "discoverMovies">;

export type DiscoverBatch = {
  movies: MovieSummary[];
  batchSize: typeof DISCOVER_BATCH_SIZE;
  returned: number;
};

export class RecommendationService {
  constructor(
    private readonly preferences: PreferencesPort,
    private readonly interactions: InteractionsPort,
    private readonly catalog: CatalogPort,
  ) {}

  async getDiscoverBatch(userId: string): Promise<DiscoverBatch> {
    const [preferences, liked, disliked, reactedMovieIds] = await Promise.all([
      this.preferences.findByUserId(userId),
      this.interactions.findLikesByUser(userId, PROFILE_INTERACTION_PAGE),
      this.interactions.findDislikesByUser(userId, PROFILE_INTERACTION_PAGE),
      this.interactions.findReactedMovieIds(userId),
    ]);
    const [likedDetails, dislikedDetails] = await Promise.all([
      this.resolveDetails(liked),
      this.resolveDetails(disliked),
    ]);
    const profile = buildTasteProfile({
      preferredGenreIds: preferences?.preferredGenreIds ?? [],
      liked: likedDetails,
      disliked: dislikedDetails,
    });
    const candidates = await this.generateCandidates(profile);
    const movies = rankMovies(
      excludeMovies(candidates, reactedMovieIds),
      profile,
      DISCOVER_BATCH_SIZE,
    );

    return {
      movies,
      batchSize: DISCOVER_BATCH_SIZE,
      returned: movies.length,
    };
  }

  /** Detail lookups are served from the movie cache after the first read. One
   * that cannot be resolved is skipped: a retired title should weaken the
   * profile, not fail the whole batch. */
  private async resolveDetails(
    interactions: UserMovieInteractionRecord[],
  ): Promise<MovieDetail[]> {
    const results = await Promise.allSettled(
      interactions.map((interaction) =>
        this.catalog.getMovieDetail(interaction.movieId),
      ),
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<MovieDetail> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }

  /** TMDB generates the candidates; the ranking above decides the order. One
   * query per signal keeps the pool wide enough for the ranking to matter. */
  private async generateCandidates(
    profile: TasteProfile,
  ): Promise<MovieSummary[]> {
    const shared = {
      page: 1,
      excludedGenreIds: profile.excludedGenreIds,
      minTmdbVoteCount: MIN_CANDIDATE_VOTE_COUNT,
    };
    const queries: TmdbDiscoverOptions[] = profile.preferredGenreIds
      .slice(0, CANDIDATE_GENRE_COUNT)
      .map((genreId) => ({ ...shared, genreIds: [genreId] }));
    const [topKeywordId] = profile.keywordIds;
    const [topDirectorId] = profile.crewIds;
    const [topCastId] = profile.castIds;

    if (topKeywordId !== undefined) {
      queries.push({ ...shared, keywordIds: [topKeywordId] });
    }

    if (topDirectorId !== undefined) {
      queries.push({ ...shared, crewIds: [topDirectorId] });
    }

    if (topCastId !== undefined) {
      queries.push({ ...shared, castIds: [topCastId] });
    }

    if (queries.length === 0) {
      // Nothing recorded yet: fall back to a broad, well voted pool so the
      // viewer still gets a batch instead of an empty screen.
      queries.push(shared);
    }

    const results = await Promise.allSettled(
      queries.map((query) => this.catalog.discoverMovies(query)),
    );

    return results.flatMap((result) =>
      result.status === "fulfilled" ? result.value.data : [],
    );
  }
}
