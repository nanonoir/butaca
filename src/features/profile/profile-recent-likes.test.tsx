/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  fetchMovieDetail: vi.fn(),
  fetchMovieReviews: vi.fn(),
}));

vi.mock("@/features/movie-detail/movie-detail-client", () => ({
  fetchMovieDetail: clientMocks.fetchMovieDetail,
}));
vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews: clientMocks.fetchMovieReviews,
}));

import type { LikedMovieItem } from "@/contracts/likes";

import { ProfileRecentLikes } from "./profile-recent-likes";

afterEach(cleanup);

function createItem(index: number): LikedMovieItem {
  return {
    movie: {
      id: 700 + index,
      title: `Película ${index}`,
      originalTitle: `Movie ${index}`,
      overview: "",
      posterPath: `/poster-${index}.jpg`,
      backdropPath: null,
      genreIds: [18],
      releaseDate: "2001-01-01",
      originalLanguage: "en",
      tmdbRating: 7.5,
      tmdbVoteCount: 1000,
    },
    likedAt: "2026-08-25T10:00:00.000Z",
    watchedAt: null,
  };
}

describe("ProfileRecentLikes", () => {
  it("shows every movie it is given, with a way into the library", () => {
    render(
      <ProfileRecentLikes
        items={Array.from({ length: 6 }, (_, index) => createItem(index))}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Película 5")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver toda la biblioteca" }),
    ).toHaveAttribute("href", "/liked");
  });

  it("explains the empty case instead of leaving a gap", () => {
    render(<ProfileRecentLikes items={[]} />);

    expect(
      screen.getByText(/Todavía no marcaste ninguna con me gusta/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens the movie behind a poster", async () => {
    clientMocks.fetchMovieDetail.mockResolvedValue({
      movie: {
        id: 700,
        title: "Película 0",
        originalTitle: "Movie 0",
        overview: "",
        posterPath: null,
        backdropPath: null,
        genres: [{ id: 18, name: "Drama" }],
        releaseDate: "2001-01-01",
        originalLanguage: "en",
        runtime: 100,
        tmdbRating: 7.5,
        tmdbVoteCount: 1000,
        director: null,
        cast: [],
        keywords: [],
        trailer: null,
      },
      viewerState: { reaction: null, watchedAt: null },
      myReview: null,
      reviewSummary: {
        recommended: 0,
        notWorthIt: 0,
        total: 0,
        recommendationRate: null,
      },
    });
    clientMocks.fetchMovieReviews.mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 0,
        totalResults: 0,
        hasNextPage: false,
      },
    });
    render(<ProfileRecentLikes items={[createItem(0)]} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver Película 0" }));

    expect(
      await screen.findByRole("dialog", { name: "Detalle de Película 0" }),
    ).toBeInTheDocument();
  });
});
