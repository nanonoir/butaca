/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("opens the movie detail when selecting a liked movie", async () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle de Interstellar" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Detalle de Interstellar" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Tu reacción" })).getByRole(
        "button",
        { name: "Me gusta" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Marcar no vista" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Detalle de Interstellar" }),
      ).not.toBeInTheDocument();
    });
  });

  it("removes a movie from Liked after changing its reaction", async () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle de Interstellar" }),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "Tu reacción" })).getByRole(
        "button",
        { name: "No me gusta" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", {
          name: "Ver detalle de Interstellar",
        }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("2 películas")).toBeInTheDocument();
  });

  it("updates watched filters and badges after closing the detail", async () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle de Parásitos" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Marcar vista" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Detalle de Parásitos" }),
      ).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Vistas" }));

    expect(screen.getByText("2 películas")).toBeInTheDocument();
    const parasitosAction = screen.getByRole("button", {
      name: "Ver detalle de Parásitos",
    });
    expect(
      within(parasitosAction.closest("article")!).getByText("Vista"),
    ).toBeInTheDocument();
  });

  it("keeps the hover treatment inside the poster boundary", () => {
    render(<LikedMoviesScreen items={ITEMS} />);

    const action = screen.getByRole("button", {
      name: "Ver detalle de Interstellar",
    });
    const article = action.closest("article");
    const hoverLayer = article?.querySelector("[data-liked-poster-hover]");
    const posterFrame = screen
      .getByRole("img", { name: "Póster de Interstellar" })
      .closest("figure");

    expect(hoverLayer).not.toBeNull();
    expect(hoverLayer?.closest("figure")).toBe(posterFrame);
    expect(posterFrame).toHaveClass("overflow-hidden");
    expect(action.closest("li")).toHaveClass(
      "[&>article>button:hover]:bg-transparent!",
    );
  });
});
