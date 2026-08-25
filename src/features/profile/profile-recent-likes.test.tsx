/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

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

  /** The detail has an address now, so a poster is a link: it opens in a new
   * tab, and the middle mouse button works without anybody thinking about it. */
  it("points each poster at the film's own address", () => {
    render(<ProfileRecentLikes items={[createItem(0)]} />);

    expect(
      screen.getByRole("link", { name: "Ver Película 0" }),
    ).toHaveAttribute("href", "/movies/700/pelicula-0");
  });
});
