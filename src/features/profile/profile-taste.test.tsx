/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import type { TasteSummary } from "@/contracts/taste";

import { ProfileTaste } from "./profile-taste";

afterEach(cleanup);

function createTaste(overrides: Partial<TasteSummary> = {}): TasteSummary {
  return {
    hasEnough: true,
    likedCount: 12,
    genres: [
      { id: 878, name: "Ciencia ficción" },
      { id: 18, name: "Drama" },
    ],
    avoidedGenres: [],
    actors: [{ id: 6193, name: "Leonardo DiCaprio" }],
    directors: [{ id: 525, name: "Christopher Nolan" }],
    ...overrides,
  };
}

describe("ProfileTaste", () => {
  it("says what the recommender is working from", () => {
    render(<ProfileTaste taste={createTaste()} />);

    expect(screen.getByText("Ciencia ficción")).toBeInTheDocument();
    expect(screen.getByText("Leonardo DiCaprio")).toBeInTheDocument();
    expect(screen.getByText("Christopher Nolan")).toBeInTheDocument();
  });

  /** Presenting arithmetic on three films as a conclusion is guessing with a
   * straight face. */
  it("admits it does not know yet instead of guessing", () => {
    render(
      <ProfileTaste taste={createTaste({ hasEnough: false, likedCount: 2 })} />,
    );

    expect(
      screen.getByText(/Todavía te estamos conociendo/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 películas marcadas/)).toBeInTheDocument();
    expect(screen.queryByText("Ciencia ficción")).not.toBeInTheDocument();
  });

  it("counts one marked film in the singular", () => {
    render(
      <ProfileTaste taste={createTaste({ hasEnough: false, likedCount: 1 })} />,
    );

    expect(screen.getByText(/una película marcada/)).toBeInTheDocument();
  });

  /** The exclusion is the part most likely to be wrong, and it cannot be
   * argued with by somebody who cannot see what it was counted from. */
  it("shows the arithmetic behind a genre it decided to avoid", () => {
    render(
      <ProfileTaste
        taste={createTaste({
          avoidedGenres: [{ id: 27, name: "Terror", disliked: 4, liked: 1 }],
        })}
      />,
    );

    expect(screen.getByText("Terror")).toBeInTheDocument();
    expect(
      screen.getByText(/4 no me gusta · 1 me gusta/),
    ).toBeInTheDocument();
  });

  it("leaves the avoided group out when nothing is being avoided", () => {
    render(<ProfileTaste taste={createTaste()} />);

    expect(
      screen.queryByText(/Lo que te estamos evitando/),
    ).not.toBeInTheDocument();
  });
});
