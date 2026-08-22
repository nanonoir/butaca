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
    const tools = createChatTools(recommendations, USER_ID);

    await execute(tools);

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ limit: CHAT_RECOMMENDATION_LIMIT }),
    );
  });

  it("cannot be steered to another viewer through its input", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, USER_ID);

    await execute(tools, { userId: OTHER_USER_ID });

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });

  it("passes the genre the model chose as a filter", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, USER_ID);

    await execute(tools, { genreIds: [878] });

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ filters: { genreIds: [878] } }),
    );
  });

  it("sends no filters when the model named none", async () => {
    const recommendations = createRecommendations();
    const tools = createChatTools(recommendations, USER_ID);

    await execute(tools);

    expect(recommendations.getDiscoverBatch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ filters: {} }),
    );
  });

  it("returns the full summaries so the screen can render them", async () => {
    const movies = [createMovie(157_336, "Interstellar")];
    const recommendations = createRecommendations(movies);
    const tools = createChatTools(recommendations, USER_ID);

    const result = (await execute(tools)) as { movies: unknown[] };

    // The screen reads this same payload from the stream, so it needs the
    // poster and the rest of the summary, not a trimmed copy.
    expect(result.movies).toEqual(movies);
  });

  it("never exposes viewer data to the model", async () => {
    const recommendations = createRecommendations([createMovie(1, "Dune")]);
    const tools = createChatTools(recommendations, USER_ID);

    const result = await execute(tools);

    expect(JSON.stringify(result)).not.toContain(USER_ID);
  });
});
