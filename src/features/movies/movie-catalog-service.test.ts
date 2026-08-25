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

function createDetail(keywordCount: number) {
  return {
    id: MOVIE_ID,
    genres: [
      { id: 28, name: "Acción" },
      { id: 878, name: "Ciencia ficción" },
    ],
    keywords: Array.from({ length: keywordCount }, (_, index) => ({
      id: 8000 + index,
      name: `keyword ${index}`,
    })),
  };
}

function createCatalog() {
  return {
    getGenres: vi.fn(),
    getPopularMovies: vi.fn(),
    searchMovies: vi.fn(),
    getSimilarMovies: vi.fn(),
    getMovieDetail: vi.fn().mockResolvedValue(createDetail(12)),
    getMovieRecommendations: vi.fn().mockResolvedValue(createPage([])),
    discoverMovies: vi.fn().mockResolvedValue(createPage([])),
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

  /** The row used to be TMDB's `/similar`, which matches on genre and keyword
   * overlap and answers Interstellar with obscure dramas from 2007. */
  it("asks what the movie is about before asking anything else", async () => {
    const catalog = createCatalog();
    catalog.discoverMovies.mockResolvedValue(
      createPage([createMovie(MOVIE_ID), createMovie(604)]),
    );

    const result = await new MovieCatalogService(catalog).getSimilarMovies(
      MOVIE_ID,
      3,
    );

    expect(catalog.discoverMovies).toHaveBeenCalledWith({
      page: 3,
      genreIds: [28, 878],
      keywordIds: [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007],
      minTmdbVoteCount: 200,
    });
    expect(catalog.getMovieRecommendations).not.toHaveBeenCalled();
    expect(catalog.getSimilarMovies).not.toHaveBeenCalled();
    expect(result.data.map((movie) => movie.id)).toEqual([604]);
  });

  it("falls back to what audiences watch together when the subject query finds nothing", async () => {
    const catalog = createCatalog();
    catalog.getMovieRecommendations.mockResolvedValue(
      createPage([createMovie(MOVIE_ID), createMovie(605)]),
    );

    const result = await new MovieCatalogService(catalog).getSimilarMovies(
      MOVIE_ID,
      1,
    );

    expect(catalog.discoverMovies).toHaveBeenCalled();
    expect(catalog.getMovieRecommendations).toHaveBeenCalledWith({
      movieId: MOVIE_ID,
      page: 1,
    });
    expect(catalog.getSimilarMovies).not.toHaveBeenCalled();
    expect(result.data.map((movie) => movie.id)).toEqual([605]);
  });

  /** Too thinly tagged to be described, so there is nothing to query on. */
  it("does not run a subject query for a movie with barely any keywords", async () => {
    const catalog = createCatalog();
    catalog.getMovieDetail.mockResolvedValue(createDetail(2));
    catalog.getMovieRecommendations.mockResolvedValue(
      createPage([createMovie(606)]),
    );

    await new MovieCatalogService(catalog).getSimilarMovies(MOVIE_ID, 1);

    expect(catalog.discoverMovies).not.toHaveBeenCalled();
    expect(catalog.getMovieRecommendations).toHaveBeenCalled();
  });

  /** Something questionable beats an empty row, but only once nothing else
   * has an answer. */
  it("reaches for /similar only after both better sources come back empty", async () => {
    const catalog = createCatalog();
    catalog.getSimilarMovies.mockResolvedValue(
      createPage([createMovie(MOVIE_ID), createMovie(607)]),
    );

    const result = await new MovieCatalogService(catalog).getSimilarMovies(
      MOVIE_ID,
      2,
    );

    expect(catalog.getSimilarMovies).toHaveBeenCalledWith({
      movieId: MOVIE_ID,
      page: 2,
    });
    expect(result.data.map((movie) => movie.id)).toEqual([607]);
  });
});
