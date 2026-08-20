/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MoviePosterCard } from "./movie-poster-card";

afterEach(cleanup);

describe("MoviePosterCard", () => {
  it("keeps the poster and presentation slot inside a presentational article", () => {
    render(
      <MoviePosterCard
        title="A sample film"
        year="2024"
        poster={<div data-testid="poster">Poster content</div>}
        presentationSlot={<button type="button">Preview</button>}
        metadataSlot={<span data-testid="metadata-slot">More</span>}
      />,
    );

    expect(screen.getByRole("article")).toBeTruthy();
    expect(screen.getByTestId("poster")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "A sample film" }),
    ).toBeTruthy();
    expect(screen.getByText("2024")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getByTestId("metadata-slot")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "A sample film" })
        .classList,
    ).toContain("line-clamp-2");
  });

  it("does not invent optional movie metadata or behavior", () => {
    render(
      <MoviePosterCard
        title="Untitled presentation"
        poster={<div data-testid="poster">Poster content</div>}
      />,
    );

    expect(screen.queryByText("2024")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByRole("article").querySelector("[data-reaction]"),
    ).toBeNull();
  });
});
