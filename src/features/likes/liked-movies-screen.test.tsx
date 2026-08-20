/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import type { LikedMovieItem } from "@/contracts/likes";

import { LikedMoviesScreen } from "./liked-movies-screen";

afterEach(cleanup);

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

const ITEMS = [
  createLikedMovie(1, "Interstellar", "2026-08-02T12:00:00Z"),
  createLikedMovie(2, "Parásitos", null),
  createLikedMovie(3, "Her", null),
];

describe("LikedMoviesScreen", () => {
  it("renders the complete collection with its watched presentation", () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Mis películas" }),
    ).toBeTruthy();
    expect(screen.getByText("3 películas")).toBeTruthy();
    expect(screen.getByText("Interstellar")).toBeTruthy();
    expect(screen.getByText("Parásitos")).toBeTruthy();
    expect(screen.getByText("Her")).toBeTruthy();
    expect(screen.getByText("Vista", { exact: true })).toBeTruthy();
    expect(screen.getByRole("list").classList).toContain("xl:grid-cols-5");
    expect(screen.getByRole("list").classList).toContain("2xl:grid-cols-6");
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows only watched movies and updates the singular count", () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    fireEvent.click(screen.getByRole("button", { name: "Vistas" }));

    expect(screen.getByText("1 película")).toBeTruthy();
    expect(screen.getByText("Interstellar")).toBeTruthy();
    expect(screen.queryByText("Parásitos")).toBeNull();
    expect(screen.queryByText("Her")).toBeNull();
    expect(screen.getByRole("button", { name: "Vistas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows only unwatched movies and updates the plural count", () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    fireEvent.click(screen.getByRole("button", { name: "No vistas" }));

    expect(screen.getByText("2 películas")).toBeTruthy();
    expect(screen.queryByText("Interstellar")).toBeNull();
    expect(screen.getByText("Parásitos")).toBeTruthy();
    expect(screen.getByText("Her")).toBeTruthy();
    expect(screen.getByRole("button", { name: "No vistas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
