import "server-only";

import { z } from "zod";

import {
  GenreSchema,
  MovieDetailSchema,
  MovieSummarySchema,
  PAGE_SIZE,
  PageQuerySchema,
  RecommendationFiltersSchema,
  SearchMoviesResponseSchema,
  TmdbMovieIdSchema,
  TmdbPersonIdSchema,
  paginatedResponseSchema,
  type Genre,
  type MovieDetail,
  type MovieSummary,
  type SearchMoviesQuery,
  type Trailer,
} from "../../contracts";
import type { MovieCacheRepository } from "../../db/repositories";

import type { TmdbClient } from "./client";
import { TMDB_LANGUAGE } from "./config";
import { TmdbError } from "./errors";
import type {
  TmdbMovieDetailResponse,
  TmdbMovieListResponse,
  TmdbMovieSummary,
  TmdbVideo,
} from "./schemas";
import {
  TmdbMovieDetailResponseSchema,
  TmdbPersonSummarySchema,
} from "./schemas";

const PaginatedMoviesSchema = paginatedResponseSchema(MovieSummarySchema);
export type PaginatedMovies = z.infer<typeof PaginatedMoviesSchema>;

const { similarToMovieId: _similarToMovieId, ...tmdbDiscoverFilterShape } =
  RecommendationFiltersSchema.shape;
void _similarToMovieId;

const TmdbDiscoverOptionsSchema = z
  .object({
    ...tmdbDiscoverFilterShape,
    page: PageQuerySchema.shape.page,
  })
  .strict()
  .transform(({ page, ...filters }) => {
    const { similarToMovieId: _parsedSimilarToMovieId, ...parsedFilters } =
      RecommendationFiltersSchema.parse(filters);
    void _parsedSimilarToMovieId;

    return { ...parsedFilters, page };
  });

export type TmdbDiscoverOptions = z.infer<typeof TmdbDiscoverOptionsSchema>;

const FindPersonOptionsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    department: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

/** TMDB's own label for the job, exactly as it appears in a credit. */
const DIRECTOR_JOB = "Director";

/** A detail carries the same fields a summary needs plus the genre objects the
 * list shape flattens back to ids. */
function detailToSummary(detail: MovieDetail): MovieSummary {
  return {
    id: detail.id,
    title: detail.title,
    originalTitle: detail.originalTitle,
    overview: detail.overview,
    posterPath: detail.posterPath,
    backdropPath: detail.backdropPath,
    genreIds: detail.genres.map((genre) => genre.id),
    releaseDate: detail.releaseDate,
    originalLanguage: detail.originalLanguage,
    tmdbRating: detail.tmdbRating,
    tmdbVoteCount: detail.tmdbVoteCount,
  };
}

/** A prolific director has well over a hundred credits and each one costs a
 * detail lookup, so the filmography is capped at a pool wide enough for the
 * ranking to have something to choose from. */
const FilmographyOptionsSchema = z
  .object({
    personId: TmdbPersonIdSchema,
    limit: z.number().int().min(1).max(60).default(30),
    minRuntime: z.number().int().positive().optional(),
    maxRuntime: z.number().int().positive().optional(),
  })
  .strict();

const SimilarMoviesOptionsSchema = z
  .object({
    movieId: TmdbMovieIdSchema,
    page: PageQuerySchema.shape.page,
  })
  .strict();

type MovieCachePort = Pick<
  MovieCacheRepository,
  "get" | "set" | "delete" | "isExpired"
>;

const GenresSchema = z.array(GenreSchema);

function parsePublicResult<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new TmdbError("INVALID_RESPONSE");
    }

    throw error;
  }
}

function mapMovieSummary(movie: TmdbMovieSummary): MovieSummary {
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    genreIds: movie.genre_ids,
    releaseDate: movie.release_date === "" ? null : movie.release_date,
    originalLanguage: movie.original_language,
    tmdbRating: movie.vote_average,
    tmdbVoteCount: movie.vote_count,
  };
}

function mapMovieList(response: TmdbMovieListResponse) {
  return {
    data: response.results.map(mapMovieSummary),
    meta: {
      page: response.page,
      pageSize: PAGE_SIZE,
      totalPages: response.total_pages,
      totalResults: response.total_results,
      hasNextPage: response.page < response.total_pages,
    },
  };
}

function trailerSiteTier(video: TmdbVideo) {
  if (video.site === "YouTube") {
    return video.official ? 0 : 1;
  }

  return video.official ? 2 : 3;
}

function trailerLanguageTier(video: TmdbVideo) {
  if (video.iso_639_1 === "es") {
    return 0;
  }

  if (video.iso_639_1 === "en") {
    return 1;
  }

  return 2;
}

function selectTrailer(videos: TmdbVideo[]): Trailer | null {
  const selected = videos
    .map((video, providerIndex) => ({ providerIndex, video }))
    .filter(
      ({ video }) =>
        video.type === "Trailer" &&
        (video.site === "YouTube" || video.site === "Vimeo"),
    )
    .sort(
      (left, right) =>
        trailerSiteTier(left.video) - trailerSiteTier(right.video) ||
        trailerLanguageTier(left.video) - trailerLanguageTier(right.video) ||
        left.providerIndex - right.providerIndex,
    )[0]?.video;

  if (!selected) {
    return null;
  }

  return {
    name: selected.name,
    site: selected.site,
    key: selected.key,
    official: selected.official,
  };
}

function mapMovieDetail(movie: TmdbMovieDetailResponse): MovieDetail {
  const director = movie.credits.crew.find(({ job }) => job === "Director");
  const cast = movie.credits.cast
    .map((member, providerIndex) => ({ member, providerIndex }))
    .sort(
      (left, right) =>
        left.member.order - right.member.order ||
        left.providerIndex - right.providerIndex,
    )
    .slice(0, 20)
    .map(({ member }) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      profilePath: member.profile_path,
      order: member.order,
    }));

  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    overview: movie.overview,
    tagline: movie.tagline === "" ? null : movie.tagline,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date === "" ? null : movie.release_date,
    runtime: movie.runtime !== null && movie.runtime > 0 ? movie.runtime : null,
    originalLanguage: movie.original_language,
    genres: movie.genres.map(({ id, name }) => ({ id, name })),
    tmdbRating: movie.vote_average,
    tmdbVoteCount: movie.vote_count,
    director: director
      ? {
          id: director.id,
          name: director.name,
          profilePath: director.profile_path,
        }
      : null,
    cast,
    keywords: movie.keywords.keywords
      .slice(0, 50)
      .map(({ id, name }) => ({ id, name })),
    trailer: selectTrailer(movie.videos.results),
  };
}

function parseMovieDetail(
  movie: TmdbMovieDetailResponse,
  expectedMovieId: number,
): MovieDetail {
  const detail = parsePublicResult(MovieDetailSchema, mapMovieDetail(movie));

  if (detail.id !== expectedMovieId) {
    throw new TmdbError("INVALID_RESPONSE");
  }

  return detail;
}

export class TmdbAdapter {
  constructor(
    private readonly client: TmdbClient,
    private readonly cache?: MovieCachePort,
    private readonly language = TMDB_LANGUAGE,
  ) {}

  async getGenres(): Promise<Genre[]> {
    const response = await this.client.getGenres();
    const genres = response.genres.map(({ id, name }) => ({ id, name }));

    return parsePublicResult(GenresSchema, genres);
  }

  async searchMovies(input: SearchMoviesQuery): Promise<PaginatedMovies> {
    const response = await this.client.searchMovies(input);

    return parsePublicResult(
      SearchMoviesResponseSchema.and(PaginatedMoviesSchema),
      mapMovieList(response),
    );
  }

  async getPopularMovies(page: number): Promise<PaginatedMovies> {
    const parsedPage = PageQuerySchema.shape.page.parse(page);
    const response = await this.client.getPopularMovies({ page: parsedPage });

    return parsePublicResult(PaginatedMoviesSchema, mapMovieList(response));
  }

  async getMovieDetail(movieId: number): Promise<MovieDetail> {
    const cache = this.cache;

    if (cache) {
      const cached = await cache.get(movieId, this.language);

      if (cached && !cache.isExpired(cached)) {
        const parsedCached = TmdbMovieDetailResponseSchema.safeParse(
          cached.payload,
        );

        if (parsedCached.success) {
          try {
            return parseMovieDetail(parsedCached.data, movieId);
          } catch (error) {
            if (
              !(error instanceof TmdbError) ||
              error.code !== "INVALID_RESPONSE"
            ) {
              throw error;
            }
          }
        }

        await cache.delete(movieId, this.language).catch(() => false);
      }
    }

    const response = await this.client.getMovieDetail(movieId);
    const detail = parseMovieDetail(response, movieId);

    await cache?.set(movieId, this.language, response).catch(() => undefined);

    return detail;
  }

  async discoverMovies(input: TmdbDiscoverOptions): Promise<PaginatedMovies> {
    const options = TmdbDiscoverOptionsSchema.parse(input);
    const joinIds = (ids: number[] | undefined) =>
      ids && ids.length > 0 ? ids.join(",") : undefined;
    const response = await this.client.discoverMovies({
      page: options.page,
      withGenres: joinIds(options.genreIds),
      withoutGenres: joinIds(options.excludedGenreIds),
      withKeywords: joinIds(options.keywordIds),
      withCast: joinIds(options.castIds),
      withCrew: joinIds(options.crewIds),
      withOriginalLanguage: options.originalLanguage,
      minRuntime: options.minRuntime,
      maxRuntime: options.maxRuntime,
      minVoteAverage: options.minTmdbRating,
      minVoteCount: options.minTmdbVoteCount,
      releasedFromYear: options.minReleaseYear,
      releasedToYear: options.maxReleaseYear,
    });

    return parsePublicResult(PaginatedMoviesSchema, mapMovieList(response));
  }

  /** Turns a name into the id TMDB actually filters on. A model can say
   * "Leonardo DiCaprio"; `with_cast` only takes 6193.
   *
   * `department` breaks the tie when a name belongs to several people, which is
   * the common case rather than the exception: asking for a director called
   * Anderson and an actor called Anderson are different questions. Within a
   * department TMDB's own ordering decides, and its first result for a name a
   * viewer typed unprompted is the famous one. */
  async findPersonId(input: {
    name: string;
    department?: string;
  }): Promise<number | null> {
    const { name, department } = FindPersonOptionsSchema.parse(input);
    const response = await this.client.searchPeople({ query: name, page: 1 });
    const people = parsePublicResult(
      z.array(TmdbPersonSummarySchema),
      response.results,
    );

    if (people.length === 0) {
      return null;
    }

    const inDepartment = department
      ? people.filter(
          (person) =>
            person.known_for_department?.toLowerCase() ===
            department.toLowerCase(),
        )
      : [];

    return (inDepartment[0] ?? people[0])?.id ?? null;
  }

  /** The films a person actually directed, as opposed to every film they were
   * on the crew of. Discover has no filter for the job, so asking it for
   * `with_crew` hands back everything Spielberg ever produced -- Men in Black 3
   * among them -- which is not what somebody asking for a Spielberg movie
   * means.
   *
   * Resolved through the movie cache one id at a time, so a filmography costs
   * nothing the second time it is asked for. */
  async getMoviesDirectedBy(input: {
    personId: number;
    limit?: number;
    minRuntime?: number;
    maxRuntime?: number;
  }): Promise<MovieSummary[]> {
    const options = FilmographyOptionsSchema.parse(input);
    const credits = await this.client.getPersonMovieCredits(options.personId);
    const directed = credits.crew
      .filter((credit) => credit.job === DIRECTOR_JOB)
      .map((credit) => credit.id);

    return this.resolveFilmography(directed, options);
  }

  /** The films a person appeared in, led by the ones they were billed highest
   * on. `with_cast` on discover makes no such distinction: it answers a request
   * for Leonardo DiCaprio with Critters 3, where he had one line in 1991,
   * ranked alongside Titanic. */
  async getMoviesActedIn(input: {
    personId: number;
    limit?: number;
    minRuntime?: number;
    maxRuntime?: number;
  }): Promise<MovieSummary[]> {
    const options = FilmographyOptionsSchema.parse(input);
    const credits = await this.client.getPersonMovieCredits(options.personId);
    const billed = [...credits.cast]
      .sort((left, right) => (left.order ?? 99) - (right.order ?? 99))
      .map((credit) => credit.id);

    return this.resolveFilmography(billed, options);
  }

  /** Runtime is the one bound applied here rather than by the caller: it lives
   * on the detail and not on the summary, so this is the last place that still
   * knows it. */
  private async resolveFilmography(
    movieIds: number[],
    options: { limit: number; minRuntime?: number; maxRuntime?: number },
  ): Promise<MovieSummary[]> {
    const settled = await Promise.allSettled(
      movieIds.slice(0, options.limit).map((id) => this.getMovieDetail(id)),
    );

    return settled
      .filter(
        (result): result is PromiseFulfilledResult<MovieDetail> =>
          result.status === "fulfilled",
      )
      .map(({ value }) => value)
      .filter(
        (detail) =>
          (options.minRuntime === undefined ||
            (detail.runtime ?? 0) >= options.minRuntime) &&
          (options.maxRuntime === undefined ||
            (detail.runtime ?? Number.POSITIVE_INFINITY) <=
              options.maxRuntime),
      )
      .map(detailToSummary);
  }

  /** What the recommender reaches for when a viewer names a movie. `/similar`
   * stays behind `getSimilarMovies` for the detail screen's own row. */
  async getMovieRecommendations(input: {
    movieId: number;
    page?: number;
  }): Promise<PaginatedMovies> {
    const options = SimilarMoviesOptionsSchema.parse(input);
    const response = await this.client.getMovieRecommendations(options);

    return parsePublicResult(PaginatedMoviesSchema, mapMovieList(response));
  }

  async getSimilarMovies(input: {
    movieId: number;
    page?: number;
  }): Promise<PaginatedMovies> {
    const options = SimilarMoviesOptionsSchema.parse(input);
    const response = await this.client.getSimilarMovies(options);

    return parsePublicResult(PaginatedMoviesSchema, mapMovieList(response));
  }
}
