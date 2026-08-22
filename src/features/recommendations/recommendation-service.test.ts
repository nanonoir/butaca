import { describe, expect, it, vi } from "vitest";

import { DiscoverResponseSchema, type MovieDetail } from "@/contracts";
import { TmdbError } from "@/integrations/tmdb";

import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";

import { RecommendationService } from "./recommendation-service";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function createDependencies() {
  return {
    preferences: { findByUserId: vi.fn().mockResolvedValue(null) },
    interactions: {
      findLikesByUser: vi.fn().mockResolvedValue([]),
      findDislikesByUser: vi.fn().mockResolvedValue([]),
      findReactedMovieIds: vi.fn().mockResolvedValue([]),
    },
    catalog: {
      getMovieDetail: vi.fn(),
      discoverMovies: vi.fn().mockResolvedValue(paginated([])),
      getMovieRecommendations: vi.fn().mockResolvedValue(paginated([])),
      getMoviesDirectedBy: vi.fn().mockResolvedValue([]),
      getMoviesActedIn: vi.fn().mockResolvedValue([]),
      getGenres: vi.fn().mockResolvedValue([
        { id: 878, name: "Ciencia ficción" },
        { id: 18, name: "Drama" },
        { id: 27, name: "Terror" },
      ]),
    },
  };
}

function summary(id: number, genreIds: number[] = [], rating = 7) {
  return {
    id,
    title: `Película ${id}`,
    originalTitle: `Película ${id}`,
    overview: "",
    posterPath: null,
    backdropPath: null,
    genreIds,
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating: rating,
    tmdbVoteCount: 2_000,
  };
}

function paginated(data: ReturnType<typeof summary>[]) {
  return {
    data,
    meta: {
      page: 1,
      pageSize: 20 as const,
      totalPages: 1,
      totalResults: data.length,
      hasNextPage: false,
    },
  };
}

function detail(id: number, genreIds: number[]): MovieDetail {
  return {
    id,
    title: `Película ${id}`,
    originalTitle: `Película ${id}`,
    overview: "",
    tagline: null,
    posterPath: null,
    backdropPath: null,
    releaseDate: "2020-01-01",
    runtime: 100,
    originalLanguage: "en",
    genres: genreIds.map((genreId) => ({ id: genreId, name: `G${genreId}` })),
    tmdbRating: 8,
    tmdbVoteCount: 3_000,
    director: null,
    cast: [],
    keywords: [],
    trailer: null,
  };
}

function interaction(movieId: number): UserMovieInteractionRecord {
  return {
    id: `3333${movieId}`.padEnd(36, "0"),
    userId: USER_ID,
    movieId,
    reaction: "LIKE",
    watchedAt: null,
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    updatedAt: new Date("2026-08-20T12:00:00.000Z"),
  };
}

describe("getDiscoverBatch", () => {
  it("returns a batch the discover contract accepts", async () => {
    const deps = createDependencies();
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(1), summary(2)]),
    );

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.batchSize).toBe(10);
    expect(batch.returned).toBe(batch.movies.length);
    expect(DiscoverResponseSchema.safeParse({ data: batch }).success).toBe(
      true,
    );
  });

  it("never returns a movie the viewer already reacted to", async () => {
    const deps = createDependencies();
    deps.interactions.findReactedMovieIds.mockResolvedValue([1, 3]);
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(1), summary(2), summary(3)]),
    );

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([2]);
  });

  it("caps the batch at the declared size", async () => {
    const deps = createDependencies();
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated(
        Array.from({ length: 40 }, (_unused, index) => summary(index + 1)),
      ),
    );

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.movies).toHaveLength(10);
    expect(batch.returned).toBe(10);
  });

  it("issues one query per preferred genre because TMDB ANDs them together", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878, 18, 53, 27],
    });

    await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    const genreQueries = deps.catalog.discoverMovies.mock.calls
      .map(([query]) => query.genreIds)
      .filter(Boolean);

    expect(genreQueries).toEqual([[878], [18], [53]]);
  });

  it("ranks a movie matching the stated preference above an unrelated one", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878],
    });
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(1, [99]), summary(2, [878])]),
    );

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.movies[0]?.movie.id).toBe(2);
  });

  it("builds the profile from the viewer's likes and dislikes", async () => {
    const deps = createDependencies();
    deps.interactions.findLikesByUser.mockResolvedValue([interaction(10)]);
    deps.interactions.findDislikesByUser.mockResolvedValue([interaction(20)]);
    deps.catalog.getMovieDetail.mockImplementation(async (movieId: number) =>
      movieId === 10 ? detail(10, [878]) : detail(20, [27]),
    );
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(1, [27]), summary(2, [878])]),
    );

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.movies[0]?.movie.id).toBe(2);
    expect(deps.catalog.getMovieDetail).toHaveBeenCalledWith(10);
    expect(deps.catalog.getMovieDetail).toHaveBeenCalledWith(20);
  });

  it("still returns a batch for a viewer with nothing recorded", async () => {
    const deps = createDependencies();
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(deps.catalog.discoverMovies).toHaveBeenCalledTimes(1);
    expect(batch.movies).toHaveLength(1);
  });

  it("survives a failing candidate query instead of returning nothing", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878, 18],
    });
    deps.catalog.discoverMovies
      .mockRejectedValueOnce(new TmdbError("UNAVAILABLE"))
      .mockResolvedValueOnce(paginated([summary(2, [18])]));

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([2]);
  });

  it("skips a liked movie the catalog cannot resolve", async () => {
    const deps = createDependencies();
    deps.interactions.findLikesByUser.mockResolvedValue([
      interaction(10),
      interaction(11),
    ]);
    deps.catalog.getMovieDetail.mockImplementation(async (movieId: number) => {
      if (movieId === 10) {
        throw new TmdbError("NOT_FOUND", 404);
      }

      return detail(11, [878]);
    });
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(1, [878])]),
    );

    const batch = await new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    ).getDiscoverBatch(USER_ID);

    expect(batch.movies).toHaveLength(1);
  });
});

describe("getDiscoverBatch scope", () => {
  function service(deps: ReturnType<typeof createDependencies>) {
    return new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    );
  }

  /** Asking for a director is a question about a subject, not a mood. Fanning
   * out over the profile's genres alongside it filled most of the batch with
   * movies nobody asked about. */
  it("stops asking about the profile's genres once a subject is named", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([summary(7)]);

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { crewIds: [488] },
    });

    expect(deps.catalog.discoverMovies).not.toHaveBeenCalled();
    expect(deps.catalog.getMoviesDirectedBy).toHaveBeenCalledWith({
      personId: 488,
    });
    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([7]);
  });

  /** Discover matches anyone who worked on a film, so a crew filter built on it
   * answers "a Spielberg movie" with everything he produced. */
  it("asks for the films a director directed, not the ones they crewed", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([summary(1)]);

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { crewIds: [488] },
    });

    const crewQueries = deps.catalog.discoverMovies.mock.calls.filter(
      ([query]) => query.crewIds !== undefined,
    );

    expect(crewQueries).toEqual([]);
  });

  /** A rating floor travels as a discover parameter, which a filmography never
   * passes through. */
  it("applies a rating floor to a filmography as well", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([
      { ...summary(1), tmdbRating: 8.4, tmdbVoteCount: 4_000 },
      { ...summary(2), tmdbRating: 5.1, tmdbVoteCount: 4_000 },
      { ...summary(3), tmdbRating: 8.9, tmdbVoteCount: 12 },
    ]);

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { crewIds: [488], minTmdbRating: 7.5, minTmdbVoteCount: 500 },
    });

    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([1]);
  });

  /** `/similar` matches on genre and keyword overlap alone, and answers
   * Interstellar with a direct-to-video sequel rated 3.3. */
  it("reaches for the editorial recommendations when a movie is named", async () => {
    const deps = createDependencies();
    deps.catalog.getMovieRecommendations.mockResolvedValue(
      paginated([summary(9)]),
    );

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { similarToMovieId: 157_336 },
    });

    expect(deps.catalog.getMovieRecommendations).toHaveBeenCalledWith({
      movieId: 157_336,
      page: 1,
    });
    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([9]);
  });

  it("still leans on the profile when no subject was named", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878, 18],
    });
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { minTmdbRating: 7.5 },
    });

    expect(deps.catalog.discoverMovies).toHaveBeenCalled();
    expect(deps.catalog.getMoviesDirectedBy).not.toHaveBeenCalled();
  });

  /** A filmography lookup that fails must cost that one source, not the batch. */
  it("survives a filmography the provider cannot answer", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesDirectedBy.mockRejectedValue(new Error("down"));

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { crewIds: [488] },
    });

    expect(batch.movies).toEqual([]);
    expect(batch.returned).toBe(0);
  });
});

describe("getDiscoverBatch combined constraints", () => {
  function service(deps: ReturnType<typeof createDependencies>) {
    return new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    );
  }

  /** Two names is one question with a much smaller answer, not two lists
   * stapled end to end. */
  it("answers an actor and a director with the films they made together", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesActedIn.mockResolvedValue([
      summary(1),
      summary(2),
      summary(3),
    ]);
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([
      summary(3),
      summary(4),
    ]);

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193], crewIds: [1032] },
    });

    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([3]);
  });

  /** A specific question gets however many honest answers exist. */
  it("returns fewer than asked for rather than padding the batch", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesActedIn.mockResolvedValue([summary(1), summary(2)]);
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([summary(2)]);
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(50), summary(51), summary(52)]),
    );

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193], crewIds: [1032] },
      limit: 5,
    });

    expect(batch.movies).toHaveLength(1);
    expect(batch.returned).toBe(1);
  });

  it("keeps only the years the viewer asked for", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([
      { ...summary(1), releaseDate: "1993-06-11" },
      { ...summary(2), releaseDate: "2005-06-29" },
      { ...summary(3), releaseDate: "1998-07-24" },
    ]);

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { crewIds: [488], minReleaseYear: 1990, maxReleaseYear: 1999 },
    });

    expect(batch.movies.map(({ movie }) => movie.id).sort()).toEqual([1, 3]);
  });

  /** Runtime lives on the detail, not the summary, so the adapter is the last
   * place that still knows it. */
  it("hands the runtime bounds to the filmography lookup", async () => {
    const deps = createDependencies();

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { crewIds: [488], maxRuntime: 100 },
    });

    expect(deps.catalog.getMoviesDirectedBy).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 488, maxRuntime: 100 }),
    );
  });

  it("takes an actor from their billing order, not from discover", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesActedIn.mockResolvedValue([summary(1)]);

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193] },
    });

    expect(deps.catalog.getMoviesActedIn).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 6193 }),
    );
    expect(deps.catalog.discoverMovies).not.toHaveBeenCalled();
  });
});

describe("getDiscoverBatch with several actors", () => {
  function service(deps: ReturnType<typeof createDependencies>) {
    return new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    );
  }

  /** A comma in `with_cast` means both, which is a far narrower question than
   * either and needs no cap on how deep a filmography is read. */
  it("asks discover for two actors at once instead of two filmographies", async () => {
    const deps = createDependencies();
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193, 287] },
    });

    expect(deps.catalog.getMoviesActedIn).not.toHaveBeenCalled();
    expect(deps.catalog.discoverMovies).toHaveBeenCalledWith(
      expect.objectContaining({ castIds: [6193, 287] }),
    );
    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([1]);
  });

  it("still reads one actor from their billing order", async () => {
    const deps = createDependencies();
    deps.catalog.getMoviesActedIn.mockResolvedValue([summary(1)]);

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193] },
    });

    expect(deps.catalog.getMoviesActedIn).toHaveBeenCalled();
    expect(deps.catalog.discoverMovies).not.toHaveBeenCalled();
  });

  it("crosses two actors with a director as one question", async () => {
    const deps = createDependencies();
    deps.catalog.discoverMovies.mockResolvedValue(
      paginated([summary(1), summary(2)]),
    );
    deps.catalog.getMoviesDirectedBy.mockResolvedValue([summary(2)]);

    const batch = await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193, 287], crewIds: [1032] },
    });

    expect(batch.movies.map(({ movie }) => movie.id)).toEqual([2]);
  });
});

describe("getDiscoverBatch and the profile's own defaults", () => {
  function service(deps: ReturnType<typeof createDependencies>) {
    return new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    );
  }

  /** A viewer with thrillers excluded asked for DiCaprio with Brad Pitt and got
   * nothing, while Once Upon a Time in Hollywood -- filed under thriller -- sat
   * right there. The exclusions shape a pool the profile is driving; they are
   * not an answer to a question somebody asked out loud. */
  it("does not let the profile's exclusions erase an explicit request", async () => {
    const deps = createDependencies();
    deps.interactions.findDislikesByUser.mockResolvedValue([
      { movieId: 90 },
      { movieId: 91 },
    ]);
    deps.catalog.getMovieDetail.mockResolvedValue({
      ...summary(90),
      genres: [{ id: 53, name: "Suspense" }],
      runtime: 120,
      tagline: null,
      director: null,
      cast: [],
      keywords: [],
      trailer: null,
    });
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193, 287] },
    });

    const [query] = deps.catalog.discoverMovies.mock.calls[0]!;

    expect(query.excludedGenreIds).toBeUndefined();
    expect(query.minTmdbVoteCount).toBeUndefined();
  });

  it("still shapes a profile driven batch with them", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878],
    });
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    await service(deps).getDiscoverBatch(USER_ID);

    const [query] = deps.catalog.discoverMovies.mock.calls[0]!;

    expect(query.minTmdbVoteCount).toBeGreaterThan(0);
  });

  /** An exclusion the caller sent came from the same request, so it stays. */
  it("keeps an exclusion the request itself carried", async () => {
    const deps = createDependencies();
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    await service(deps).getDiscoverBatch(USER_ID, {
      filters: { castIds: [6193, 287], excludedGenreIds: [27] },
    });

    const [query] = deps.catalog.discoverMovies.mock.calls[0]!;

    expect(query.excludedGenreIds).toEqual([27]);
  });
});

describe("getDiscoverBatch reasons", () => {
  function service(deps: ReturnType<typeof createDependencies>) {
    return new RecommendationService(
      deps.preferences,
      deps.interactions,
      deps.catalog,
    );
  }

  /** The deck was built entirely from traits and never from a film the viewer
   * actually liked. */
  it("asks what goes with the most recent like", async () => {
    const deps = createDependencies();
    deps.interactions.findLikesByUser.mockResolvedValue([{ movieId: 603 }]);
    deps.catalog.getMovieDetail.mockResolvedValue({
      ...summary(603),
      title: "Matrix",
      genres: [{ id: 878, name: "Ciencia ficción" }],
      runtime: 136,
      tagline: null,
      director: { id: 9339, name: "Lana Wachowski", profilePath: null },
      cast: [],
      keywords: [],
      trailer: null,
    });
    deps.catalog.getMovieRecommendations.mockResolvedValue(
      paginated([summary(7)]),
    );

    const batch = await service(deps).getDiscoverBatch(USER_ID);

    expect(deps.catalog.getMovieRecommendations).toHaveBeenCalledWith({
      movieId: 603,
      page: 1,
    });
    const seeded = batch.movies.find(({ movie }) => movie.id === 7);
    expect(seeded?.insight.reason).toEqual({
      kind: "similar",
      name: "Matrix",
    });
  });

  it("labels a card that came from the viewer's director", async () => {
    const deps = createDependencies();
    deps.interactions.findLikesByUser.mockResolvedValue([{ movieId: 27_205 }]);
    deps.catalog.getMovieDetail.mockResolvedValue({
      ...summary(27_205),
      title: "Origen",
      genres: [{ id: 878, name: "Ciencia ficción" }],
      runtime: 148,
      tagline: null,
      director: { id: 525, name: "Christopher Nolan", profilePath: null },
      cast: [],
      keywords: [],
      trailer: null,
    });
    deps.catalog.getMovieRecommendations.mockResolvedValue(paginated([]));
    deps.catalog.discoverMovies.mockImplementation(
      async (query: { crewIds?: number[] }) =>
        query.crewIds?.[0] === 525 ? paginated([summary(11)]) : paginated([]),
    );

    const batch = await service(deps).getDiscoverBatch(USER_ID);

    expect(
      batch.movies.find(({ movie }) => movie.id === 11)?.insight.reason,
    ).toEqual({ kind: "crew", name: "Christopher Nolan" });
  });

  /** A movie can arrive from two queries at once. "You keep watching Nolan"
   * says more than "it is science fiction". */
  it("keeps the most specific reason when a movie came from two queries", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878],
    });
    deps.interactions.findLikesByUser.mockResolvedValue([{ movieId: 27_205 }]);
    deps.catalog.getMovieDetail.mockResolvedValue({
      ...summary(27_205),
      title: "Origen",
      genres: [{ id: 878, name: "Ciencia ficción" }],
      runtime: 148,
      tagline: null,
      director: { id: 525, name: "Christopher Nolan", profilePath: null },
      cast: [],
      keywords: [],
      trailer: null,
    });
    deps.catalog.getMovieRecommendations.mockResolvedValue(paginated([]));
    // The same movie answers both the genre query and the director one.
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(11)]));

    const batch = await service(deps).getDiscoverBatch(USER_ID);

    expect(
      batch.movies.find(({ movie }) => movie.id === 11)?.insight.reason.kind,
    ).toBe("crew");
  });

  it("says nothing beyond the genre when there is nothing else to say", async () => {
    const deps = createDependencies();
    deps.preferences.findByUserId.mockResolvedValue({
      preferredGenreIds: [878],
    });
    deps.catalog.discoverMovies.mockResolvedValue(paginated([summary(1)]));

    const batch = await service(deps).getDiscoverBatch(USER_ID);

    expect(batch.movies[0]?.insight.reason).toEqual({
      kind: "genre",
      name: null,
    });
  });
});
