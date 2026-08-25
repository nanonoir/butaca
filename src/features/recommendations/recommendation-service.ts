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
  ReviewRepository,
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
import { loadTasteProfile } from "./taste-profile-loader";
import type { TasteProfile } from "./taste-profile";

/** How many of the profile's strongest genres get their own candidate query.
 * TMDB treats a comma separated `with_genres` as AND, so asking for five
 * genres at once returns almost nothing; one query per genre is what produces
 * the union we actually want. */
const CANDIDATE_GENRE_COUNT = 3;

/** How deep into the viewer's genres the rotation is allowed to reach. Every
 * genre with any positive weight counts as preferred, and a single liked movie
 * is enough to put one there -- rotating across all of them sent whole batches
 * to a genre the viewer had brushed against once, and the deck came back as ten
 * musicals. The top few are the ones they actually watch. */
const GENRE_ROTATION_POOL = 5;

/** And how far down the people and keywords. The profile keeps eight of each,
 * ordered by how often they show up in what the viewer liked, and the tail is
 * thin by construction: rotating across all eight traded "always the same
 * director" for "a different director nobody has seen twice", and person-backed
 * cards went from nine in thirty to two. The head of the list is where the
 * signal is. */
const SIGNAL_ROTATION_POOL = 4;

/** How many of each signal a single batch asks about. One director and one
 * actor meant a whole deck could only ever mention one of each, and the reasons
 * read as though the viewer had exactly one favourite. Asking about two brings
 * two names into the same ten cards. */
const SIGNALS_PER_BATCH = 2;

/** Keeps obscure entries with a handful of votes out of the candidate pool
 * before ranking even starts. */
const MIN_CANDIDATE_VOTE_COUNT = 200;

type PreferencesPort = Pick<UserPreferencesRepository, "findByUserId">;

type ReviewsPort = Pick<ReviewRepository, "findByUser">;

type InteractionsPort = Pick<
  UserMovieInteractionRepository,
  | "findLikesByUser"
  | "findDislikesByUser"
  | "findReactedMovieIds"
  | "findTopCastByUser"
  | "findTopDirectorsByUser"
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

/** Which of the viewer's signals a batch leans on. The profile keeps eight
 * directors, eight actors, twelve keywords and six recent likes, and the deck
 * used to ask about the first of each every single time -- same director, same
 * actor, same film to resemble, batch after batch.
 *
 * The window advances with the deck rather than at random, so a request stays
 * reproducible while successive batches reach for something else.
 */
/** The same idea for a window rather than a single pick, so the genres a batch
 * asks about move across everything the viewer likes instead of pinning to the
 * three heaviest forever. */
function rotateWindow<T>(
  items: readonly T[],
  offset: number,
  size: number,
): T[] {
  if (items.length <= size) {
    return [...items];
  }

  return Array.from(
    { length: size },
    (_unused, index) => items[(Math.abs(offset) + index) % items.length]!,
  );
}

/** A ceiling on how much of a batch one signal may take, not a floor under
 * every signal. Counted per signal rather than per kind, so two directors are
 * two allowances and both get named. Three genre queries bring sixty candidates and the other
 * signals a handful each, so scoring alone handed whole decks to whichever
 * genre the rotation had landed on -- ten musicals in a row, every card saying
 * the same thing.
 *
 * Reserving a seat per source was the first fix and it was worse: it promoted
 * whatever a thin source had left, and half the deck came back explaining that
 * the movie was not really the viewer's thing. A cap keeps the ranking in
 * charge and only stops one source from owning the screen. */
const MAX_SOURCE_SHARE = 0.3;

function capBySource(
  ranked: MovieSummary[],
  sourceById: Map<number, MatchReason>,
  limit: number,
): MovieSummary[] {
  const quota = Math.max(1, Math.ceil(limit * MAX_SOURCE_SHARE));
  const taken = new Map<string, number>();
  const batch: MovieSummary[] = [];
  const overflow: MovieSummary[] = [];

  // One seat for the best thing each signal found, before the ranking spends
  // the rest. Without it a signal whose candidates score low never appears at
  // all: asking what goes with a war film the viewer liked returns war films,
  // and a profile built on drama and animation scores those below everything
  // else. The card is a weaker pick and it is the only one -- nine of ten still
  // go to whatever ranked highest.
  const opened = new Set<string>();

  for (const movie of ranked) {
    if (batch.length === limit) {
      break;
    }

    const source = sourceById.get(movie.id);
    const key = `${source?.kind ?? "genre"}:${source?.name ?? ""}`;

    if (!opened.has(key)) {
      opened.add(key);
      taken.set(key, 1);
      batch.push(movie);
    }
  }

  for (const movie of ranked) {
    if (batch.includes(movie)) {
      continue;
    }

    if (batch.length === limit) {
      break;
    }

    const source = sourceById.get(movie.id);
    // Keyed on the name as well as the kind. Grouping every director together
    // let the strongest one take the whole crew allowance, and a deck that
    // asked about two directors still only ever mentioned one.
    const key = `${source?.kind ?? "genre"}:${source?.name ?? ""}`;
    const count = taken.get(key) ?? 0;

    if (count >= quota) {
      overflow.push(movie);
      continue;
    }

    taken.set(key, count + 1);
    batch.push(movie);
  }

  // A viewer whose profile only has one signal still gets a full deck: the cap
  // yields rather than leaving the screen short.
  return [...batch, ...overflow].slice(0, limit);
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
    private readonly reviews: ReviewsPort,
  ) {}

  async getDiscoverBatch(
    userId: string,
    options: DiscoverBatchOptions = {},
  ): Promise<DiscoverBatch> {
    const [{ profile }, reactedMovieIds] = await Promise.all([
      loadTasteProfile(userId, {
        interactions: this.interactions,
        preferences: this.preferences,
        reviews: this.reviews,
        catalog: this.catalog,
      }),
      this.interactions.findReactedMovieIds(userId),
    ]);
    const candidates = await this.generateCandidates(
      profile,
      options.filters,
      // Grows as the viewer works through the deck, so a refill leans on a
      // different signal than the batch before it.
      reactedMovieIds.length + (options.excludeMovieIds?.length ?? 0),
    );
    // The ranking works on movies; the reason each one is here travels beside
    // it, keyed by id, so ranking and scoring stay untouched.
    const sourceById = new Map(
      candidates.map(({ movie, source }) => [movie.id, source]),
    );
    const limit = options.limit ?? DISCOVER_BATCH_SIZE;
    const ranked = capBySource(
      rankMovies(
        excludeMovies(
          candidates.map(({ movie }) => movie),
          [...reactedMovieIds, ...(options.excludeMovieIds ?? [])],
        ),
        profile,
        // Ranked in full first: the interleave needs every source's best
        // picks in order, not just the top of the pool.
        candidates.length,
      ),
      sourceById,
      limit,
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
    rotation = 0,
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
    const queries: SourcedQuery[] = rotateWindow(
      requestedGenreIds.slice(0, GENRE_ROTATION_POOL),
      rotation,
      CANDIDATE_GENRE_COUNT,
    ).map((genreId) => ({
        query: { ...shared, genreIds: [genreId] },
      source: { kind: "genre", name: null } as const,
    }));
    const signals = <T,>(items: readonly T[]) =>
      subject
        ? []
        : rotateWindow(
            items.slice(0, SIGNAL_ROTATION_POOL),
            rotation,
            SIGNALS_PER_BATCH,
          );

    for (const keywordId of signals(profile.keywordIds)) {
      queries.push({
        query: { ...shared, keywordIds: [keywordId] },
        source: { kind: "keyword", name: null },
      });
    }

    for (const director of signals(profile.crew)) {
      queries.push({
        query: { ...shared, crewIds: [director.id] },
        source: { kind: "crew", name: director.name },
      });
    }

    for (const person of signals(profile.cast)) {
      queries.push({
        query: { ...shared, castIds: [person.id] },
        source: { kind: "cast", name: person.name },
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
    for (const seed of signals(profile.seeds)) {
      const { movieId, title } = seed;

      requests.push(
        this.catalog
          .getMovieRecommendations({ movieId, page: 1 })
          .then(({ data }) => ({
            source: { kind: "similar" as const, name: title },
            // The discover queries drop the viewer's rejected genres through
            // `without_genres`; this endpoint takes no such parameter, and
            // leaving it unfiltered showed. A film they liked long enough ago
            // can sit in a genre they have since turned against, and its
            // recommendations came back as a third of the deck explaining that
            // it was not really their thing.
            movies: data.filter(
              (movie) =>
                !movie.genreIds.some((genreId) =>
                  profile.excludedGenreIds.includes(genreId),
                ),
            ),
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
