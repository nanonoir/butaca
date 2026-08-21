import { beforeEach, describe, expect, it, vi } from "vitest";

import { TmdbError } from "@/integrations/tmdb";

const catalog = {
  searchMovies: vi.fn(),
  getSimilarMovies: vi.fn(),
};

vi.mock("@/features/movies/movie-catalog-service", () => ({
  getMovieCatalogService: () => catalog,
}));

import { GET as getSearch } from "./search/route";
import { GET as getSimilar } from "./[movieId]/similar/route";

const PAGE = {
  data: [
    {
      id: 603,
      title: "The Matrix",
      originalTitle: "The Matrix",
      overview: "A hacker discovers the world is simulated.",
      posterPath: "/matrix.jpg",
      backdropPath: null,
      genreIds: [28, 878],
      releaseDate: "1999-03-30",
      originalLanguage: "en",
      tmdbRating: 8.2,
      tmdbVoteCount: 26_000,
    },
  ],
  meta: {
    page: 2,
    pageSize: 20,
    totalPages: 4,
    totalResults: 61,
    hasNextPage: true,
  },
};

beforeEach(() => {
  catalog.searchMovies.mockReset();
  catalog.getSimilarMovies.mockReset();
});

describe("movie catalog route handlers", () => {
  it("returns a normalized search envelope for a valid query", async () => {
    catalog.searchMovies.mockResolvedValue(PAGE);

    const response = await getSearch(
      new Request("https://butaca.test/api/movies/search?query=matrix&page=2"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: PAGE });
    expect(catalog.searchMovies).toHaveBeenCalledWith({
      query: "matrix",
      page: 2,
    });
  });

  it("returns a validation envelope for an invalid search query", async () => {
    const response = await getSearch(
      new Request(
        "https://butaca.test/api/movies/search?query=%20%20%20&page=0",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request payload is not valid",
      },
    });
    expect(catalog.searchMovies).not.toHaveBeenCalled();
  });

  it("uses the default similar-results page and returns the public envelope", async () => {
    catalog.getSimilarMovies.mockResolvedValue({
      ...PAGE,
      meta: { ...PAGE.meta, page: 1 },
    });

    const response = await getSimilar(
      new Request("https://butaca.test/api/movies/603/similar"),
      { params: Promise.resolve({ movieId: "603" }) },
    );

    expect(response.status).toBe(200);
    expect(catalog.getSimilarMovies).toHaveBeenCalledWith(603, 1);
  });

  it("maps invalid route input and TMDB failures without exposing provider data", async () => {
    const invalidResponse = await getSimilar(
      new Request("https://butaca.test/api/movies/nope/similar?page=1"),
      { params: Promise.resolve({ movieId: "nope" }) },
    );

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    catalog.getSimilarMovies.mockRejectedValue(
      new TmdbError("UNAVAILABLE", 503),
    );
    const unavailableResponse = await getSimilar(
      new Request("https://butaca.test/api/movies/603/similar?page=1"),
      { params: Promise.resolve({ movieId: "603" }) },
    );
    const body = await unavailableResponse.json();

    expect(unavailableResponse.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "TMDB_UNAVAILABLE",
        message: "The movie catalog is unavailable",
      },
    });
    expect(body.error.message).not.toContain("503");
  });
});
