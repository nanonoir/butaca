import "server-only";

import {
  DISCOVER_BATCH_SIZE,
  type Genre,
  type MovieDetail,
  type MovieSummary,
  type RecommendationFilters,
  type RecommendedMovie,
  type MatchReason,
} from "@/contracts";

import type {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
} from "../../db/repositories";
import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";
import type {
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

type SourcedQuery = { query: TmdbDiscoverOptions; source: MatchReason };
type SourcedMovies = { movies: MovieSummary[]; source: MatchReason };

export type Candidate = { movie: MovieSummary; source: MatchReason };

/** How specific a reason feels, most specific first. A movie can arrive from
 * two queries at once -- it is a Nolan film and it is science fiction -- and
 * "you keep watching Nolan" says more than "it is science fiction". */
const SOURCE_PRIORITY: Record<MatchReason["kind"], number> = {
  crew: 0,
  cast: 1,
  similar: 2,
  keyword: 3,
  genre: 4,
};

function dedupeBySource(candidates: Candidate[]): Candidate[] {
  const best = new Map<number, Candidate>();

  for (const candidate of candidates) {
    const current = best.get(candidate.movie.id);

    if (
      !current ||
      SOURCE_PRIORITY[candidate.source.kind] <
        SOURCE_PRIORITY[current.source.kind]
    ) {
      best.set(candidate.movie.id, candidate);
    }
  }

  return [...best.values()];
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
    // The ranking works on movies; the reason each one is here travels beside
    // it, keyed by id, so ranking and scoring stay untouched.
    const sourceById = new Map(
      candidates.map(({ movie, source }) => [movie.id, source]),
    );
    const ranked = rankMovies(
      excludeMovies(
        candidates.map(({ movie }) => movie),
        [...reactedMovieIds, ...(options.excludeMovieIds ?? [])],
      ),
      profile,
      options.limit ?? DISCOVER_BATCH_SIZE,
    );
    // Genre names only matter for the batch that survived the ranking, and the
    // list is small enough to fetch once per request.
    const genres = ranked.length > 0 ? await this.resolveGenres() : [];
    const movies = ranked.map<RecommendedMovie>((movie, position) => ({
      movie,
      insight: buildMatchInsight(
        movie,
        profile,
        genres,
        position,
        sourceById.get(movie.id) ?? { kind: "genre", name: null },
      ),
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

  private async resolveCastCandidates(
    castIds: number[],
    shared: TmdbDiscoverOptions,
    runtimeBounds: { minRuntime?: number; maxRuntime?: number },
  ): Promise<MovieSummary[]> {
    if (castIds.length === 0) {
      return [];
    }

    try {
      if (castIds.length === 1) {
        return await this.catalog.getMoviesActedIn({
          personId: castIds[0]!,
          ...runtimeBounds,
        });
      }

      const { data } = await this.catalog.discoverMovies({
        ...shared,
        castIds,
      });

      return data;
    } catch {
      return [];
    }
  }

  /** TMDB generates the candidates; the ranking above decides the order. One
   * query per signal keeps the pool wide enough for the ranking to matter. */
  private async generateCandidates(
    profile: TasteProfile,
    filters: RecommendationFilters = {},
  ): Promise<Candidate[]> {
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
    // Naming a person or a movie asks about a subject, not a mood. Fanning out
    // over the profile's genres alongside it fills most of the batch with
    // movies the viewer did not ask about: requesting Spielberg came back three
    // parts Spielberg and two parts whatever else matched their taste.
    //
    // A subject replaces the candidate source. The profile still decides the
    // order, so which Spielberg films surface stays personal.
    const castIdList = castIds ?? [];
    const crewId = crewIds?.[0];
    const subject =
      castIdList.length > 0 ||
      crewId !== undefined ||
      similarToMovieId !== undefined;
    // The profile's own exclusions and the vote floor shape the pool for a
    // batch the profile is driving. They are not constraints on a question
    // somebody asked out loud, and applying them to one answers it wrongly:
    // this viewer has thrillers excluded, and Once Upon a Time in Hollywood is
    // filed under one, so "DiCaprio with Brad Pitt" came back empty while the
    // film they made together sat right there.
    //
    // An exclusion the caller sent is a different thing and still applies: it
    // came from the same request.
    const shared = {
      page: 1,
      ...(subject
        ? {}
        : {
            excludedGenreIds: profile.excludedGenreIds,
            minTmdbVoteCount: MIN_CANDIDATE_VOTE_COUNT,
          }),
      ...candidateFilters,
    };
    const requestedGenreIds = subject
      ? []
      : (filters.genreIds ?? profile.preferredGenreIds);
    // Each query carries the reason it exists, so a card can say why it is
    // there without anyone guessing afterwards.
    const queries: SourcedQuery[] = requestedGenreIds
      .slice(0, CANDIDATE_GENRE_COUNT)
      .map((genreId) => ({
        query: { ...shared, genreIds: [genreId] },
        source: { kind: "genre", name: null } as const,
      }));
    const [topKeywordId] = profile.keywordIds;
    const [topDirector] = profile.crew;
    const [topCast] = profile.cast;

    if (!subject && topKeywordId !== undefined) {
      queries.push({
        query: { ...shared, keywordIds: [topKeywordId] },
        source: { kind: "keyword", name: null },
      });
    }

    if (!subject && topDirector) {
      queries.push({
        query: { ...shared, crewIds: [topDirector.id] },
        source: { kind: "crew", name: topDirector.name },
      });
    }

    if (!subject && topCast) {
      queries.push({
        query: { ...shared, castIds: [topCast.id] },
        source: { kind: "cast", name: topCast.name },
      });
    }

    if (queries.length === 0 && !subject) {
      // Nothing recorded yet: fall back to a broad, well voted pool so the
      // viewer still gets a batch instead of an empty screen.
      queries.push({ query: shared, source: { kind: "genre", name: null } });
    }

    const requests: Promise<SourcedMovies>[] = queries.map(
      async ({ query, source }) => ({
        source,
        movies: (await this.catalog.discoverMovies(query)).data,
      }),
    );

    if (similarToMovieId !== undefined) {
      requests.push(
        this.catalog
          .getMovieRecommendations({ movieId: similarToMovieId, page: 1 })
          .then(({ data }) => ({
            source: { kind: "similar" as const, name: null },
            movies: data,
          })),
      );
    }

    // The deck used to be built entirely from traits -- a genre, a keyword, a
    // person -- and never from a film the viewer actually liked. This asks what
    // goes with their most recent one, which widens the pool and is the only
    // signal that can be named back as a movie.
    if (!subject && profile.seed) {
      const { movieId, title } = profile.seed;

      requests.push(
        this.catalog
          .getMovieRecommendations({ movieId, page: 1 })
          .then(({ data }) => ({
            source: { kind: "similar" as const, name: title },
            movies: data,
          })),
      );
    }

    const runtimeBounds = {
      minRuntime: filters.minRuntime,
      maxRuntime: filters.maxRuntime,
    };
    const [acted, directed, results] = await Promise.all([
      // One name comes from their filmography, ordered by billing, so a lead
      // outranks the walk-on an actor had before they were famous. Two names
      // go to discover instead: a comma there means both, which is a far
      // narrower question than either -- Leonardo DiCaprio alone matches 87
      // films, with Brad Pitt three -- and it costs one request rather than two
      // filmographies whose caps could hide the overlap.
      this.resolveCastCandidates(castIdList, shared, runtimeBounds),
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
      castIdList.length > 0 && crewId !== undefined
        ? intersectById(acted, directed)
        : [...acted, ...directed];

    const explicitSource: MatchReason =
      castIdList.length > 0
        ? { kind: "cast", name: null }
        : crewId !== undefined
          ? { kind: "crew", name: null }
          : { kind: "similar", name: null };

    return dedupeBySource([
      ...fromPeople
        .filter((movie) => matchesLocalFilters(movie, filters))
        .map((movie) => ({ movie, source: explicitSource })),
      ...results.flatMap((result) =>
        result.status === "fulfilled"
          ? result.value.movies.map((movie) => ({
              movie,
              source: result.value.source,
            }))
          : [],
      ),
    ]);
  }
}
