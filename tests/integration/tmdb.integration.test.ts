import { count } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  GenreSchema,
  MovieDetailSchema,
  MovieSummarySchema,
  PAGE_SIZE,
} from "../../src/contracts";
import { MovieCacheRepository } from "../../src/db/repositories";
import { movieCache } from "../../src/db/schema";
import { TmdbAdapter } from "../../src/integrations/tmdb/adapter";
import { TmdbClient } from "../../src/integrations/tmdb/client";
import {
  createTmdbConfig,
  TMDB_LANGUAGE,
} from "../../src/integrations/tmdb/config";
import { TmdbError } from "../../src/integrations/tmdb/errors";
import { TmdbMovieDetailResponseSchema } from "../../src/integrations/tmdb/schemas";
import { createIntegrationDatabase } from "./support/database";
import { getIntegrationEnv } from "./support/env";

const INTERSTELLAR_MOVIE_ID = 157_336;
const DRAMA_GENRE_ID = 18;
const SCIENCE_FICTION_GENRE_ID = 878;
const UNKNOWN_MOVIE_ID = 999_999_999;

let database: ReturnType<typeof createIntegrationDatabase> | undefined;
let movieCacheRepository: MovieCacheRepository | undefined;
let tmdb: TmdbAdapter | undefined;
let requestCount = 0;

const countingFetch: typeof fetch = (input, init) => {
  requestCount += 1;
  return fetch(input, init);
};

beforeAll(() => {
  database = createIntegrationDatabase();
  movieCacheRepository = new MovieCacheRepository(database.db);
  tmdb = new TmdbAdapter(
    new TmdbClient(
      createTmdbConfig(getIntegrationEnv().TMDB_ACCESS_TOKEN),
      countingFetch,
    ),
    movieCacheRepository,
    TMDB_LANGUAGE,
  );
});

afterAll(async () => {
  try {
    await movieCacheRepository?.delete(INTERSTELLAR_MOVIE_ID, TMDB_LANGUAGE);
  } finally {
    await database?.close();
  }
});

function getTmdbAdapter() {
  if (!tmdb) {
    throw new Error("TMDB adapter was not created");
  }

  return tmdb;
}

function getMovieCacheRepository() {
  if (!movieCacheRepository) {
    throw new Error("Movie cache repository was not created");
  }

  return movieCacheRepository;
}

function getDatabase() {
  if (!database) {
    throw new Error("Integration database connection was not created");
  }

  return database.db;
}

async function countMovieCacheRows() {
  const [row] = await getDatabase().select({ rows: count() }).from(movieCache);

  return row?.rows ?? 0;
}

describe("live TMDB operations", () => {
  it("getGenres returns the shared genre contract", async () => {
    const genres = await getTmdbAdapter().getGenres();

    expect(genres.length).toBeGreaterThan(0);
    expect(genres.some((genre) => genre.id === DRAMA_GENRE_ID)).toBe(true);
    expect(GenreSchema.array().safeParse(genres).success).toBe(true);
  });

  it("searchMovies finds a stable movie and paginates by twenty", async () => {
    const search = await getTmdbAdapter().searchMovies({
      query: "Interstellar",
      page: 1,
    });

    expect(
      search.data.some((movie) => movie.id === INTERSTELLAR_MOVIE_ID),
    ).toBe(true);
    expect(MovieSummarySchema.array().safeParse(search.data).success).toBe(
      true,
    );
    expect(search.meta.page).toBe(1);
    expect(search.meta.pageSize).toBe(PAGE_SIZE);
    expect(search.data.length).toBeLessThanOrEqual(PAGE_SIZE);
  });

  it("getMovieDetail returns the requested movie inside the detail contract", async () => {
    const detail = await getTmdbAdapter().getMovieDetail(INTERSTELLAR_MOVIE_ID);

    expect(detail.id).toBe(INTERSTELLAR_MOVIE_ID);
    expect(MovieDetailSchema.safeParse(detail).success).toBe(true);
    expect(detail.cast.length).toBeLessThanOrEqual(20);
    expect(detail.keywords.length).toBeLessThanOrEqual(50);
  });

  it("discoverMovies applies the translated provider filters", async () => {
    const discovered = await getTmdbAdapter().discoverMovies({
      genreIds: [SCIENCE_FICTION_GENRE_ID],
      minTmdbVoteCount: 1_000,
      page: 1,
    });

    expect(discovered.data.length).toBeGreaterThan(0);
    expect(MovieSummarySchema.array().safeParse(discovered.data).success).toBe(
      true,
    );
    expect(discovered.data.every((movie) => movie.tmdbVoteCount >= 1_000)).toBe(
      true,
    );
    expect(discovered.meta.page).toBe(1);
    expect(discovered.meta.pageSize).toBe(PAGE_SIZE);
  });

  it("getSimilarMovies returns candidates for a stable movie", async () => {
    const similar = await getTmdbAdapter().getSimilarMovies({
      movieId: INTERSTELLAR_MOVIE_ID,
      page: 1,
    });

    expect(similar.data.length).toBeGreaterThan(0);
    expect(MovieSummarySchema.array().safeParse(similar.data).success).toBe(
      true,
    );
    expect(similar.meta.page).toBe(1);
    expect(similar.meta.pageSize).toBe(PAGE_SIZE);
  });

  it("normalizes an unknown movie into NOT_FOUND without exposing the token", async () => {
    const rejection = await getTmdbAdapter()
      .getMovieDetail(UNKNOWN_MOVIE_ID)
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(rejection).toBeInstanceOf(TmdbError);
    expect((rejection as TmdbError).code).toBe("NOT_FOUND");
    expect(
      String(rejection).includes(getIntegrationEnv().TMDB_ACCESS_TOKEN),
    ).toBe(false);
    expect(
      await getMovieCacheRepository().get(UNKNOWN_MOVIE_ID, TMDB_LANGUAGE),
    ).toBeNull();
  });
});

describe("live movie cache", () => {
  it("stores a validatable detail payload and serves the next call from PostgreSQL", async () => {
    const repository = getMovieCacheRepository();

    await repository.delete(INTERSTELLAR_MOVIE_ID, TMDB_LANGUAGE);
    requestCount = 0;

    const fromProvider = await getTmdbAdapter().getMovieDetail(
      INTERSTELLAR_MOVIE_ID,
    );
    const requestsAfterProvider = requestCount;
    const entry = await repository.get(INTERSTELLAR_MOVIE_ID, TMDB_LANGUAGE);

    expect(requestsAfterProvider).toBe(1);
    expect(entry).not.toBeNull();
    expect(entry?.movieId).toBe(INTERSTELLAR_MOVIE_ID);
    expect(entry?.language).toBe(TMDB_LANGUAGE);
    expect(entry && repository.isExpired(entry)).toBe(false);
    expect(
      TmdbMovieDetailResponseSchema.safeParse(entry?.payload).success,
    ).toBe(true);

    const fromCache = await getTmdbAdapter().getMovieDetail(
      INTERSTELLAR_MOVIE_ID,
    );

    expect(requestCount).toBe(requestsAfterProvider);
    expect(fromCache).toEqual(fromProvider);
  });

  it("never caches genres, search, discover or similar results", async () => {
    const adapter = getTmdbAdapter();
    const rowsBefore = await countMovieCacheRows();

    await adapter.getGenres();
    await adapter.searchMovies({ query: "Interstellar", page: 1 });
    await adapter.discoverMovies({
      genreIds: [SCIENCE_FICTION_GENRE_ID],
      page: 1,
    });
    await adapter.getSimilarMovies({
      movieId: INTERSTELLAR_MOVIE_ID,
      page: 1,
    });

    expect(await countMovieCacheRows()).toBe(rowsBefore);
  });
});
