/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MovieSummary } from "@/contracts/movies";

import DiscoverPage from "./page";

const { getOptionalViewer, getDiscoverBatch, redirect } = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
  getDiscoverBatch: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/api/route", () => ({ getOptionalViewer }));

vi.mock("@/features/recommendations/recommendation-factory", () => ({
  getRecommendationService: () => ({ getDiscoverBatch }),
}));

vi.mock("@/features/interactions/interaction-client", () => ({
  setMovieReaction: vi.fn().mockResolvedValue(undefined),
  removeMovieReaction: vi.fn().mockResolvedValue(undefined),
  setMovieWatched: vi.fn().mockResolvedValue(undefined),
}));

const VIEWER = { id: "11111111-1111-4111-8111-111111111111" };

function createMovie(id: number, title: string): MovieSummary {
  return {
    id,
    title,
    originalTitle: title,
    overview: `${title} overview`,
    posterPath: null,
    backdropPath: null,
    genreIds: [878],
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating: 8,
    tmdbVoteCount: 2_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getOptionalViewer.mockResolvedValue(VIEWER);
});

afterEach(cleanup);

describe("DiscoverPage", () => {
  it("renders the recommended batch for the viewer", async () => {
    getDiscoverBatch.mockResolvedValue({
      movies: [createMovie(1, "Interstellar"), createMovie(2, "Dune")],
      batchSize: 20,
      returned: 2,
    });

    render(await DiscoverPage());

    expect(screen.getAllByText("Interstellar").length).toBeGreaterThan(0);
    expect(getDiscoverBatch).toHaveBeenCalledWith(VIEWER.id);
  });

  it("asks the recommender rather than reading a fixture", async () => {
    getDiscoverBatch.mockResolvedValue({
      movies: [],
      batchSize: 20,
      returned: 0,
    });

    render(await DiscoverPage());

    expect(getDiscoverBatch).toHaveBeenCalledOnce();
  });

  it("redirects to the sign-in page without a session", async () => {
    getOptionalViewer.mockResolvedValue(null);

    await expect(DiscoverPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getDiscoverBatch).not.toHaveBeenCalled();
  });
});
