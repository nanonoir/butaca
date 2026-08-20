import { describe, expect, it, vi } from "vitest";

import { TmdbClient } from "../client";
import { createTmdbConfig } from "../config";
import { TmdbError, type TmdbErrorCode } from "../errors";

const TEST_TOKEN = "test-token";

const GENRES_RESPONSE = {
  genres: [
    { id: 18, name: "Drama" },
    { id: 53, name: "Suspenso" },
  ],
};

const MOVIE_SUMMARY = {
  id: 13,
  title: "Forrest Gump",
  original_title: "Forrest Gump",
  overview: "Una vida extraordinaria.",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  genre_ids: [18, 35],
  release_date: "1994-07-06",
  original_language: "en",
  vote_average: 8.5,
  vote_count: 27_000,
};

const MOVIE_LIST_RESPONSE = {
  page: 1,
  results: [MOVIE_SUMMARY],
  total_pages: 2,
  total_results: 21,
};

const MOVIE_DETAIL_RESPONSE = {
  id: 13,
  title: "Forrest Gump",
  original_title: "Forrest Gump",
  overview: "Una vida extraordinaria.",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  release_date: "1994-07-06",
  original_language: "en",
  vote_average: 8.5,
  vote_count: 27_000,
  tagline: "El mundo nunca será el mismo.",
  runtime: 142,
  genres: [{ id: 18, name: "Drama" }],
  credits: {
    cast: [
      {
        id: 31,
        name: "Tom Hanks",
        character: "Forrest Gump",
        profile_path: "/tom-hanks.jpg",
        order: 0,
      },
    ],
    crew: [
      {
        id: 24,
        name: "Robert Zemeckis",
        job: "Director",
        profile_path: "/robert-zemeckis.jpg",
      },
    ],
  },
  keywords: {
    keywords: [{ id: 9672, name: "based on novel or book" }],
  },
  videos: {
    results: [
      {
        name: "Trailer oficial",
        site: "YouTube",
        type: "Trailer",
        official: true,
        iso_639_1: "es",
        key: "trailer-key",
      },
    ],
  },
};

function createFetchDouble() {
  return vi.fn<typeof fetch>();
}

type FetchDouble = ReturnType<typeof createFetchDouble>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createClient(fetchImpl: typeof fetch) {
  return new TmdbClient(createTmdbConfig(TEST_TOKEN), fetchImpl);
}

function expectRequest(
  fetchImpl: FetchDouble,
  pathname: string,
  query: Record<string, string>,
) {
  expect(fetchImpl).toHaveBeenCalledOnce();

  const [input, init] = fetchImpl.mock.calls[0];
  const requestUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(requestUrl);
  const headers = new Headers(init?.headers);

  expect(`${url.origin}${url.pathname}`).toBe(
    `https://api.themoviedb.org/3${pathname}`,
  );
  expect(Object.fromEntries(url.searchParams)).toEqual(query);
  expect(headers.get("Authorization")).toBe(`Bearer ${TEST_TOKEN}`);
  expect(headers.get("accept")).toBe("application/json");
  expect(requestUrl).not.toContain(TEST_TOKEN);
}

async function expectTmdbError(
  operation: Promise<unknown>,
  code: TmdbErrorCode,
  status?: number,
) {
  let thrown: unknown;

  try {
    await operation;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(TmdbError);
  expect(thrown).toMatchObject({
    name: "TmdbError",
    message: `TMDB request failed: ${code}`,
    code,
    status,
  });
  expect(String(thrown)).not.toContain(TEST_TOKEN);
}

describe("TmdbClient requests", () => {
  it("requests movie genres with language and no region", async () => {
    vi.useFakeTimers();

    try {
      const fetchImpl = createFetchDouble();
      fetchImpl.mockResolvedValue(jsonResponse(GENRES_RESPONSE));

      await expect(createClient(fetchImpl).getGenres()).resolves.toEqual(
        GENRES_RESPONSE,
      );

      expectRequest(fetchImpl, "/genre/movie/list", {
        language: "es-AR",
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("searches movies with regional and adult-content parameters", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(jsonResponse(MOVIE_LIST_RESPONSE));

    await expect(
      createClient(fetchImpl).searchMovies({
        query: "Forrest Gump",
        page: 1,
      }),
    ).resolves.toEqual(MOVIE_LIST_RESPONSE);

    expectRequest(fetchImpl, "/search/movie", {
      language: "es-AR",
      region: "AR",
      include_adult: "false",
      query: "Forrest Gump",
      page: "1",
    });
  });

  it("requests movie detail with appended resources and no region", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(jsonResponse(MOVIE_DETAIL_RESPONSE));

    await expect(createClient(fetchImpl).getMovieDetail(13)).resolves.toEqual(
      MOVIE_DETAIL_RESPONSE,
    );

    expectRequest(fetchImpl, "/movie/13", {
      language: "es-AR",
      append_to_response: "credits,keywords,videos",
    });
  });

  it("translates discover filters to TMDB query parameters", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(jsonResponse(MOVIE_LIST_RESPONSE));

    await expect(
      createClient(fetchImpl).discoverMovies({
        page: 3,
        withGenres: "18,53",
        withoutGenres: "27",
        withKeywords: "9672,818",
        withCast: "31,500",
        withCrew: "24",
        withOriginalLanguage: "es",
        minRuntime: 80,
        maxRuntime: 180,
        minVoteAverage: 7.5,
        minVoteCount: 0,
      }),
    ).resolves.toEqual(MOVIE_LIST_RESPONSE);

    expectRequest(fetchImpl, "/discover/movie", {
      language: "es-AR",
      region: "AR",
      include_adult: "false",
      page: "3",
      with_genres: "18,53",
      without_genres: "27",
      with_keywords: "9672,818",
      with_cast: "31,500",
      with_crew: "24",
      with_original_language: "es",
      "with_runtime.gte": "80",
      "with_runtime.lte": "180",
      "vote_average.gte": "7.5",
      "vote_count.gte": "0",
    });
  });

  it("requests similar movies with language, page and no region", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(jsonResponse(MOVIE_LIST_RESPONSE));

    await expect(
      createClient(fetchImpl).getSimilarMovies({ movieId: 13, page: 2 }),
    ).resolves.toEqual(MOVIE_LIST_RESPONSE);

    expectRequest(fetchImpl, "/movie/13/similar", {
      language: "es-AR",
      page: "2",
    });
  });
});

describe("TmdbClient errors", () => {
  it.each([
    { status: 401, code: "UNAUTHORIZED" as const },
    { status: 404, code: "NOT_FOUND" as const },
    { status: 429, code: "RATE_LIMITED" as const },
  ])("maps HTTP $status to $code", async ({ status, code }) => {
    vi.useFakeTimers();

    try {
      const fetchImpl = createFetchDouble();
      fetchImpl.mockResolvedValue(
        jsonResponse({ status_message: TEST_TOKEN }, status),
      );

      await expectTmdbError(createClient(fetchImpl).getGenres(), code, status);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([500, 599])("maps HTTP %i to UNAVAILABLE", async (status) => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(
      jsonResponse({ status_message: TEST_TOKEN }, status),
    );

    await expectTmdbError(
      createClient(fetchImpl).getGenres(),
      "UNAVAILABLE",
      status,
    );
  });

  it("maps a network failure to UNAVAILABLE", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockRejectedValue(new TypeError(`${TEST_TOKEN} network failure`));

    await expectTmdbError(createClient(fetchImpl).getGenres(), "UNAVAILABLE");
  });

  it("maps an AbortError not caused by its timer to UNAVAILABLE", async () => {
    vi.useFakeTimers();

    try {
      const fetchImpl = createFetchDouble();
      fetchImpl.mockRejectedValue(
        new DOMException("Request aborted externally", "AbortError"),
      );

      await expectTmdbError(createClient(fetchImpl).getGenres(), "UNAVAILABLE");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves an existing TmdbError thrown by fetch", async () => {
    const fetchImpl = createFetchDouble();
    const providerError = new TmdbError("UNAVAILABLE", 503);
    fetchImpl.mockRejectedValue(providerError);

    let thrown: unknown;

    try {
      await createClient(fetchImpl).getGenres();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(providerError);
  });

  it("maps an AbortError caused by the request timeout to TIMEOUT", async () => {
    vi.useFakeTimers();

    try {
      const fetchImpl = createFetchDouble();
      fetchImpl.mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Request aborted", "AbortError")),
              { once: true },
            );
          }),
      );
      const operation = expectTmdbError(
        createClient(fetchImpl).getGenres(),
        "TIMEOUT",
      );

      await vi.advanceTimersByTimeAsync(10_000);
      await operation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps a timeout while reading JSON to TIMEOUT", async () => {
    vi.useFakeTimers();

    try {
      const fetchImpl = createFetchDouble();
      fetchImpl.mockImplementation(
        async (_input, init) =>
          ({
            ok: true,
            status: 200,
            json: () =>
              new Promise((_resolve, reject) => {
                init?.signal?.addEventListener(
                  "abort",
                  () =>
                    reject(new DOMException("Request aborted", "AbortError")),
                  { once: true },
                );
              }),
          }) as Response,
      );
      const operation = expectTmdbError(
        createClient(fetchImpl).getGenres(),
        "TIMEOUT",
      );

      await vi.advanceTimersByTimeAsync(10_000);
      await operation;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps a transport failure while reading JSON to UNAVAILABLE", async () => {
    const fetchImpl = createFetchDouble();
    const response = jsonResponse(GENRES_RESPONSE);
    vi.spyOn(response, "json").mockRejectedValue(
      new TypeError(`${TEST_TOKEN} stream failure`),
    );
    fetchImpl.mockResolvedValue(response);

    await expectTmdbError(createClient(fetchImpl).getGenres(), "UNAVAILABLE");
  });

  it("maps invalid JSON to INVALID_RESPONSE", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(
      new Response(`{"private":"${TEST_TOKEN}"`, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expectTmdbError(
      createClient(fetchImpl).getGenres(),
      "INVALID_RESPONSE",
    );
  });

  it("maps an invalid provider shape to INVALID_RESPONSE", async () => {
    const fetchImpl = createFetchDouble();
    fetchImpl.mockResolvedValue(
      jsonResponse({ genres: [{ id: 0, name: TEST_TOKEN }] }),
    );

    await expectTmdbError(
      createClient(fetchImpl).getGenres(),
      "INVALID_RESPONSE",
    );
  });
});
