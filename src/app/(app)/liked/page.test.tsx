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

function stubLikes(data: LikedMovieItem[], totalResults = data.length) {
  listLikedMovies.mockResolvedValue({
    data,
    meta: {
      page: 1,
      pageSize: 20,
      totalPages: Math.ceil(totalResults / 20),
      totalResults,
      hasNextPage: totalResults > 20,
    },
  });
}

function renderPage(searchParams: Record<string, string> = {}) {
  return LikedMoviesPage({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  vi.clearAllMocks();
  getOptionalViewer.mockResolvedValue(VIEWER);
});

afterEach(cleanup);

describe("LikedMoviesPage", () => {
  it("renders the viewer's stored liked movies", async () => {
    stubLikes([
      createLikedMovie(1, "Interstellar", "2026-08-02T12:00:00Z"),
      createLikedMovie(2, "Parásitos", null),
    ]);

    render(await renderPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Mis películas" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getAllByText("Vista", { exact: true })).toHaveLength(1);
  });

  it("asks for the first page of every liked movie", async () => {
    stubLikes([]);

    render(await renderPage());

    expect(listLikedMovies).toHaveBeenCalledWith(VIEWER.id, {
      page: 1,
      watched: "all",
    });
  });

  it("asks the database for the page and filter in the URL", async () => {
    stubLikes([], 70);

    render(await renderPage({ page: "3", watched: "unwatched" }));

    expect(listLikedMovies).toHaveBeenCalledWith(VIEWER.id, {
      page: 3,
      watched: "unwatched",
    });
  });

  /** A query string is user editable, and a bad one must not take the library
   * down. */
  it("falls back to the first page when the query is not usable", async () => {
    stubLikes([]);

    render(await renderPage({ page: "definitely-not-a-page" }));

    expect(listLikedMovies).toHaveBeenCalledWith(VIEWER.id, {
      page: 1,
      watched: "all",
    });
  });

  it("hands the screen the filter it actually queried", async () => {
    stubLikes([]);

    render(await renderPage({ watched: "watched" }));

    expect(screen.getByRole("button", { name: "Vistas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("redirects to the sign-in page without a session", async () => {
    getOptionalViewer.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(listLikedMovies).not.toHaveBeenCalled();
  });
});
