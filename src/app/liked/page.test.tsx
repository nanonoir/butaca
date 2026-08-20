/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import LikedMoviesPage from "./page";

afterEach(cleanup);

describe("LikedMoviesPage", () => {
  it("connects the ten validated local movies to the liked screen", () => {
    render(<LikedMoviesPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Mis películas" }),
    ).toBeTruthy();
    expect(screen.getByText("10 películas")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getAllByText("Vista", { exact: true })).toHaveLength(5);
  });
});
