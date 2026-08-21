/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import MovieAssistantPage from "./page";

afterEach(cleanup);

describe("MovieAssistantPage", () => {
  it("connects the validated recommendations to the assistant route", () => {
    render(<MovieAssistantPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Asistente de películas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Algo parecido a Dune" }),
    ).toBeInTheDocument();
  });
});
