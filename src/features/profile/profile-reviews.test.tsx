/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import type { MyReview } from "@/contracts/profile";

import { ProfileReviews } from "./profile-reviews";

afterEach(cleanup);

function createReview(index: number): MyReview {
  return {
    id: `0000000${index}-0000-4000-8000-000000000000`,
    movie: {
      id: 600 + index,
      title: `Película ${index}`,
      originalTitle: `Movie ${index}`,
      overview: "",
      posterPath: null,
      backdropPath: null,
      genreIds: [18],
      releaseDate: "2001-01-01",
      originalLanguage: "en",
      tmdbRating: 7.5,
      tmdbVoteCount: 1000,
    },
    verdict: index % 2 === 0 ? "RECOMMENDED" : "NOT_WORTH_IT",
    title: `Reseña ${index}`,
    description: `Lo que escribí sobre la película ${index}.`,
    createdAt: "2026-08-25T10:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
  };
}

describe("ProfileReviews", () => {
  /** The profile counted them and had nowhere to send anyone. */
  it("names the movie each review was written about", () => {
    render(<ProfileReviews reviews={[createReview(1)]} />);

    expect(screen.getByText("Película 1")).toBeInTheDocument();
    expect(screen.getByText("Reseña 1")).toBeInTheDocument();
    expect(screen.getByText("No la recomienda")).toBeInTheDocument();
  });

  it("shows three at a time and walks to the rest", () => {
    render(
      <ProfileReviews
        reviews={Array.from({ length: 7 }, (_, index) => createReview(index))}
      />,
    );

    expect(screen.getByText("Reseña 2")).toBeInTheDocument();
    expect(screen.queryByText("Reseña 3")).not.toBeInTheDocument();

    const pager = screen.getByRole("navigation", {
      name: "Paginación de mis reseñas",
    });
    fireEvent.click(within(pager).getByRole("button", { name: "Página 3" }));

    expect(screen.getByText("Reseña 6")).toBeInTheDocument();
    expect(screen.queryByText("Reseña 2")).not.toBeInTheDocument();
  });

  it("keeps the pager above the reviews it pages", () => {
    render(
      <ProfileReviews
        reviews={Array.from({ length: 7 }, (_, index) => createReview(index))}
      />,
    );

    const pager = screen.getByRole("navigation", {
      name: "Paginación de mis reseñas",
    });

    expect(
      pager.compareDocumentPosition(screen.getByText("Reseña 0")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("explains the empty case instead of showing an empty list", () => {
    render(<ProfileReviews reviews={[]} />);

    expect(
      screen.getByText(/Todavía no escribiste ninguna/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  /** The movie is where a review can be edited, so that is where a card goes
   * -- and it has an address now, so the card is a link to it. */
  it("points a review at the film it was written about", () => {
    render(<ProfileReviews reviews={[createReview(1)]} />);

    expect(
      screen.getByRole("link", { name: "Ver Película 1" }),
    ).toHaveAttribute("href", "/movies/601/pelicula-1");
  });
});
