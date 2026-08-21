/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LikedMovieItem } from "@/contracts/likes";

import LikedMoviesPage from "./page";

const { getOptionalViewer, listLikedMovies, redirect } = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
  listLikedMovies: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/api/route", () => ({ getOptionalViewer }));

vi.mock("@/features/likes/likes-factory", () => ({
  getLikesService: () => ({ listLikedMovies }),
}));

vi.mock("@/features/movie-detail/movie-detail-client", () => ({
  fetchMovieDetail: vi.fn(),
}));

vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews: vi.fn(),
  upsertMovieReview: vi.fn(),
  deleteMovieReview: vi.fn(),
}));

vi.mock("@/features/interactions/interaction-client", () => ({
  setMovieReaction: vi.fn(),
  removeMovieReaction: vi.fn(),
  setMovieWatched: vi.fn(),
}));

const VIEWER = { id: "11111111-1111-4111-8111-111111111111" };

function createLikedMovie(
  id: number,
  title: string,
  watchedAt: string | null,
): LikedMovieItem {
  return {
    movie: {
      id,
      title,
      originalTitle: title,
      overview: `${title} overview`,
      posterPath: null,
      backdropPath: null,
      genreIds: [18],
      releaseDate: "2024-01-01",
      originalLanguage: "es",
      tmdbRating: 8,
      tmdbVoteCount: 100,
    },
    likedAt: "2026-08-01T12:00:00Z",
    watchedAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getOptionalViewer.mockResolvedValue(VIEWER);
});

afterEach(cleanup);

describe("LikedMoviesPage", () => {
  it("renders the viewer's stored liked movies", async () => {
    listLikedMovies.mockResolvedValue({
      data: [
        createLikedMovie(1, "Interstellar", "2026-08-02T12:00:00Z"),
        createLikedMovie(2, "Parásitos", null),
      ],
    });

    render(await LikedMoviesPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Mis películas" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getAllByText("Vista", { exact: true })).toHaveLength(1);
  });

  it("asks for the first page of every liked movie", async () => {
    listLikedMovies.mockResolvedValue({ data: [] });

    render(await LikedMoviesPage());

    expect(listLikedMovies).toHaveBeenCalledWith(VIEWER.id, {
      page: 1,
      watched: "all",
    });
  });

  it("redirects to the sign-in page without a session", async () => {
    getOptionalViewer.mockResolvedValue(null);

    await expect(LikedMoviesPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(listLikedMovies).not.toHaveBeenCalled();
  });
});
