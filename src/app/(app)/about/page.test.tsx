/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import AboutPage from "./page";

afterEach(cleanup);

describe("AboutPage", () => {
  it("presents Butaca and credits TMDB with the official asset", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Acerca de Butaca" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Encontrá tu próxima película sin perderte/i),
    ).toBeInTheDocument();

    const pillars = screen.getByRole("list", {
      name: "Cómo te acompaña Butaca",
    });
    for (const title of [
      "Descubrí",
      "Guardá tu historia",
      "Preguntale a Buti",
    ]) {
      expect(
        within(pillars).getByRole("heading", { level: 3, name: title }),
      ).toBeInTheDocument();
    }

    const logo = screen.getByRole("img", {
      name: "The Movie Database (TMDB)",
    });
    expect(logo.getAttribute("src")).toContain("tmdb-logo.svg");
    expect(
      screen.getByText(
        "This product uses the TMDB API but is not endorsed or certified by TMDB.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Movie information and images provided by TMDB."),
    ).toBeInTheDocument();
  });
});
