import "server-only";

import {
  DISCOVER_BATCH_SIZE,
  type Genre,
  type MovieDetail,
  type MovieSummary,
  type RecommendationFilters,
  type RecommendedMovie,
} from "@/contracts";

import type {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import type {
  PaginatedMovies,
  TmdbAdapter,
  TmdbDiscoverOptions,
} from "../../integrations/tmdb";

import { buildMatchInsight } from "./match-insight";
import { excludeMovies, rankMovies } from "./ranking";
import { buildTasteProfile, type TasteProfile } from "./taste-profile";

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

type CatalogPort = Pick<
  TmdbAdapter,
  | "getMovieDetail"
  | "discoverMovies"
  | "getGenres"
  | "getMovieRecommendations"
  | "getMoviesDirectedBy"
  | "getMoviesActedIn"
>;

export type DiscoverBatchOptions = {
  /** Movies still sitting in the viewer's deck. They are not reacted to yet, so
   * the database cannot exclude them, and without this the next batch would
   * hand back cards already on screen. */
  excludeMovieIds?: number[];
  limit?: number;
  filters?: RecommendationFilters;
};

export type DiscoverBatch = {
  movies: RecommendedMovie[];
  batchSize: typeof DISCOVER_BATCH_SIZE;
  returned: number;
};

/** A movie a locally sourced list and a discover query would both have to
 * satisfy. Discover applies these as request parameters; a filmography and an
 * intersection never pass through it, so they are checked here rather than
 * being silently ignored on exactly the request that asked for them. Runtime is
 * absent: it lives on the detail, and the adapter applies it while it still
 * has one. */
function matchesLocalFilters(
  movie: MovieSummary,
  filters: RecommendationFilters,
): boolean {
  const year = Number(movie.releaseDate?.slice(0, 4));

  return (
    movie.tmdbRating >= (filters.minTmdbRating ?? 0) &&
    movie.tmdbVoteCount >= (filters.minTmdbVoteCount ?? 0) &&
    (filters.minReleaseYear === undefined ||
      (Number.isFinite(year) && year >= filters.minReleaseYear)) &&
    (filters.maxReleaseYear === undefined ||
      (Number.isFinite(year) && year <= filters.maxReleaseYear))
  );
}

function intersectById(
  left: MovieSummary[],
  right: MovieSummary[],
): MovieSummary[] {
  const rightIds = new Set(right.map((movie) => movie.id));

  return left.filter((movie) => rightIds.has(movie.id));
}

export class RecommendationService {
  constructor(
    private readonly preferences: PreferencesPort,
    private readonly interactions: InteractionsPort,
    private readonly catalog: CatalogPort,
  ) {}

  async getDiscoverBatch(
    userId: string,
    options: DiscoverBatchOptions = {},
  ): Promise<DiscoverBatch> {
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
    const candidates = await this.generateCandidates(profile, options.filters);
    const ranked = rankMovies(
      excludeMovies(candidates, [
        ...reactedMovieIds,
        ...(options.excludeMovieIds ?? []),
      ]),
      profile,
      options.limit ?? DISCOVER_BATCH_SIZE,
    );
    // Genre names only matter for the batch that survived the ranking, and the
    // list is small enough to fetch once per request.
    const genres = ranked.length > 0 ? await this.resolveGenres() : [];
    const movies = ranked.map<RecommendedMovie>((movie, position) => ({
      movie,
      insight: buildMatchInsight(movie, profile, genres, position),
    }));

    return {
      movies,
      batchSize: DISCOVER_BATCH_SIZE,
      returned: movies.length,
    };
  }

  /** A catalog outage must not cost the whole batch: without names the insight
   * degrades to a tier with no genres, and the deck still renders. */
  private async resolveGenres(): Promise<Genre[]> {
    try {
      return await this.catalog.getGenres();
    } catch {
      return [];
    }
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
    filters: RecommendationFilters = {},
  ): Promise<MovieSummary[]> {
    // Caller filters are extra constraints on top of the profile, never a
    // replacement for it: an explicit request narrows the pool, it does not
    // turn Discover into an unpersonalised search.
    //
    // Similarity is the one that cannot travel with the rest: TMDB answers it
    // from its own endpoint rather than as a discover parameter, so it becomes
    // a query of its own alongside them.
    // A crew filter leaves with the same treatment: discover matches anyone who
    // worked on a film, so honouring "a Spielberg movie" means asking for the
    // ones he directed rather than the ones he produced.
    const { similarToMovieId, crewIds, castIds, ...candidateFilters } = filters;
    const shared = {
      page: 1,
      excludedGenreIds: profile.excludedGenreIds,
      minTmdbVoteCount: MIN_CANDIDATE_VOTE_COUNT,
      ...candidateFilters,
    };
    // Naming a person or a movie asks about a subject, not a mood. Fanning out
    // over the profile's genres alongside it fills most of the batch with
    // movies the viewer did not ask about: requesting Spielberg came back three
    // parts Spielberg and two parts whatever else matched their taste.
    //
    // A subject replaces the candidate source. The profile still decides the
    // order, so which Spielberg films surface stays personal.
    const castId = castIds?.[0];
    const crewId = crewIds?.[0];
    const subject =
      castId !== undefined ||
      crewId !== undefined ||
      similarToMovieId !== undefined;
    const requestedGenreIds = subject
      ? []
      : (filters.genreIds ?? profile.preferredGenreIds);
    const queries: TmdbDiscoverOptions[] = requestedGenreIds
      .slice(0, CANDIDATE_GENRE_COUNT)
      .map((genreId) => ({ ...shared, genreIds: [genreId] }));
    const [topKeywordId] = profile.keywordIds;
    const [topDirectorId] = profile.crewIds;
    const [topCastId] = profile.castIds;

    if (!subject && topKeywordId !== undefined) {
      queries.push({ ...shared, keywordIds: [topKeywordId] });
    }

    if (!subject && topDirectorId !== undefined) {
      queries.push({ ...shared, crewIds: [topDirectorId] });
    }

    if (!subject && topCastId !== undefined) {
      queries.push({ ...shared, castIds: [topCastId] });
    }

    if (queries.length === 0 && !subject) {
      // Nothing recorded yet: fall back to a broad, well voted pool so the
      // viewer still gets a batch instead of an empty screen.
      queries.push(shared);
    }

    const requests: Promise<PaginatedMovies>[] = queries.map((query) =>
      this.catalog.discoverMovies(query),
    );

    if (similarToMovieId !== undefined) {
      requests.push(
        this.catalog.getMovieRecommendations({
          movieId: similarToMovieId,
          page: 1,
        }),
      );
    }

    const runtimeBounds = {
      minRuntime: filters.minRuntime,
      maxRuntime: filters.maxRuntime,
    };
    const [acted, directed, results] = await Promise.all([
      castId === undefined
        ? []
        : this.catalog
            .getMoviesActedIn({ personId: castId, ...runtimeBounds })
            .catch(() => []),
      crewId === undefined
        ? []
        : this.catalog
            .getMoviesDirectedBy({ personId: crewId, ...runtimeBounds })
            .catch(() => []),
      Promise.allSettled(requests),
    ]);

    // Naming both an actor and a director asks for the films they made
    // together, not for two lists stapled end to end. Two names is one
    // question with a much smaller answer, and sometimes only one film.
    const fromPeople =
      castId !== undefined && crewId !== undefined
        ? intersectById(acted, directed)
        : [...acted, ...directed];

    return [
      ...fromPeople.filter((movie) =>
        matchesLocalFilters(movie, filters),
      ),
      ...results.flatMap((result) =>
        result.status === "fulfilled" ? result.value.data : [],
      ),
    ];
  }
}
