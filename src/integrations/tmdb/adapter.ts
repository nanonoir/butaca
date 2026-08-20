import "server-only";

import { z } from "zod";

import {
  GenreSchema,
  MovieDetailSchema,
  MovieSummarySchema,
  PAGE_SIZE,
  SearchMoviesResponseSchema,
  paginatedResponseSchema,
  type Genre,
  type MovieDetail,
  type MovieSummary,
  type SearchMoviesQuery,
  type Trailer,
} from "../../contracts";

import type { TmdbClient } from "./client";
import { TmdbError } from "./errors";
import type {
  TmdbMovieDetailResponse,
  TmdbMovieSummary,
  TmdbVideo,
} from "./schemas";

const PaginatedMoviesSchema = paginatedResponseSchema(MovieSummarySchema);
type PaginatedMovies = z.infer<typeof PaginatedMoviesSchema>;

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

export class TmdbAdapter {
  constructor(private readonly client: TmdbClient) {}

  async getGenres(): Promise<Genre[]> {
    const response = await this.client.getGenres();
    const genres = response.genres.map(({ id, name }) => ({ id, name }));

    return parsePublicResult(GenresSchema, genres);
  }

  async searchMovies(input: SearchMoviesQuery): Promise<PaginatedMovies> {
    const response = await this.client.searchMovies(input);
    const movies = {
      data: response.results.map(mapMovieSummary),
      meta: {
        page: response.page,
        pageSize: PAGE_SIZE,
        totalPages: response.total_pages,
        totalResults: response.total_results,
        hasNextPage: response.page < response.total_pages,
      },
    };

    return parsePublicResult(
      SearchMoviesResponseSchema.and(PaginatedMoviesSchema),
      movies,
    );
  }

  async getMovieDetail(movieId: number): Promise<MovieDetail> {
    const response = await this.client.getMovieDetail(movieId);

    return parsePublicResult(MovieDetailSchema, mapMovieDetail(response));
  }
}
