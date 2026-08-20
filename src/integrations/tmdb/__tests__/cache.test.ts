import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { MovieDetailSchema } from "../../../contracts";
import type { MovieCacheRepository } from "../../../db/repositories";
import type { MovieCacheRecord } from "../../../db/schema/movie-cache";
import movieDetailFixture from "../../../fixtures/tmdb/movie-detail.json";
import movieListFixture from "../../../fixtures/tmdb/movie-list.json";

import {
  TmdbAdapter,
  type TmdbDiscoverOptions as AdapterTmdbDiscoverOptions,
} from "../adapter";
import type { TmdbClient } from "../client";
import { TmdbError } from "../errors";
import {
  TmdbMovieDetailResponseSchema,
  TmdbMovieListResponseSchema,
  type TmdbMovieDetailResponse,
  type TmdbMovieListResponse,
} from "../schemas";
import type {
  PaginatedMovies,
  TmdbDiscoverOptions as PublicTmdbDiscoverOptions,
  TmdbErrorCode,
} from "../index";

type TmdbPublicModule = typeof import("../index");

// @ts-expect-error TmdbClient must remain private to the integration.
type ForbiddenTmdbClient = import("../index").TmdbClient;
// @ts-expect-error Provider request types must remain private.
type ForbiddenDiscoverRequest = import("../index").TmdbDiscoverRequest;
// @ts-expect-error TmdbConfig must remain private to the integration.
type ForbiddenTmdbConfig = import("../index").TmdbConfig;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenGenres = import("../index").TmdbGenresResponse;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenGenre = import("../index").TmdbGenre;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenMovieList = import("../index").TmdbMovieListResponse;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenMovieSummary = import("../index").TmdbMovieSummary;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenMovieDetail = import("../index").TmdbMovieDetailResponse;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenCast = import("../index").TmdbCastMember;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenCrew = import("../index").TmdbCrewMember;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenKeyword = import("../index").TmdbKeyword;
// @ts-expect-error Raw provider types must remain private.
type ForbiddenVideo = import("../index").TmdbVideo;
// @ts-expect-error TMDB constants must remain private to the integration.
type ForbiddenTmdbLanguage = TmdbPublicModule["TMDB_LANGUAGE"];
// @ts-expect-error Raw provider schemas must remain private.
type ForbiddenDetailSchema = TmdbPublicModule["TmdbMovieDetailResponseSchema"];
// @ts-expect-error The cache port must remain private to the adapter.
type ForbiddenMovieCachePort = import("../index").MovieCachePort;

type MovieCachePort = Pick<
  MovieCacheRepository,
  "get" | "set" | "delete" | "isExpired"
>;

type CacheDouble = {
  cache: MovieCachePort;
  get: ReturnType<typeof vi.fn<MovieCachePort["get"]>>;
  set: ReturnType<typeof vi.fn<MovieCachePort["set"]>>;
  delete: ReturnType<typeof vi.fn<MovieCachePort["delete"]>>;
  isExpired: ReturnType<typeof vi.fn<MovieCachePort["isExpired"]>>;
};

type ClientDouble = {
  client: TmdbClient;
  getGenres: ReturnType<typeof vi.fn<TmdbClient["getGenres"]>>;
  searchMovies: ReturnType<typeof vi.fn<TmdbClient["searchMovies"]>>;
  getMovieDetail: ReturnType<typeof vi.fn<TmdbClient["getMovieDetail"]>>;
  discoverMovies: ReturnType<typeof vi.fn<TmdbClient["discoverMovies"]>>;
  getSimilarMovies: ReturnType<typeof vi.fn<TmdbClient["getSimilarMovies"]>>;
};

function unexpectedCall(name: string) {
  return new Error(`Unexpected ${name} call`);
}

function createCacheDouble(): CacheDouble {
  const get = vi
    .fn<MovieCachePort["get"]>()
    .mockRejectedValue(unexpectedCall("cache.get"));
  const set = vi
    .fn<MovieCachePort["set"]>()
    .mockRejectedValue(unexpectedCall("cache.set"));
  const deleteEntry = vi
    .fn<MovieCachePort["delete"]>()
    .mockRejectedValue(unexpectedCall("cache.delete"));
  const isExpired = vi.fn<MovieCachePort["isExpired"]>(() => {
    throw unexpectedCall("cache.isExpired");
  });

  return {
    cache: { get, set, delete: deleteEntry, isExpired },
    get,
    set,
    delete: deleteEntry,
    isExpired,
  };
}

function createClientDouble(): ClientDouble {
  const getGenres = vi
    .fn<TmdbClient["getGenres"]>()
    .mockRejectedValue(unexpectedCall("client.getGenres"));
  const searchMovies = vi
    .fn<TmdbClient["searchMovies"]>()
    .mockRejectedValue(unexpectedCall("client.searchMovies"));
  const getMovieDetail = vi
    .fn<TmdbClient["getMovieDetail"]>()
    .mockRejectedValue(unexpectedCall("client.getMovieDetail"));
  const discoverMovies = vi
    .fn<TmdbClient["discoverMovies"]>()
    .mockRejectedValue(unexpectedCall("client.discoverMovies"));
  const getSimilarMovies = vi
    .fn<TmdbClient["getSimilarMovies"]>()
    .mockRejectedValue(unexpectedCall("client.getSimilarMovies"));

  return {
    client: {
      getGenres,
      searchMovies,
      getMovieDetail,
      discoverMovies,
      getSimilarMovies,
    } as unknown as TmdbClient,
    getGenres,
    searchMovies,
    getMovieDetail,
    discoverMovies,
    getSimilarMovies,
  };
}

function cloneMovieDetail(): TmdbMovieDetailResponse {
  return structuredClone(
    TmdbMovieDetailResponseSchema.parse(movieDetailFixture),
  );
}

function cloneMovieList(): TmdbMovieListResponse {
  return structuredClone(TmdbMovieListResponseSchema.parse(movieListFixture));
}

function createCacheEntry(
  payload: unknown,
  language = "es-AR",
): MovieCacheRecord {
  return {
    movieId: 8101,
    language,
    payload,
    fetchedAt: new Date("2026-08-20T12:00:00.000Z"),
  };
}

describe("TmdbAdapter movie detail cache", () => {
  it("uses the exact repository cache port", () => {
    expectTypeOf<ConstructorParameters<typeof TmdbAdapter>[1]>().toEqualTypeOf<
      MovieCachePort | undefined
    >();
  });

  it("returns a valid unexpired cached detail without calling TMDB", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const raw = cloneMovieDetail();
    const entry = createCacheEntry(raw);
    cache.get.mockResolvedValue(entry);
    cache.isExpired.mockReturnValue(false);

    const result = await new TmdbAdapter(
      client.client,
      cache.cache,
    ).getMovieDetail(8101);

    expect(() => MovieDetailSchema.parse(result)).not.toThrow();
    expect(result.id).toBe(8101);
    expect(cache.get).toHaveBeenCalledWith(8101, "es-AR");
    expect(cache.isExpired).toHaveBeenCalledWith(entry);
    expect(client.getMovieDetail).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it("refreshes an expired entry without deleting it first", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const cachedRaw = cloneMovieDetail();
    cachedRaw.title = "Cached title";
    const entry = createCacheEntry(cachedRaw);
    const providerRaw = cloneMovieDetail();
    providerRaw.title = "Fresh provider title";
    cache.get.mockResolvedValue(entry);
    cache.isExpired.mockReturnValue(true);
    cache.set.mockResolvedValue(createCacheEntry(providerRaw));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    const result = await new TmdbAdapter(
      client.client,
      cache.cache,
    ).getMovieDetail(8101);

    expect(result.title).toBe("Fresh provider title");
    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(cache.set).toHaveBeenCalledWith(8101, "es-AR", providerRaw);
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it("deletes and rebuilds a raw-schema-invalid cached payload", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const corruptEntry = createCacheEntry({ private: "corrupt payload" });
    const providerRaw = cloneMovieDetail();
    cache.get.mockResolvedValue(corruptEntry);
    cache.isExpired.mockReturnValue(false);
    cache.delete.mockResolvedValue(true);
    cache.set.mockResolvedValue(createCacheEntry(providerRaw));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    const result = await new TmdbAdapter(
      client.client,
      cache.cache,
    ).getMovieDetail(8101);

    expect(result.id).toBe(8101);
    expect(cache.delete).toHaveBeenCalledWith(8101, "es-AR");
    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(cache.set).toHaveBeenCalledWith(8101, "es-AR", providerRaw);
  });

  it("treats a raw-valid but public-invalid cached detail as corrupt", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const cachedRaw = cloneMovieDetail();
    cachedRaw.original_language = "x";
    const providerRaw = cloneMovieDetail();
    cache.get.mockResolvedValue(createCacheEntry(cachedRaw));
    cache.isExpired.mockReturnValue(false);
    cache.delete.mockResolvedValue(true);
    cache.set.mockResolvedValue(createCacheEntry(providerRaw));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    const result = await new TmdbAdapter(
      client.client,
      cache.cache,
    ).getMovieDetail(8101);

    expect(result.originalLanguage).toBe("es");
    expect(cache.delete).toHaveBeenCalledWith(8101, "es-AR");
    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(cache.set).toHaveBeenCalledWith(8101, "es-AR", providerRaw);
  });

  it("treats a fresh cached detail for another movie as corrupt", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const cachedRaw = cloneMovieDetail();
    cachedRaw.id = 8102;
    const cachedEntry = createCacheEntry(cachedRaw);
    const providerRaw = cloneMovieDetail();
    cache.get.mockResolvedValue(cachedEntry);
    cache.isExpired.mockReturnValue(false);
    cache.delete.mockResolvedValue(true);
    cache.set.mockResolvedValue(createCacheEntry(providerRaw));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    const result = await new TmdbAdapter(
      client.client,
      cache.cache,
    ).getMovieDetail(8101);

    expect(result.id).toBe(8101);
    expect(cache.isExpired).toHaveBeenCalledWith(cachedEntry);
    expect(cache.delete).toHaveBeenCalledWith(8101, "es-AR");
    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(cache.set).toHaveBeenCalledWith(8101, "es-AR", providerRaw);
    expect(cache.delete.mock.invocationCallOrder[0]).toBeLessThan(
      client.getMovieDetail.mock.invocationCallOrder[0]!,
    );
    expect(client.getMovieDetail.mock.invocationCallOrder[0]).toBeLessThan(
      cache.set.mock.invocationCallOrder[0]!,
    );
  });

  it("propagates cache read failures without calling TMDB", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const readError = new Error("database read failed");
    cache.get.mockRejectedValue(readError);

    await expect(
      new TmdbAdapter(client.client, cache.cache).getMovieDetail(8101),
    ).rejects.toBe(readError);
    expect(client.getMovieDetail).not.toHaveBeenCalled();
    expect(cache.isExpired).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("propagates cache expiry-check failures without calling TMDB", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const expiryError = new Error("expiry check failed");
    cache.get.mockResolvedValue(createCacheEntry(cloneMovieDetail()));
    cache.isExpired.mockImplementation(() => {
      throw expiryError;
    });

    await expect(
      new TmdbAdapter(client.client, cache.cache).getMovieDetail(8101),
    ).rejects.toBe(expiryError);
    expect(client.getMovieDetail).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("refetches a corrupt entry even when best-effort deletion fails", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const providerRaw = cloneMovieDetail();
    cache.get.mockResolvedValue(createCacheEntry(null));
    cache.isExpired.mockReturnValue(false);
    cache.delete.mockRejectedValue(new Error("delete failed"));
    cache.set.mockResolvedValue(createCacheEntry(providerRaw));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    await expect(
      new TmdbAdapter(client.client, cache.cache).getMovieDetail(8101),
    ).resolves.toMatchObject({ id: 8101 });
    expect(cache.delete).toHaveBeenCalledWith(8101, "es-AR");
    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(cache.set).toHaveBeenCalledWith(8101, "es-AR", providerRaw);
  });

  it("returns valid provider detail even when best-effort cache writing fails", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const providerRaw = cloneMovieDetail();
    cache.get.mockResolvedValue(null);
    cache.set.mockRejectedValue(new Error("write failed"));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    const result = await new TmdbAdapter(
      client.client,
      cache.cache,
    ).getMovieDetail(8101);

    expect(() => MovieDetailSchema.parse(result)).not.toThrow();
    expect(cache.set).toHaveBeenCalledWith(8101, "es-AR", providerRaw);
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it("validates provider public detail before attempting to cache it", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const providerRaw = cloneMovieDetail();
    providerRaw.original_language = "x";
    cache.get.mockResolvedValue(null);
    client.getMovieDetail.mockResolvedValue(providerRaw);

    await expect(
      new TmdbAdapter(client.client, cache.cache).getMovieDetail(8101),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(cache.get).toHaveBeenCalledWith(8101, "es-AR");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("rejects a provider detail for another movie before caching it", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const providerRaw = cloneMovieDetail();
    providerRaw.id = 8102;
    providerRaw.title = "PRIVATE_MISMATCHED_DETAIL";
    cache.get.mockResolvedValue(null);
    client.getMovieDetail.mockResolvedValue(providerRaw);
    let thrown: unknown;

    try {
      await new TmdbAdapter(client.client, cache.cache).getMovieDetail(8101);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TmdbError);
    expect(thrown).toMatchObject({
      code: "INVALID_RESPONSE",
      message: "TMDB request failed: INVALID_RESPONSE",
    });
    expect((thrown as Error).cause).toBeUndefined();
    expect(String(thrown)).not.toContain("PRIVATE_MISMATCHED_DETAIL");
    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("rebuilds corrupt alternate-language cache entries in order with the same key", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    const providerRaw = cloneMovieDetail();
    cache.get.mockResolvedValue(
      createCacheEntry({ private: "corrupt payload" }, "pt-BR"),
    );
    cache.isExpired.mockReturnValue(false);
    cache.delete.mockResolvedValue(true);
    cache.set.mockResolvedValue(createCacheEntry(providerRaw, "pt-BR"));
    client.getMovieDetail.mockResolvedValue(providerRaw);

    await new TmdbAdapter(client.client, cache.cache, "pt-BR").getMovieDetail(
      8101,
    );

    expect(cache.get).toHaveBeenCalledWith(8101, "pt-BR");
    expect(cache.delete).toHaveBeenCalledWith(8101, "pt-BR");
    expect(cache.set).toHaveBeenCalledWith(8101, "pt-BR", providerRaw);
    expect(cache.delete.mock.invocationCallOrder[0]).toBeLessThan(
      client.getMovieDetail.mock.invocationCallOrder[0]!,
    );
    expect(client.getMovieDetail.mock.invocationCallOrder[0]).toBeLessThan(
      cache.set.mock.invocationCallOrder[0]!,
    );
  });

  it("never touches movie cache for genres, search, discover or similar", async () => {
    const client = createClientDouble();
    const cache = createCacheDouble();
    client.getGenres.mockResolvedValue({
      genres: [{ id: 7101, name: "Drama" }],
    });
    client.searchMovies.mockResolvedValue(cloneMovieList());
    client.discoverMovies.mockResolvedValue(cloneMovieList());
    client.getSimilarMovies.mockResolvedValue(cloneMovieList());
    const adapter = new TmdbAdapter(client.client, cache.cache);

    await adapter.getGenres();
    await adapter.searchMovies({ query: "ciudad", page: 1 });
    await adapter.discoverMovies({ page: 1 });
    await adapter.getSimilarMovies({ movieId: 8101 });

    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.isExpired).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });
});

describe("TMDB public wiring", () => {
  afterEach(() => {
    vi.doUnmock("../../../lib/env/server");
    vi.doUnmock("../../../db");
    vi.doUnmock("../../../db/repositories");
    vi.doUnmock("../client");
    vi.doUnmock("../adapter");
    vi.resetModules();
  });

  it("exports only the runtime surface and lazily builds one adapter", async () => {
    const database = { kind: "database" };
    const clientInstance = { kind: "client" };
    const cacheInstance = { kind: "cache" };
    const adapterInstance = { kind: "adapter" };
    const getServerEnv = vi.fn(() => ({ TMDB_ACCESS_TOKEN: "unit-token" }));
    const getDatabase = vi.fn(() => database);
    const TmdbClient = vi.fn(function TmdbClientMock() {
      return clientInstance;
    });
    const MovieCacheRepository = vi.fn(function MovieCacheRepositoryMock() {
      return cacheInstance;
    });
    const TmdbAdapterMock = vi.fn(function TmdbAdapterMock() {
      return adapterInstance;
    });

    vi.doMock("../../../lib/env/server", () => ({ getServerEnv }));
    vi.doMock("../../../db", () => ({ getDatabase }));
    vi.doMock("../../../db/repositories", () => ({ MovieCacheRepository }));
    vi.doMock("../client", () => ({ TmdbClient }));
    vi.doMock("../adapter", () => ({ TmdbAdapter: TmdbAdapterMock }));

    const publicModule = await import("../index");

    expect(Object.keys(publicModule).sort()).toEqual([
      "TmdbAdapter",
      "TmdbError",
      "getTmdb",
    ]);
    expect(getServerEnv).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(TmdbClient).not.toHaveBeenCalled();
    expect(MovieCacheRepository).not.toHaveBeenCalled();
    expect(TmdbAdapterMock).not.toHaveBeenCalled();

    const first = publicModule.getTmdb();
    const second = publicModule.getTmdb();

    expect(first).toBe(adapterInstance);
    expect(second).toBe(first);
    expect(getServerEnv).toHaveBeenCalledOnce();
    expect(getDatabase).toHaveBeenCalledOnce();
    expect(TmdbClient).toHaveBeenCalledOnce();
    expect(TmdbClient).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "unit-token",
        language: "es-AR",
      }),
    );
    expect(MovieCacheRepository).toHaveBeenCalledOnce();
    expect(MovieCacheRepository).toHaveBeenCalledWith(database);
    expect(TmdbAdapterMock).toHaveBeenCalledOnce();
    expect(TmdbAdapterMock).toHaveBeenCalledWith(
      clientInstance,
      cacheInstance,
      "es-AR",
    );
  });

  it("exposes adapter results and error codes only as types", () => {
    expectTypeOf<
      Awaited<ReturnType<TmdbAdapter["searchMovies"]>>
    >().toEqualTypeOf<PaginatedMovies>();
    expectTypeOf<PublicTmdbDiscoverOptions>().toEqualTypeOf<AdapterTmdbDiscoverOptions>();
    expectTypeOf<TmdbErrorCode>().toEqualTypeOf<
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "RATE_LIMITED"
      | "TIMEOUT"
      | "UNAVAILABLE"
      | "INVALID_RESPONSE"
    >();
    expectTypeOf<ForbiddenTmdbClient>().toBeAny();
    expectTypeOf<ForbiddenDiscoverRequest>().toBeAny();
    expectTypeOf<ForbiddenTmdbConfig>().toBeAny();
    expectTypeOf<ForbiddenGenres>().toBeAny();
    expectTypeOf<ForbiddenGenre>().toBeAny();
    expectTypeOf<ForbiddenMovieList>().toBeAny();
    expectTypeOf<ForbiddenMovieSummary>().toBeAny();
    expectTypeOf<ForbiddenMovieDetail>().toBeAny();
    expectTypeOf<ForbiddenCast>().toBeAny();
    expectTypeOf<ForbiddenCrew>().toBeAny();
    expectTypeOf<ForbiddenKeyword>().toBeAny();
    expectTypeOf<ForbiddenVideo>().toBeAny();
    expectTypeOf<ForbiddenTmdbLanguage>().toBeAny();
    expectTypeOf<ForbiddenDetailSchema>().toBeAny();
    expectTypeOf<ForbiddenMovieCachePort>().toBeAny();
    expect(TmdbError).toBeTypeOf("function");
  });
});
