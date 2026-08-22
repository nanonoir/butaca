import { describe, expect, it, vi } from "vitest";

import type { MovieSummary } from "@/contracts";

import { CHAT_RECOMMENDATION_LIMIT, createChatTools } from "./chat-tools";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function createMovie(id: number, title: string): MovieSummary {
  return {
    id,
    title,
    originalTitle: title,
    overview: "Sinopsis",
    posterPath: "/poster.jpg",
    backdropPath: null,
    genreIds: [878],
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating: 8,
    tmdbVoteCount: 2_000,
  };
}

function createCatalog(
  overrides: {
    personId?: number | null;
    movies?: MovieSummary[];
  } = {},
) {
  return {
    findPersonId: vi.fn().mockResolvedValue(overrides.personId ?? null),
    searchMovies: vi.fn().mockResolvedValue({ data: overrides.movies ?? [] }),
  };
}

function createRecommendations(movies: MovieSummary[] = []) {
  return {
    getDiscoverBatch: vi.fn().mockResolvedValue({
      movies: movies.map((movie) => ({
        movie,
        insight: { tier: "high", matchedGenres: [], clashingGenres: [] },
      })),
      batchSize: 10,
      returned: movies.length,
    }),
  };
}

function execute(
  tools: ReturnType<typeof createChatTools>,
  input: Record<string, unknown> = {},
) {
  const run = tools.recommendMovies.execute;

  if (!run) {
    throw new Error("The recommendation tool has no execute");
  }

  return run(
    input as never,
    {
      toolCallId: "call-1",
      messages: [],
    } as never,
  );
}

describe("recommendMovies tool", () => {
  it("asks the recommender for the viewer bound at construction", async () => {
    const recommendations = createRecommendations([createMovie(1, "Dune")]);
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    await execute(tools);

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ limit: CHAT_RECOMMENDATION_LIMIT }),
    );
  });

  it("cannot be steered to another viewer through its input", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    await execute(tools, { userId: OTHER_USER_ID });

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });

  it("passes the genre the model chose as a filter", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    await execute(tools, { genreIds: [878] });

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ filters: { genreIds: [878] } }),
    );
  });

  it("sends no filters when the model named none", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    await execute(tools);

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ filters: {} }),
    );
  });

  it("returns the full summaries so the screen can render them", async () => {
    const movies = [createMovie(157_336, "Interstellar")];
    const recommendations = createRecommendations(movies);
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    const result = (await execute(tools)) as { movies: unknown[] };

    // The screen reads this same payload from the stream, so it needs the
    // poster and the rest of the summary, not a trimmed copy.
    expect(result.movies).toEqual(movies);
  });

  it("never exposes viewer data to the model", async () => {
    const recommendations = createRecommendations([createMovie(1, "Dune")]);
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    const result = await execute(tools);

    expect(JSON.stringify(result)).not.toContain(USER_ID);
  });
});

describe("recommendMovies scope", () => {
  /** A model cannot know that Leonardo DiCaprio is 6193, and making it look
   * that up first would cost an extra step -- and an extra request against a
   * daily budget the assistant already rations -- on every conversation. */
  it("turns an actor's name into the id TMDB filters on", async () => {
    const recommendations = createRecommendations([createMovie(1, "Titanic")]);
    const catalog = createCatalog({ personId: 6193 });
    const tools = createChatTools(recommendations, catalog, USER_ID);

    await execute(tools, { actorName: "Leonardo DiCaprio" });

    expect(catalog.findPersonId).toHaveBeenCalledWith({
      name: "Leonardo DiCaprio",
      department: "Acting",
    });
    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        filters: expect.objectContaining({ castIds: [6193] }),
      }),
    );
  });

  /** Same endpoint, different question: the department is what separates an
   * actor from a director who share a name. */
  it("asks for a director in the directing department and files it as crew", async () => {
    const recommendations = createRecommendations();
    const catalog = createCatalog({ personId: 488 });
    const tools = createChatTools(recommendations, catalog, USER_ID);

    await execute(tools, { directorName: "Steven Spielberg" });

    expect(catalog.findPersonId).toHaveBeenCalledWith({
      name: "Steven Spielberg",
      department: "Directing",
    });
    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        filters: expect.objectContaining({ crewIds: [488] }),
      }),
    );
  });

  it("resolves a title to the movie the batch should resemble", async () => {
    const recommendations = createRecommendations();
    const catalog = createCatalog({
      movies: [createMovie(157336, "Interstellar")],
    });
    const tools = createChatTools(recommendations, catalog, USER_ID);

    await execute(tools, { similarToTitle: "Interstellar" });

    expect(catalog.searchMovies).toHaveBeenCalledWith({
      query: "Interstellar",
      page: 1,
    });
    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        filters: expect.objectContaining({ similarToMovieId: 157336 }),
      }),
    );
  });

  /** A rating floor on its own hands back whatever obscure title three people
   * rated a ten. */
  it("pairs a request for acclaim with a floor on how many people voted", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, createCatalog(), USER_ID);

    await execute(tools, { wellReviewed: true });

    const [, options] = recommendations.getDiscoverBatch.mock.calls[0]!;

    expect(options.filters.minTmdbRating).toBeGreaterThanOrEqual(7);
    expect(options.filters.minTmdbVoteCount).toBeGreaterThanOrEqual(500);
  });

  it("carries several constraints in one call", async () => {
    const recommendations = createRecommendations();
    const catalog = createCatalog({
      personId: 6193,
      movies: [createMovie(157336, "Interstellar")],
    });
    const tools = createChatTools(recommendations, catalog, USER_ID);

    await execute(tools, {
      actorName: "Leonardo DiCaprio",
      similarToTitle: "Interstellar",
      wellReviewed: true,
    });

    const [, options] = recommendations.getDiscoverBatch.mock.calls[0]!;

    expect(options.filters).toEqual(
      expect.objectContaining({
        castIds: [6193],
        similarToMovieId: 157336,
      }),
    );
  });

  /** A misspelled actor should still get recommendations, not an error. */
  it("drops a name that matches nobody instead of failing the call", async () => {
    const recommendations = createRecommendations([createMovie(1, "Dune")]);
    const catalog = createCatalog({ personId: null });
    const tools = createChatTools(recommendations, catalog, USER_ID);

    const result = await execute(tools, { actorName: "Leonrado Dicapro" });

    const [, options] = recommendations.getDiscoverBatch.mock.calls[0]!;

    expect(options.filters.castIds).toBeUndefined();
    expect(result).toEqual({ movies: [expect.objectContaining({ id: 1 })] });
  });

  it("does not look anyone up when the viewer named nobody", async () => {
    const catalog = createCatalog();
    const tools = createChatTools(createRecommendations(), catalog, USER_ID);

    await execute(tools, { genreIds: [878] });

    expect(catalog.findPersonId).not.toHaveBeenCalled();
    expect(catalog.searchMovies).not.toHaveBeenCalled();
  });
});
