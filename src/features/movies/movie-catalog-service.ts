import "server-only";

import type { Genre } from "@/contracts/movies";
import type { SearchMoviesQuery } from "@/contracts/search";
import {
  getTmdb,
  type PaginatedMovies,
  type TmdbAdapter,
} from "@/integrations/tmdb";

type MovieCatalogPort = Pick<
  TmdbAdapter,
  "getGenres" | "searchMovies" | "getSimilarMovies"
>;

/** Thin catalog boundary for public, normalized TMDB list reads. */
export class MovieCatalogService {
  constructor(private readonly catalog: MovieCatalogPort) {}

  searchMovies(input: SearchMoviesQuery): Promise<PaginatedMovies> {
    return this.catalog.searchMovies(input);
  }

  getGenres(): Promise<Genre[]> {
    return this.catalog.getGenres();
  }

  async getSimilarMovies(
    movieId: number,
    page: number,
  ): Promise<PaginatedMovies> {
    const results = await this.catalog.getSimilarMovies({ movieId, page });

    return {
      ...results,
      data: results.data.filter((movie) => movie.id !== movieId),
    };
  }
}

export function getMovieCatalogService(): MovieCatalogService {
  return new MovieCatalogService(getTmdb());
}
