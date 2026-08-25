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
  | "getGenres"
  | "getPopularMovies"
  | "searchMovies"
  | "getSimilarMovies"
  | "getMovieDetail"
  | "getMovieRecommendations"
  | "discoverMovies"
>;

/** Enough angles on the film to describe it, few enough to stay about it.
 * TMDB orders them with the defining ones first. */
const SIMILARITY_KEYWORDS = 8;
/** Below this a movie has nothing to match on and the query would answer with
 * whatever shares its genres, which is what `/similar` already does badly. */
const MIN_SIMILARITY_KEYWORDS = 3;
/** The floor that keeps the row out of the parts of the catalogue nobody has
 * seen or rated. It is also what can leave an obscure film with no answer,
 * which is what the fallbacks below are for. */
const MIN_VOTES_TO_SUGGEST = 200;

/** Thin catalog boundary for public, normalized TMDB list reads. */
export class MovieCatalogService {
  constructor(private readonly catalog: MovieCatalogPort) {}

  searchMovies(input: SearchMoviesQuery): Promise<PaginatedMovies> {
    return this.catalog.searchMovies(input);
  }

  getPopularMovies(page: number): Promise<PaginatedMovies> {
    return this.catalog.getPopularMovies(page);
  }

  getGenres(): Promise<Genre[]> {
    return this.catalog.getGenres();
  }

  /** Movies that resemble this one, in three tries.
   *
   * The first asks what the film is about. TMDB tags every movie with
   * keywords -- Interstellar carries `spacecraft`, `time warp`, `dystopia` --
   * and they already arrived with the detail the viewer is reading, so this
   * costs nothing to ask. Keywords match on any, genres on all: same subject,
   * same shelf.
   *
   * When the film is too thinly tagged for that, or the query comes back with
   * nothing, it falls to TMDB's own recommendations, which are built from what
   * audiences actually watch together. `/similar` is the last resort, and only
   * because a row with something questionable in it beats an empty one: it
   * matches on genre and keyword overlap alone, and answers The Dark Knight
   * with Charlie's Angels. */
  async getSimilarMovies(
    movieId: number,
    page: number,
  ): Promise<PaginatedMovies> {
    const bySubject = await this.discoverBySubject(movieId, page);

    if (bySubject) {
      return bySubject;
    }

    const recommended = await this.catalog.getMovieRecommendations({
      movieId,
      page,
    });

    if (recommended.meta.totalResults > 0) {
      return this.withoutSelf(recommended, movieId);
    }

    return this.withoutSelf(
      await this.catalog.getSimilarMovies({ movieId, page }),
      movieId,
    );
  }

  private withoutSelf(
    results: PaginatedMovies,
    movieId: number,
  ): PaginatedMovies {
    return {
      ...results,
      data: results.data.filter((movie) => movie.id !== movieId),
    };
  }

  /** Null rather than an empty page, so the caller knows to try another way.
   * A movie the catalogue barely knows takes this route to nowhere. */
  private async discoverBySubject(
    movieId: number,
    page: number,
  ): Promise<PaginatedMovies | null> {
    const detail = await this.catalog.getMovieDetail(movieId);
    const keywordIds = detail.keywords
      .slice(0, SIMILARITY_KEYWORDS)
      .map((keyword) => keyword.id);

    if (keywordIds.length < MIN_SIMILARITY_KEYWORDS) {
      return null;
    }

    const results = await this.catalog.discoverMovies({
      page,
      keywordIds,
      genreIds: detail.genres.map((genre) => genre.id),
      minTmdbVoteCount: MIN_VOTES_TO_SUGGEST,
    });

    // Judged on the whole set rather than this page, so a viewer who walks to
    // the end does not fall through to a different source on the last step.
    return results.meta.totalResults > 0
      ? this.withoutSelf(results, movieId)
      : null;
  }
}

export function getMovieCatalogService(): MovieCatalogService {
  return new MovieCatalogService(getTmdb());
}
