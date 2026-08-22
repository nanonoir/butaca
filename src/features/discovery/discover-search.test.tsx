/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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

import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";
import { getMovieDetailExperienceFixture } from "@/fixtures/movie-details";

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
  it("keeps typing and blank submission local to the search form", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const input = screen.getByLabelText("Buscar películas");
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

    fireEvent.change(screen.getByLabelText("Buscar películas"), {
      target: { value: " dune " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await screen.findByRole("heading", { name: "Resultados para “dune”" });
    expect(clientMocks.fetchSearchMovies).toHaveBeenCalledTimes(1);
    expect(clientMocks.fetchSearchMovies).toHaveBeenCalledWith("dune", 1);
    expect(screen.queryByTestId("movie-stack-column")).not.toBeInTheDocument();
  });

  it("keeps only the latest query response and requests numbered pages explicitly", async () => {
    let resolveFirstSearch:
      ((value: ReturnType<typeof createResults>) => void) | undefined;
    clientMocks.fetchSearchMovies
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof createResults>>((resolve) => {
            resolveFirstSearch = resolve;
          }),
      )
      .mockResolvedValueOnce(createResults())
      .mockResolvedValueOnce(createResults(2));
    render(<DiscoverScreen movies={MOVIES} />);

    const input = screen.getByLabelText("Buscar películas");
    fireEvent.change(input, { target: { value: "dune" } });
    fireEvent.submit(screen.getByRole("search"));
    fireEvent.change(input, { target: { value: "arrival" } });
    fireEvent.submit(screen.getByRole("search"));

    await screen.findByRole("heading", { name: "Resultados para “arrival”" });
    resolveFirstSearch?.(createResults());
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Resultados para “arrival”" }),
      ).toBeInTheDocument();
    });

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

    fireEvent.change(screen.getByLabelText("Buscar películas"), {
      target: { value: "no-result" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("heading", { name: "No encontramos películas" });

    fireEvent.change(screen.getByLabelText("Buscar películas"), {
      target: { value: "dune" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await screen.findByRole("button", { name: "Ver detalle de Dune" });
    expect(screen.queryByTestId("movie-stack-column")).not.toBeInTheDocument();
    expect(clientMocks.fetchSearchMovies).toHaveBeenCalledTimes(3);
  });

  it("opens real detail data, restores focus, and clears back to Discover", async () => {
    clientMocks.fetchSearchMovies.mockResolvedValue(createResults());
    const detail = getMovieDetailExperienceFixture(MOVIES[0].movie);
    clientMocks.fetchMovieDetail.mockResolvedValue(detail.pageData);
    clientMocks.fetchMovieReviews.mockResolvedValue({
      data: detail.publicReviews,
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalResults: 0,
        hasNextPage: false,
      },
    });
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.change(screen.getByLabelText("Buscar películas"), {
      target: { value: "dune" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("heading", { name: "Resultados para “dune”" });

    const trigger = screen.getByRole("button", {
      name: "Ver detalle de Dune",
    });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Detalle de Dune" });
    expect(clientMocks.fetchMovieDetail).toHaveBeenCalledWith(
      MOVIES[0].movie.id,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(
      screen.getByRole("heading", { name: "Resultados para “dune”" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByTestId("movie-stack-column")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar películas")).toHaveValue("");
  });
});
