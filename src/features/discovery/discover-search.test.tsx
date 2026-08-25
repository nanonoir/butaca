/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  fetchSearchMovies: vi.fn(),
  fetchSimilarMovies: vi.fn(),
  fetchMovieDetail: vi.fn(),
  fetchMovieReviews: vi.fn(),
}));

vi.mock("@/features/movies/movie-catalog-client", () => ({
  fetchSearchMovies: clientMocks.fetchSearchMovies,
  fetchSimilarMovies: clientMocks.fetchSimilarMovies,
}));
vi.mock("@/features/movie-detail/movie-detail-client", () => ({
  fetchMovieDetail: clientMocks.fetchMovieDetail,
}));
vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews: clientMocks.fetchMovieReviews,
}));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();

  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
  };
});

import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";

import { DiscoverScreen } from "./discover-screen";

const MOVIES = DISCOVER_MOVIES_FIXTURE.data.movies.slice(0, 2);

function createResults(page = 1) {
  return {
    data: [MOVIES[0].movie],
    meta: {
      page,
      pageSize: 20 as const,
      totalPages: 2,
      totalResults: 21,
      hasNextPage: page < 2,
    },
  };
}

function createEmptyResults() {
  return {
    data: [],
    meta: {
      page: 1,
      pageSize: 20 as const,
      totalPages: 0,
      totalResults: 0,
      hasNextPage: false,
    },
  };
}

function openSearch() {
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir buscador de películas" }),
  );

  return screen.getByRole("textbox", { name: "Buscar películas" });
}

afterEach(cleanup);

beforeEach(() => {
  clientMocks.fetchSearchMovies.mockReset();
  clientMocks.fetchSimilarMovies.mockReset();
  clientMocks.fetchMovieDetail.mockReset();
  clientMocks.fetchMovieReviews.mockReset();
  clientMocks.fetchSimilarMovies.mockResolvedValue({
    data: [],
    meta: {
      page: 1,
      pageSize: 20,
      totalPages: 0,
      totalResults: 0,
      hasNextPage: false,
    },
  });
});

describe("DiscoverScreen search", () => {
  it("starts compact and expands the search without replacing the swipe", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const trigger = screen.getByRole("button", {
      name: "Abrir buscador de películas",
    });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.getByTestId("movie-stack-column")).toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Buscar películas" }),
    ).toHaveFocus();
    expect(screen.getByRole("search")).not.toHaveClass("absolute");
    expect(screen.queryByText("Afinado hoy")).not.toBeInTheDocument();
    expect(screen.getByTestId("movie-stack-column")).toBeInTheDocument();
  });

  it("keeps typing and blank submission local to the search form", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const input = openSearch();
    fireEvent.change(input, { target: { value: " dune " } });

    expect(clientMocks.fetchSearchMovies).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("search"));

    expect(clientMocks.fetchSearchMovies).not.toHaveBeenCalled();
    expect(screen.getByTestId("movie-stack-column")).toBeInTheDocument();
  });

  it("submits a trimmed query once and replaces Discover with its results", async () => {
    clientMocks.fetchSearchMovies.mockResolvedValue(createResults());
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.change(openSearch(), {
      target: { value: " dune " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar películas" }));

    await screen.findByRole("heading", { name: "Resultados para “dune”" });
    expect(clientMocks.fetchSearchMovies).toHaveBeenCalledTimes(1);
    expect(clientMocks.fetchSearchMovies).toHaveBeenCalledWith("dune", 1);
    expect(screen.queryByTestId("movie-stack-column")).not.toBeInTheDocument();
  });

  it("submits sequential queries and requests numbered pages explicitly", async () => {
    clientMocks.fetchSearchMovies
      .mockResolvedValueOnce(createResults())
      .mockResolvedValueOnce(createResults())
      .mockResolvedValueOnce(createResults(2));
    render(<DiscoverScreen movies={MOVIES} />);

    const input = openSearch();
    fireEvent.change(input, { target: { value: "dune" } });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("heading", { name: "Resultados para “dune”" });
    fireEvent.change(input, { target: { value: "arrival" } });
    fireEvent.submit(screen.getByRole("search"));

    await screen.findByRole("heading", { name: "Resultados para “arrival”" });

    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    await waitFor(() => {
      expect(clientMocks.fetchSearchMovies).toHaveBeenLastCalledWith(
        "arrival",
        2,
      );
    });
  });

  it("shows empty and recoverable error states without leaving search mode", async () => {
    clientMocks.fetchSearchMovies
      .mockResolvedValueOnce(createEmptyResults())
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce(createResults());
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.change(openSearch(), {
      target: { value: "no-result" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("heading", { name: "No encontramos películas" });

    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar películas" }),
      {
        target: { value: "dune" },
      },
    );
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("link", { name: "Ver detalle de Dune" });
    expect(screen.queryByTestId("movie-stack-column")).not.toBeInTheDocument();
    expect(clientMocks.fetchSearchMovies).toHaveBeenCalledTimes(3);
  });

  /** A search result is a film in a list, so it is a link to that film. It
   * used to fetch the detail into this screen's state and throw it over the
   * results, which meant no address for anything anybody found. */
  it("sends a result to the film's own address", async () => {
    clientMocks.fetchSearchMovies.mockResolvedValue(createResults());
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.change(openSearch(), { target: { value: "dune" } });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("heading", { name: "Resultados para “dune”" });

    expect(
      screen.getByRole("link", { name: "Ver detalle de Dune" }),
    ).toHaveAttribute("href", `/movies/${MOVIES[0].movie.id}/dune`);
    expect(clientMocks.fetchMovieDetail).not.toHaveBeenCalled();
  });

  it("closes an active search and restores the swipe", async () => {
    clientMocks.fetchSearchMovies.mockResolvedValue(createResults());
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.change(openSearch(), { target: { value: "dune" } });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("heading", { name: "Resultados para “dune”" });

    fireEvent.click(screen.getByRole("button", { name: "Volver a descubrir" }));

    expect(screen.getByTestId("movie-stack-column")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("search")).not.toBeInTheDocument(),
    );
    const restoredTrigger = screen.getByRole("button", {
      name: "Abrir buscador de películas",
    });
    expect(restoredTrigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(restoredTrigger).toHaveFocus());
  });
});
