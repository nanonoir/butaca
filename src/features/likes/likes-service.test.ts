import { describe, expect, it, vi } from "vitest";

import { LikedMovieItemSchema, type MovieDetail } from "@/contracts";
import { TmdbError } from "@/integrations/tmdb";

import type { UserMovieInteractionRecord } from "../../db/schema/user-movie-interactions";

import { LikesService } from "./likes-service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIKED_AT = new Date("2026-08-20T12:00:00.000Z");
const WATCHED_AT = new Date("2026-08-19T12:00:00.000Z");

function createRepository() {
  return {
    findLikesByUser: vi.fn(),
    countLikesByUser: vi.fn(),
  };
}

function createCatalog() {
  return { getMovieDetail: vi.fn() };
}

function createInteraction(
  overrides: Partial<UserMovieInteractionRecord> = {},
): UserMovieInteractionRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    userId: USER_ID,
    movieId: 157_336,
    reaction: "LIKE",
    watchedAt: null,
    createdAt: LIKED_AT,
    updatedAt: LIKED_AT,
    ...overrides,
  };
}

function createDetail(movieId: number): MovieDetail {
  return {
    id: movieId,
    title: "Interstellar",
    originalTitle: "Interstellar",
    overview: "Un viaje más allá del sistema solar.",
    tagline: null,
    posterPath: "/poster.jpg",
    backdropPath: null,
    releaseDate: "2014-11-05",
    runtime: 169,
    originalLanguage: "en",
    genres: [
      { id: 12, name: "Aventura" },
      { id: 18, name: "Drama" },
    ],
    tmdbRating: 8.4,
    tmdbVoteCount: 30_000,
    director: null,
    cast: [],
    keywords: [],
    trailer: null,
  };
}

describe("listLikedMovies", () => {
  it("maps the catalog detail into the list contract", async () => {
    const repository = createRepository();
    const catalog = createCatalog();
    repository.findLikesByUser.mockResolvedValue([
      createInteraction({ watchedAt: WATCHED_AT }),
    ]);
    repository.countLikesByUser.mockResolvedValue(1);
    catalog.getMovieDetail.mockResolvedValue(createDetail(157_336));

    const result = await new LikesService(repository, catalog).listLikedMovies(
      USER_ID,
      { page: 1, watched: "all" },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      likedAt: "2026-08-20T12:00:00.000Z",
      watchedAt: "2026-08-19T12:00:00.000Z",
      movie: { id: 157_336, genreIds: [12, 18] },
    });
    expect(LikedMovieItemSchema.array().safeParse(result.data).success).toBe(
      true,
    );
  });

  it("passes the watched filter to both the page and the count", async () => {
    const repository = createRepository();
    const catalog = createCatalog();
    repository.findLikesByUser.mockResolvedValue([]);
    repository.countLikesByUser.mockResolvedValue(0);

    await new LikesService(repository, catalog).listLikedMovies(USER_ID, {
      page: 2,
      watched: "unwatched",
    });

    expect(repository.findLikesByUser).toHaveBeenCalledWith(
      USER_ID,
      2,
      "unwatched",
      undefined,
    );
    expect(repository.countLikesByUser).toHaveBeenCalledWith(
      USER_ID,
      "unwatched",
      undefined,
    );
  });

  it("derives pagination from the filtered total", async () => {
    const repository = createRepository();
    const catalog = createCatalog();
    repository.findLikesByUser.mockResolvedValue([]);
    repository.countLikesByUser.mockResolvedValue(41);

    const result = await new LikesService(repository, catalog).listLikedMovies(
      USER_ID,
      { page: 2, watched: "all" },
    );

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 20,
      totalPages: 3,
      totalResults: 41,
      hasNextPage: true,
    });
  });

  it("drops a movie the catalog can no longer resolve without failing the list", async () => {
    const repository = createRepository();
    const catalog = createCatalog();
    repository.findLikesByUser.mockResolvedValue([
      createInteraction({ movieId: 157_336 }),
      createInteraction({
        id: "44444444-4444-4444-8444-444444444444",
        movieId: 999,
      }),
    ]);
    repository.countLikesByUser.mockResolvedValue(2);
    catalog.getMovieDetail.mockImplementation(async (movieId: number) => {
      if (movieId === 999) {
        throw new TmdbError("NOT_FOUND", 404);
      }

      return createDetail(movieId);
    });

    const result = await new LikesService(repository, catalog).listLikedMovies(
      USER_ID,
      { page: 1, watched: "all" },
    );

    expect(result.data.map((item) => item.movie.id)).toEqual([157_336]);
    expect(result.meta.totalResults).toBe(2);
  });

  it("returns an empty page for a user without likes", async () => {
    const repository = createRepository();
    const catalog = createCatalog();
    repository.findLikesByUser.mockResolvedValue([]);
    repository.countLikesByUser.mockResolvedValue(0);

    const result = await new LikesService(repository, catalog).listLikedMovies(
      USER_ID,
      { page: 1, watched: "all" },
    );

    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ totalPages: 0, hasNextPage: false });
    expect(catalog.getMovieDetail).not.toHaveBeenCalled();
  });

  /** The library stores movie ids, so matching a title means reaching into the
   * cached payload the catalog already wrote. */
  it("hands the search term to both the page and the count", async () => {
    const repository = createRepository();
    const catalog = createCatalog();
    repository.findLikesByUser.mockResolvedValue([]);
    repository.countLikesByUser.mockResolvedValue(0);

    await new LikesService(repository, catalog).listLikedMovies(USER_ID, {
      page: 1,
      watched: "all",
      search: "matrix",
    });

    expect(repository.findLikesByUser).toHaveBeenCalledWith(
      USER_ID,
      1,
      "all",
      "matrix",
    );
    expect(repository.countLikesByUser).toHaveBeenCalledWith(
      USER_ID,
      "all",
      "matrix",
    );
  });
});
