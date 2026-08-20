import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

import {
  GenreSchema,
  MovieDetailSchema,
  SearchMoviesResponseSchema,
} from "../../../contracts";
import genresFixture from "../../../fixtures/tmdb/genres.json";
import movieDetailFixture from "../../../fixtures/tmdb/movie-detail.json";
import movieListFixture from "../../../fixtures/tmdb/movie-list.json";

import { TmdbAdapter, type TmdbDiscoverOptions } from "../adapter";
import type { TmdbClient } from "../client";
import { TmdbError } from "../errors";
import {
  TmdbGenresResponseSchema,
  TmdbMovieDetailResponseSchema,
  TmdbMovieListResponseSchema,
  type TmdbGenresResponse,
  type TmdbMovieDetailResponse,
  type TmdbMovieListResponse,
} from "../schemas";

type ClientDouble = {
  client: TmdbClient;
  getGenres: ReturnType<typeof vi.fn<TmdbClient["getGenres"]>>;
  searchMovies: ReturnType<typeof vi.fn<TmdbClient["searchMovies"]>>;
  getMovieDetail: ReturnType<typeof vi.fn<TmdbClient["getMovieDetail"]>>;
  discoverMovies: ReturnType<typeof vi.fn<TmdbClient["discoverMovies"]>>;
  getSimilarMovies: ReturnType<typeof vi.fn<TmdbClient["getSimilarMovies"]>>;
};

function createClientDouble(): ClientDouble {
  const getGenres = vi.fn<TmdbClient["getGenres"]>();
  const searchMovies = vi.fn<TmdbClient["searchMovies"]>();
  const getMovieDetail = vi.fn<TmdbClient["getMovieDetail"]>();
  const discoverMovies = vi.fn<TmdbClient["discoverMovies"]>();
  const getSimilarMovies = vi.fn<TmdbClient["getSimilarMovies"]>();

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

function cloneGenres(): TmdbGenresResponse {
  return structuredClone(TmdbGenresResponseSchema.parse(genresFixture));
}

function cloneMovieList(): TmdbMovieListResponse {
  return structuredClone(TmdbMovieListResponseSchema.parse(movieListFixture));
}

function cloneMovieDetail(): TmdbMovieDetailResponse {
  return structuredClone(
    TmdbMovieDetailResponseSchema.parse(movieDetailFixture),
  );
}

async function expectSanitizedInvalidResponse(
  operation: Promise<unknown>,
  forbiddenText: string,
) {
  let thrown: unknown;

  try {
    await operation;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(TmdbError);
  expect(thrown).toMatchObject({
    code: "INVALID_RESPONSE",
    message: "TMDB request failed: INVALID_RESPONSE",
  });
  expect((thrown as Error).cause).toBeUndefined();
  expect(String(thrown)).not.toContain(forbiddenText);
}

async function expectInputZodError(operation: Promise<unknown>) {
  let thrown: unknown;

  try {
    await operation;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(z.ZodError);
  expect(thrown).not.toBeInstanceOf(TmdbError);
}

describe("TMDB fixtures", () => {
  it("uses valid provider shapes with bounded test-data prerequisites", () => {
    const genres = TmdbGenresResponseSchema.parse(genresFixture);
    const movieList = TmdbMovieListResponseSchema.parse(movieListFixture);
    const detail = TmdbMovieDetailResponseSchema.parse(movieDetailFixture);

    expect(genres.genres.length).toBeGreaterThan(0);
    expect(movieList.results.length).toBeGreaterThan(0);
    expect(detail.credits.cast.length).toBeGreaterThan(20);
    expect(detail.keywords.keywords.length).toBeGreaterThan(50);
    expect(
      detail.credits.crew.filter(({ job }) => job === "Director"),
    ).toHaveLength(2);
    expect(
      detail.videos.results.map(({ site, official, iso_639_1 }) => ({
        site,
        official,
        language: iso_639_1,
      })),
    ).toEqual(
      expect.arrayContaining([
        { site: "YouTube", official: true, language: "es" },
        { site: "YouTube", official: false, language: "es" },
        { site: "Vimeo", official: true, language: "es" },
        { site: "Vimeo", official: false, language: "en" },
      ]),
    );
  });

  it("stores image paths instead of complete image URLs", () => {
    const serializedFixtures = JSON.stringify({
      genresFixture,
      movieListFixture,
      movieDetailFixture,
    });

    expect(serializedFixtures).not.toMatch(/https?:\/\//);
  });
});

describe("TmdbAdapter.getGenres", () => {
  it("maps genres and validates the public genre contract", async () => {
    const client = createClientDouble();
    client.getGenres.mockResolvedValue(cloneGenres());

    const result = await new TmdbAdapter(client.client).getGenres();

    expect(result).toEqual([
      { id: 7101, name: "Drama" },
      { id: 7102, name: "Misterio" },
      { id: 7103, name: "Aventura" },
    ]);
    expect(() => GenreSchema.array().parse(result)).not.toThrow();
    expect(client.getGenres).toHaveBeenCalledOnce();
  });

  it("converts public genre validation failures to a sanitized error", async () => {
    const client = createClientDouble();
    const raw = cloneGenres();
    raw.genres[0]!.name = "";
    raw.genres[1]!.name = "PRIVATE_PROVIDER_GENRE";
    client.getGenres.mockResolvedValue(raw);

    await expectSanitizedInvalidResponse(
      new TmdbAdapter(client.client).getGenres(),
      "PRIVATE_PROVIDER_GENRE",
    );
  });
});

describe("TmdbAdapter.searchMovies", () => {
  it("maps snake_case summaries and provider pagination", async () => {
    const client = createClientDouble();
    client.searchMovies.mockResolvedValue(cloneMovieList());
    const input = { query: "ciudad", page: 2 };

    const result = await new TmdbAdapter(client.client).searchMovies(input);

    expect(client.searchMovies).toHaveBeenCalledWith(input);
    expect(result).toEqual({
      data: [
        {
          id: 8101,
          title: "La ciudad de vidrio",
          originalTitle: "The Glass City",
          overview: "Una archivista descubre un mapa imposible bajo la ciudad.",
          posterPath: "/glass-city-poster.jpg",
          backdropPath: "/glass-city-backdrop.jpg",
          genreIds: [7101, 7102],
          releaseDate: "2025-04-18",
          originalLanguage: "es",
          tmdbRating: 7.4,
          tmdbVoteCount: 1842,
        },
        {
          id: 8102,
          title: "Órbita silenciosa",
          originalTitle: "Silent Orbit",
          overview:
            "Una tripulación despierta sin recuerdos cerca de un planeta desconocido.",
          posterPath: null,
          backdropPath: "/silent-orbit-backdrop.jpg",
          genreIds: [7102, 7103],
          releaseDate: null,
          originalLanguage: "en",
          tmdbRating: 6.8,
          tmdbVoteCount: 731,
        },
      ],
      meta: {
        page: 2,
        pageSize: 20,
        totalPages: 4,
        totalResults: 62,
        hasNextPage: true,
      },
    });
    expect(() => SearchMoviesResponseSchema.parse(result)).not.toThrow();
  });

  it("preserves provider totals and reports no next page on the last page", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.page = 4;
    client.searchMovies.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).searchMovies({
      query: "ciudad",
      page: 4,
    });

    expect(result.meta).toEqual({
      page: 4,
      pageSize: 20,
      totalPages: 4,
      totalResults: 62,
      hasNextPage: false,
    });
    expect(result.data).toHaveLength(raw.results.length);
  });

  it("supports a provider response with zero total pages", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.page = 1;
    raw.results = [];
    raw.total_pages = 0;
    raw.total_results = 0;
    client.searchMovies.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).searchMovies({
      query: "sin resultados",
      page: 1,
    });

    expect(result).toEqual({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 0,
        totalResults: 0,
        hasNextPage: false,
      },
    });
  });

  it("does not normalize whitespace or malformed release dates", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.results[0]!.release_date = " ";
    client.searchMovies.mockResolvedValue(raw);

    await expectSanitizedInvalidResponse(
      new TmdbAdapter(client.client).searchMovies({ query: "fecha", page: 1 }),
      "release_date",
    );
  });

  it("converts public summary validation failures to a sanitized error", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.results[0]!.title = "PRIVATE_RAW_TITLE";
    raw.results[0]!.vote_average = 12;
    client.searchMovies.mockResolvedValue(raw);

    await expectSanitizedInvalidResponse(
      new TmdbAdapter(client.client).searchMovies({ query: "rating", page: 1 }),
      "PRIVATE_RAW_TITLE",
    );
  });
});

describe("TmdbAdapter.getMovieDetail", () => {
  it("maps detail fields and validates the public detail contract", async () => {
    const client = createClientDouble();
    client.getMovieDetail.mockResolvedValue(cloneMovieDetail());

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(client.getMovieDetail).toHaveBeenCalledWith(8101);
    expect(result).toMatchObject({
      id: 8101,
      title: "La ciudad de vidrio",
      originalTitle: "The Glass City",
      overview: "Una archivista descubre un mapa imposible bajo la ciudad.",
      tagline: "Cada reflejo guarda una salida.",
      posterPath: "/glass-city-poster.jpg",
      backdropPath: "/glass-city-backdrop.jpg",
      releaseDate: "2025-04-18",
      runtime: 118,
      originalLanguage: "es",
      genres: [
        { id: 7101, name: "Drama" },
        { id: 7102, name: "Misterio" },
      ],
      tmdbRating: 7.4,
      tmdbVoteCount: 1842,
      director: {
        id: 9202,
        name: "Ana Paredes",
        profilePath: "/ana-paredes.jpg",
      },
      trailer: {
        name: "Tráiler oficial",
        site: "YouTube",
        key: "youtube-official-es",
        official: true,
      },
    });
    expect(() => MovieDetailSchema.parse(result)).not.toThrow();
  });

  it("normalizes only empty optional strings and non-positive runtimes", async () => {
    const client = createClientDouble();
    const zeroRuntime = cloneMovieDetail();
    zeroRuntime.release_date = "";
    zeroRuntime.tagline = "";
    zeroRuntime.runtime = 0;
    client.getMovieDetail.mockResolvedValueOnce(zeroRuntime);

    const zeroResult = await new TmdbAdapter(client.client).getMovieDetail(
      8101,
    );

    expect(zeroResult).toMatchObject({
      releaseDate: null,
      tagline: null,
      runtime: null,
    });

    const negativeRuntime = cloneMovieDetail();
    negativeRuntime.tagline = "   ";
    negativeRuntime.runtime = -12;
    client.getMovieDetail.mockResolvedValueOnce(negativeRuntime);

    const negativeResult = await new TmdbAdapter(client.client).getMovieDetail(
      8101,
    );

    expect(negativeResult.tagline).toBe("   ");
    expect(negativeResult.runtime).toBeNull();
  });

  it("selects the first exact Director and returns null when absent", async () => {
    const client = createClientDouble();
    const withDirectors = cloneMovieDetail();
    client.getMovieDetail.mockResolvedValueOnce(withDirectors);

    const withDirector = await new TmdbAdapter(client.client).getMovieDetail(
      8101,
    );

    expect(withDirector.director?.id).toBe(9202);

    const withoutDirector = cloneMovieDetail();
    withoutDirector.credits.crew = withoutDirector.credits.crew.map((member) =>
      member.job === "Director" ? { ...member, job: "director" } : member,
    );
    client.getMovieDetail.mockResolvedValueOnce(withoutDirector);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.director).toBeNull();
  });

  it("stably sorts cast by order, limits it to twenty, and preserves input", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.credits.cast[0]!.order = 3;
    raw.credits.cast[1]!.order = 1;
    raw.credits.cast[2]!.order = 1;
    raw.credits.cast[3]!.order = 0;
    const castBeforeMapping = structuredClone(raw.credits.cast);
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.cast).toHaveLength(20);
    expect(result.cast.slice(0, 6).map(({ id }) => id)).toEqual([
      9104, 9102, 9103, 9105, 9101, 9106,
    ]);
    expect(raw.credits.cast).toEqual(castBeforeMapping);
  });

  it("preserves keyword order and limits keywords to fifty", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.keywords).toHaveLength(50);
    expect(result.keywords.map(({ id }) => id)).toEqual(
      raw.keywords.keywords.slice(0, 50).map(({ id }) => id),
    );
  });

  it("prioritizes trailer site tier before language", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "YouTube no oficial en español",
        site: "YouTube",
        type: "Trailer",
        official: false,
        iso_639_1: "es",
        key: "unofficial-youtube-es",
      },
      {
        name: "Official YouTube in English",
        site: "YouTube",
        type: "Trailer",
        official: true,
        iso_639_1: "en",
        key: "official-youtube-en",
      },
      {
        name: "Vimeo oficial en español",
        site: "Vimeo",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "official-vimeo-es",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer?.key).toBe("official-youtube-en");
  });

  it("prefers unofficial YouTube over official Vimeo", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "Vimeo oficial",
        site: "Vimeo",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "official-vimeo",
      },
      {
        name: "YouTube no oficial",
        site: "YouTube",
        type: "Trailer",
        official: false,
        iso_639_1: "en",
        key: "unofficial-youtube",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer?.key).toBe("unofficial-youtube");
  });

  it("prefers official Vimeo over unofficial Vimeo", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "Vimeo no oficial en español",
        site: "Vimeo",
        type: "Trailer",
        official: false,
        iso_639_1: "es",
        key: "unofficial-vimeo-es",
      },
      {
        name: "Official Vimeo in English",
        site: "Vimeo",
        type: "Trailer",
        official: true,
        iso_639_1: "en",
        key: "official-vimeo-en",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer?.key).toBe("official-vimeo-en");
  });

  it("prefers Spanish over English within the same trailer tier", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "English trailer",
        site: "YouTube",
        type: "Trailer",
        official: false,
        iso_639_1: "en",
        key: "youtube-en",
      },
      {
        name: "Tráiler en español",
        site: "YouTube",
        type: "Trailer",
        official: false,
        iso_639_1: "es",
        key: "youtube-es",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer?.key).toBe("youtube-es");
  });

  it("prefers English over other or missing languages in the same tier", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "Bande-annonce française",
        site: "Vimeo",
        type: "Trailer",
        official: false,
        iso_639_1: "fr",
        key: "vimeo-fr",
      },
      {
        name: "Trailer without language",
        site: "Vimeo",
        type: "Trailer",
        official: false,
        iso_639_1: null,
        key: "vimeo-no-language",
      },
      {
        name: "English trailer",
        site: "Vimeo",
        type: "Trailer",
        official: false,
        iso_639_1: "en",
        key: "vimeo-en",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer?.key).toBe("vimeo-en");
  });

  it("uses original provider order as the final trailer tie-break", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "Primer tráiler",
        site: "YouTube",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "first",
      },
      {
        name: "Segundo tráiler",
        site: "YouTube",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "second",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer?.key).toBe("first");
  });

  it("returns null when no exact compatible Trailer exists", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.videos.results = [
      {
        name: "YouTube teaser",
        site: "YouTube",
        type: "Teaser",
        official: true,
        iso_639_1: "es",
        key: "teaser",
      },
      {
        name: "Lowercase site",
        site: "youtube",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "lowercase-site",
      },
      {
        name: "Unsupported site",
        site: "Dailymotion",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "unsupported-site",
      },
      {
        name: "Lowercase type",
        site: "Vimeo",
        type: "trailer",
        official: true,
        iso_639_1: "es",
        key: "lowercase-type",
      },
    ];
    client.getMovieDetail.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getMovieDetail(8101);

    expect(result.trailer).toBeNull();
  });

  it("converts public detail validation failures to a sanitized error", async () => {
    const client = createClientDouble();
    const raw = cloneMovieDetail();
    raw.title = "PRIVATE_DETAIL_TITLE";
    raw.original_language = "x";
    client.getMovieDetail.mockResolvedValue(raw);

    await expectSanitizedInvalidResponse(
      new TmdbAdapter(client.client).getMovieDetail(8101),
      "PRIVATE_DETAIL_TITLE",
    );
  });

  it("preserves client errors unchanged", async () => {
    const client = createClientDouble();
    const clientError = new TmdbError("UNAVAILABLE", 503);
    client.getMovieDetail.mockRejectedValue(clientError);

    await expect(
      new TmdbAdapter(client.client).getMovieDetail(8101),
    ).rejects.toBe(clientError);
  });
});

describe("TmdbAdapter.discoverMovies", () => {
  it("derives a public options type with a required page and no similar movie filter", () => {
    type PageField = Pick<TmdbDiscoverOptions, "page">;
    type PageIsRequired = PageField extends Required<PageField> ? true : false;
    type HasSimilarMovieId =
      "similarToMovieId" extends keyof TmdbDiscoverOptions ? true : false;

    expectTypeOf<PageIsRequired>().toEqualTypeOf<true>();
    expectTypeOf<HasSimilarMovieId>().toEqualTypeOf<false>();
  });

  it("maps every filter exactly while preserving array order, duplicates and zeroes", async () => {
    const client = createClientDouble();
    client.discoverMovies.mockResolvedValue(cloneMovieList());

    await new TmdbAdapter(client.client).discoverMovies({
      genreIds: [7101, 7102, 7101],
      excludedGenreIds: [7103, 7103],
      keywordIds: [8003, 8001, 8003],
      castIds: [9102, 9101, 9102],
      crewIds: [9202, 9201, 9202],
      originalLanguage: "es",
      minRuntime: 80,
      maxRuntime: 180,
      minTmdbRating: 0,
      minTmdbVoteCount: 0,
      page: 3,
    });

    expect(client.discoverMovies).toHaveBeenCalledWith({
      page: 3,
      withGenres: "7101,7102,7101",
      withoutGenres: "7103,7103",
      withKeywords: "8003,8001,8003",
      withCast: "9102,9101,9102",
      withCrew: "9202,9201,9202",
      withOriginalLanguage: "es",
      minRuntime: 80,
      maxRuntime: 180,
      minVoteAverage: 0,
      minVoteCount: 0,
    });
  });

  it("maps empty filter arrays to undefined and defensively defaults a missing page", async () => {
    const client = createClientDouble();
    client.discoverMovies.mockResolvedValue(cloneMovieList());
    const runtimeInput = {
      genreIds: [],
      excludedGenreIds: [],
      keywordIds: [],
      castIds: [],
      crewIds: [],
    } as unknown as TmdbDiscoverOptions;

    await new TmdbAdapter(client.client).discoverMovies(runtimeInput);

    expect(client.discoverMovies).toHaveBeenCalledWith({
      page: 1,
      withGenres: undefined,
      withoutGenres: undefined,
      withKeywords: undefined,
      withCast: undefined,
      withCrew: undefined,
      withOriginalLanguage: undefined,
      minRuntime: undefined,
      maxRuntime: undefined,
      minVoteAverage: undefined,
      minVoteCount: undefined,
    });
  });

  it.each([
    ["similar movie filters", { similarToMovieId: 8101, page: 1 }],
    ["unknown provider keys", { withGenres: "7101", page: 1 }],
    ["invalid genre IDs", { genreIds: [0], page: 1 }],
    ["invalid keyword IDs", { keywordIds: [-1], page: 1 }],
    ["invalid cast IDs", { castIds: [1.5], page: 1 }],
    ["invalid crew IDs", { crewIds: [0], page: 1 }],
    ["ratings above ten", { minTmdbRating: 10.1, page: 1 }],
    [
      "an inverted runtime range",
      { minRuntime: 121, maxRuntime: 120, page: 1 },
    ],
    ["an invalid page", { page: 0 }],
  ])("rejects %s before calling the client", async (_label, input) => {
    const client = createClientDouble();

    await expectInputZodError(
      new TmdbAdapter(client.client).discoverMovies(
        input as TmdbDiscoverOptions,
      ),
    );

    expect(client.discoverMovies).not.toHaveBeenCalled();
  });

  it("reuses summary and pagination mapping without adding ranking fields", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.page = 4;
    raw.results[0]!.release_date = "";
    client.discoverMovies.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).discoverMovies({
      page: 4,
    });

    expect(result.meta).toEqual({
      page: 4,
      pageSize: 20,
      totalPages: 4,
      totalResults: 62,
      hasNextPage: false,
    });
    expect(result.data[0]).toEqual({
      id: 8101,
      title: "La ciudad de vidrio",
      originalTitle: "The Glass City",
      overview: "Una archivista descubre un mapa imposible bajo la ciudad.",
      posterPath: "/glass-city-poster.jpg",
      backdropPath: "/glass-city-backdrop.jpg",
      genreIds: [7101, 7102],
      releaseDate: null,
      originalLanguage: "es",
      tmdbRating: 7.4,
      tmdbVoteCount: 1842,
    });
    expect(result.data[0]).not.toHaveProperty("score");
    expect(result.data[0]).not.toHaveProperty("ranking");
  });

  it("sanitizes a raw-valid response that violates the public movie contract", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.results[0]!.title = "PRIVATE_DISCOVER_TITLE";
    raw.results[0]!.vote_average = 11;
    client.discoverMovies.mockResolvedValue(raw);

    await expectSanitizedInvalidResponse(
      new TmdbAdapter(client.client).discoverMovies({ page: 1 }),
      "PRIVATE_DISCOVER_TITLE",
    );
  });

  it("preserves client errors unchanged", async () => {
    const client = createClientDouble();
    const clientError = new TmdbError("RATE_LIMITED", 429);
    client.discoverMovies.mockRejectedValue(clientError);

    await expect(
      new TmdbAdapter(client.client).discoverMovies({ page: 1 }),
    ).rejects.toBe(clientError);
  });
});

describe("TmdbAdapter.getSimilarMovies", () => {
  it("defaults page to one and reuses the public list mapping", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.page = 1;
    raw.total_pages = 1;
    client.getSimilarMovies.mockResolvedValue(raw);

    const result = await new TmdbAdapter(client.client).getSimilarMovies({
      movieId: 8101,
    });

    expect(client.getSimilarMovies).toHaveBeenCalledWith({
      movieId: 8101,
      page: 1,
    });
    expect(result.data[1]?.releaseDate).toBeNull();
    expect(result.meta).toEqual({
      page: 1,
      pageSize: 20,
      totalPages: 1,
      totalResults: 62,
      hasNextPage: false,
    });
  });

  it("passes an explicit page through to the client", async () => {
    const client = createClientDouble();
    client.getSimilarMovies.mockResolvedValue(cloneMovieList());

    await new TmdbAdapter(client.client).getSimilarMovies({
      movieId: 8102,
      page: 2,
    });

    expect(client.getSimilarMovies).toHaveBeenCalledWith({
      movieId: 8102,
      page: 2,
    });
  });

  it.each([
    ["a zero movie ID", { movieId: 0 }],
    ["a string movie ID", { movieId: "8101" }],
    ["a non-positive page", { movieId: 8101, page: 0 }],
    ["an unknown key", { movieId: 8101, page: 1, language: "en" }],
  ])("rejects %s before calling the client", async (_label, input) => {
    const client = createClientDouble();

    await expectInputZodError(
      new TmdbAdapter(client.client).getSimilarMovies(
        input as Parameters<TmdbAdapter["getSimilarMovies"]>[0],
      ),
    );

    expect(client.getSimilarMovies).not.toHaveBeenCalled();
  });

  it("sanitizes a raw-valid response that violates the public movie contract", async () => {
    const client = createClientDouble();
    const raw = cloneMovieList();
    raw.results[0]!.original_language = "x";
    client.getSimilarMovies.mockResolvedValue(raw);

    await expectSanitizedInvalidResponse(
      new TmdbAdapter(client.client).getSimilarMovies({ movieId: 8101 }),
      "original_language",
    );
  });

  it("preserves client errors unchanged", async () => {
    const client = createClientDouble();
    const clientError = new TmdbError("UNAVAILABLE", 503);
    client.getSimilarMovies.mockRejectedValue(clientError);

    await expect(
      new TmdbAdapter(client.client).getSimilarMovies({ movieId: 8101 }),
    ).rejects.toBe(clientError);
  });
});
