import "server-only";

import type { ZodType } from "zod";

import type { TmdbConfig } from "./config";
import { TmdbError } from "./errors";
import {
  TmdbGenresResponseSchema,
  TmdbMovieDetailResponseSchema,
  TmdbMovieListResponseSchema,
  TmdbPersonCreditsResponseSchema,
  TmdbPersonListResponseSchema,
  type TmdbGenresResponse,
  type TmdbMovieDetailResponse,
  type TmdbMovieListResponse,
  type TmdbPersonCreditsResponse,
  type TmdbPersonListResponse,
} from "./schemas";

type QueryValue = string | number | boolean | undefined;
type Query = Record<string, QueryValue>;

export type TmdbDiscoverRequest = {
  page: number;
  withGenres?: string;
  withoutGenres?: string;
  withKeywords?: string;
  withCast?: string;
  withCrew?: string;
  withOriginalLanguage?: string;
  minRuntime?: number;
  maxRuntime?: number;
  minVoteAverage?: number;
  minVoteCount?: number;
  releasedFromYear?: number;
  releasedToYear?: number;
};

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function mapTransportError(error: unknown, didTimeout: boolean) {
  if (error instanceof TmdbError) {
    return error;
  }

  if (didTimeout && isAbortError(error)) {
    return new TmdbError("TIMEOUT");
  }

  return new TmdbError("UNAVAILABLE");
}

function mapHttpError(status: number) {
  if (status === 401) {
    return new TmdbError("UNAUTHORIZED", status);
  }

  if (status === 404) {
    return new TmdbError("NOT_FOUND", status);
  }

  if (status === 429) {
    return new TmdbError("RATE_LIMITED", status);
  }

  return new TmdbError("UNAVAILABLE", status);
}

export class TmdbClient {
  constructor(
    private readonly config: TmdbConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  getGenres(): Promise<TmdbGenresResponse> {
    return this.request(
      "/genre/movie/list",
      { language: this.config.language },
      TmdbGenresResponseSchema,
    );
  }

  searchMovies(input: {
    query: string;
    page: number;
  }): Promise<TmdbMovieListResponse> {
    return this.request(
      "/search/movie",
      {
        language: this.config.language,
        region: this.config.region,
        include_adult: this.config.includeAdult,
        query: input.query,
        page: input.page,
      },
      TmdbMovieListResponseSchema,
    );
  }

  searchPeople(input: {
    query: string;
    page: number;
  }): Promise<TmdbPersonListResponse> {
    return this.request(
      "/search/person",
      {
        language: this.config.language,
        include_adult: this.config.includeAdult,
        query: input.query,
        page: input.page,
      },
      TmdbPersonListResponseSchema,
    );
  }

  getPersonMovieCredits(personId: number): Promise<TmdbPersonCreditsResponse> {
    return this.request(
      `/person/${personId}/movie_credits`,
      { language: this.config.language },
      TmdbPersonCreditsResponseSchema,
    );
  }

  getMovieDetail(movieId: number): Promise<TmdbMovieDetailResponse> {
    return this.request(
      `/movie/${movieId}`,
      {
        language: this.config.language,
        append_to_response: "credits,keywords,videos",
      },
      TmdbMovieDetailResponseSchema,
    );
  }

  discoverMovies(input: TmdbDiscoverRequest): Promise<TmdbMovieListResponse> {
    return this.request(
      "/discover/movie",
      {
        language: this.config.language,
        region: this.config.region,
        include_adult: this.config.includeAdult,
        page: input.page,
        with_genres: input.withGenres,
        without_genres: input.withoutGenres,
        with_keywords: input.withKeywords,
        with_cast: input.withCast,
        with_crew: input.withCrew,
        with_original_language: input.withOriginalLanguage,
        "with_runtime.gte": input.minRuntime,
        "with_runtime.lte": input.maxRuntime,
        "vote_average.gte": input.minVoteAverage,
        "vote_count.gte": input.minVoteCount,
        // TMDB takes dates here, not years. The viewer said a year, so the
        // bounds open on its first day and close on its last.
        "primary_release_date.gte": input.releasedFromYear
          ? `${input.releasedFromYear}-01-01`
          : undefined,
        "primary_release_date.lte": input.releasedToYear
          ? `${input.releasedToYear}-12-31`
          : undefined,
      },
      TmdbMovieListResponseSchema,
    );
  }

  /** TMDB's editorial "you might also like", as opposed to `/similar`, which
   * matches on genre and keyword overlap alone and is happy to answer
   * Interstellar with a direct-to-video sequel rated 3.3. */
  getMovieRecommendations(input: {
    movieId: number;
    page: number;
  }): Promise<TmdbMovieListResponse> {
    return this.request(
      `/movie/${input.movieId}/recommendations`,
      {
        language: this.config.language,
        page: input.page,
      },
      TmdbMovieListResponseSchema,
    );
  }

  getSimilarMovies(input: {
    movieId: number;
    page: number;
  }): Promise<TmdbMovieListResponse> {
    return this.request(
      `/movie/${input.movieId}/similar`,
      {
        language: this.config.language,
        page: input.page,
      },
      TmdbMovieListResponseSchema,
    );
  }

  private async request<T>(
    path: string,
    query: Query,
    schema: ZodType<T>,
  ): Promise<T> {
    const searchParams = new URLSearchParams();

    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) {
        searchParams.set(name, String(value));
      }
    }

    const url = new URL(`${this.config.baseUrl}${path}`);
    url.search = searchParams.toString();
    const controller = new AbortController();
    let didTimeout = false;
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      let response: Response;

      try {
        response = await this.fetchImpl(url, {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            accept: "application/json",
          },
          signal: controller.signal,
        });
      } catch (error) {
        throw mapTransportError(error, didTimeout);
      }

      if (!response.ok) {
        throw mapHttpError(response.status);
      }

      let body: unknown;

      try {
        body = await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new TmdbError("INVALID_RESPONSE");
        }

        throw mapTransportError(error, didTimeout);
      }

      const result = schema.safeParse(body);

      if (!result.success) {
        throw new TmdbError("INVALID_RESPONSE");
      }

      return result.data;
    } finally {
      clearTimeout(timeout);
    }
  }
}
