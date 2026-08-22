/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  fetchGenres: vi.fn(),
  fetchSearchMovies: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("@/features/onboarding/onboarding-client", () => ({ completeOnboarding: mocks.complete }));
vi.mock("@/features/movies/movie-catalog-client", () => ({
  fetchMovieGenres: mocks.fetchGenres,
  fetchSearchMovies: mocks.fetchSearchMovies,
}));

import { OnboardingScreen } from "./onboarding-screen";

const movie = {
  id: 550,
  title: "Fight Club",
  originalTitle: "Fight Club",
  overview: "A movie",
  posterPath: null,
  backdropPath: null,
  genreIds: [18],
  releaseDate: "1999-10-15",
  originalLanguage: "en",
  tmdbRating: 8,
  tmdbVoteCount: 100,
};

describe("OnboardingScreen", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.fetchGenres.mockResolvedValue([
      { id: 28, name: "Action" },
      { id: 12, name: "Adventure" },
    ]);
  });

  afterEach(cleanup);

  it("preserves genre selection while searching and selecting movies", async () => {
    mocks.fetchSearchMovies.mockResolvedValue({
      data: [movie],
      meta: { page: 1, pageSize: 20, totalPages: 1, totalResults: 1, hasNextPage: false },
    });
    render(<OnboardingScreen />);

    await screen.findByRole("button", { name: "Action" });
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    fireEvent.click(screen.getByRole("button", { name: "Adventure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar con películas" }));
    fireEvent.change(screen.getByLabelText("Buscar películas"), { target: { value: "fight" } });
    fireEvent.submit(screen.getByRole("search"));

    await screen.findByRole("button", { name: "Seleccionar Fight Club" });
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar Fight Club" }));
    expect(screen.getAllByRole("button", { name: "Quitar Fight Club" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Volver a géneros" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 géneros elegidos. Podés sumar hasta 8.",
    );
  });

  it("retries one transient completion failure and keeps selections after exhaustion", async () => {
    mocks.complete.mockRejectedValue(new (await import("@/lib/api/client")).ApiClientError("INTERNAL_ERROR"));
    render(<OnboardingScreen />);
    await screen.findByRole("button", { name: "Action" });
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    fireEvent.click(screen.getByRole("button", { name: "Adventure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar con películas" }));

    const movies = [movie, { ...movie, id: 680, title: "Pulp Fiction" }, { ...movie, id: 155, title: "The Dark Knight" }];
    mocks.fetchSearchMovies.mockResolvedValue({ data: movies, meta: { page: 1, pageSize: 20, totalPages: 1, totalResults: 3, hasNextPage: false } });
    fireEvent.change(screen.getByLabelText("Buscar películas"), { target: { value: "fight" } });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("button", { name: "Seleccionar Fight Club" });
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar Fight Club" }));
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar Pulp Fiction" }));
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar The Dark Knight" }));
    fireEvent.click(screen.getByRole("button", { name: "Completar perfil" }));

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("alert")).toHaveTextContent("Conservamos tus selecciones");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  /** The shell prefetches "/" while onboarding is open, and the proxy answers
   * that prefetch by sending an unfinished profile straight back here. Replacing
   * without dropping that cached answer leaves the viewer on this page. */
  it("drops the cached route before leaving for the home page", async () => {
    mocks.complete.mockResolvedValue(undefined);
    render(<OnboardingScreen />);
    await screen.findByRole("button", { name: "Action" });
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    fireEvent.click(screen.getByRole("button", { name: "Adventure" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar con películas" }),
    );

    const movies = [
      movie,
      { ...movie, id: 680, title: "Pulp Fiction" },
      { ...movie, id: 155, title: "The Dark Knight" },
    ];
    mocks.fetchSearchMovies.mockResolvedValue({
      data: movies,
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalResults: 3,
        hasNextPage: false,
      },
    });
    fireEvent.change(screen.getByLabelText("Buscar películas"), {
      target: { value: "fight" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("button", { name: "Seleccionar Fight Club" });
    for (const title of ["Fight Club", "Pulp Fiction", "The Dark Knight"]) {
      fireEvent.click(screen.getByRole("button", { name: `Seleccionar ${title}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Completar perfil" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.refresh.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.replace.mock.invocationCallOrder[0]!,
    );
  });

  it("asks for one thing at a time instead of three numbers at once", async () => {
    render(<OnboardingScreen />);

    await screen.findByRole("button", { name: "Action" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Elegí al menos 2 géneros para continuar.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Llevás 1. Elegí 1 más para continuar.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Adventure" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 géneros elegidos. Podés sumar hasta 8.",
    );
  });

  it("counts movies in the feminine and states their own minimum", async () => {
    render(<OnboardingScreen />);

    await screen.findByRole("button", { name: "Action" });
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    fireEvent.click(screen.getByRole("button", { name: "Adventure" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar con películas" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Elegí al menos 3 películas para continuar.",
    );

    mocks.fetchSearchMovies.mockResolvedValue({
      data: [movie, { ...movie, id: 680, title: "Pulp Fiction" }],
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalResults: 2,
        hasNextPage: false,
      },
    });
    fireEvent.change(screen.getByLabelText("Buscar películas"), {
      target: { value: "fight" },
    });
    fireEvent.submit(screen.getByRole("search"));
    await screen.findByRole("button", { name: "Seleccionar Fight Club" });
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar Fight Club" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Llevás 1. Elegí 2 más para continuar.",
    );
  });
});
