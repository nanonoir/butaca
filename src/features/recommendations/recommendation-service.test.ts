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

    expect(batch.batchSize).toBe(20);
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

    expect(batch.movies.map((movie) => movie.id)).toEqual([2]);
  });

  it("caps the batch at twenty", async () => {
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

    expect(batch.movies).toHaveLength(20);
    expect(batch.returned).toBe(20);
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

    expect(batch.movies[0]?.id).toBe(2);
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

    expect(batch.movies[0]?.id).toBe(2);
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

    expect(batch.movies.map((movie) => movie.id)).toEqual([2]);
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
