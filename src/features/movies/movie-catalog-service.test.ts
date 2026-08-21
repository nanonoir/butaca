import { describe, expect, it, vi } from "vitest";

import {
  SearchMoviesResponseSchema,
  type MovieSummary,
  type SearchMoviesQuery,
} from "@/contracts";
import { TmdbError } from "@/integrations/tmdb";

import { MovieCatalogService } from "./movie-catalog-service";

const MOVIE_ID = 603;

function createMovie(id: number): MovieSummary {
  return {
    id,
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
  };
}

function createPage(movies: MovieSummary[] = [createMovie(MOVIE_ID)]) {
  return SearchMoviesResponseSchema.parse({
    data: movies,
    meta: {
      page: 1,
      pageSize: 20,
      totalPages: movies.length === 0 ? 0 : 1,
      totalResults: movies.length,
      hasNextPage: false,
    },
  });
}

function createCatalog() {
  return {
    searchMovies: vi.fn(),
    getSimilarMovies: vi.fn(),
  };
}

describe("MovieCatalogService", () => {
  it("delegates a validated search query and preserves normalized results", async () => {
    const catalog = createCatalog();
    const query: SearchMoviesQuery = { query: "matrix", page: 2 };
    const page = createPage();
    catalog.searchMovies.mockResolvedValue(page);

    await expect(
      new MovieCatalogService(catalog).searchMovies(query),
    ).resolves.toEqual(page);
    expect(catalog.searchMovies).toHaveBeenCalledWith(query);
  });

  it("returns an empty catalog page as a successful result", async () => {
    const catalog = createCatalog();
    const emptyPage = createPage([]);
    catalog.searchMovies.mockResolvedValue(emptyPage);

    await expect(
      new MovieCatalogService(catalog).searchMovies({
        query: "none",
        page: 1,
      }),
    ).resolves.toEqual(emptyPage);
  });

  it("propagates TMDB failures for shared route error mapping", async () => {
    const catalog = createCatalog();
    catalog.searchMovies.mockRejectedValue(new TmdbError("UNAVAILABLE"));

    await expect(
      new MovieCatalogService(catalog).searchMovies({
        query: "matrix",
        page: 1,
      }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("delegates similar-page requests and excludes the active movie", async () => {
    const catalog = createCatalog();
    catalog.getSimilarMovies.mockResolvedValue(
      createPage([createMovie(MOVIE_ID), createMovie(604)]),
    );

    const result = await new MovieCatalogService(catalog).getSimilarMovies(
      MOVIE_ID,
      3,
    );

    expect(catalog.getSimilarMovies).toHaveBeenCalledWith({
      movieId: MOVIE_ID,
      page: 3,
    });
    expect(result.data.map((movie) => movie.id)).toEqual([604]);
  });
});
