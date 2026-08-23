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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaginationMeta } from "@/contracts/common";
import type { LikedMovieItem, LikesWatchedFilter } from "@/contracts/likes";

import { LikedMoviesScreen } from "./liked-movies-screen";

const { fetchMovieDetail, fetchMovieReviews, push } = vi.hoisted(() => ({
  fetchMovieDetail: vi.fn(),
  fetchMovieReviews: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/movie-detail/movie-detail-client", () => ({
  fetchMovieDetail,
}));

vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews,
  upsertMovieReview: vi.fn().mockResolvedValue(null),
  deleteMovieReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/interactions/interaction-client", () => ({
  setMovieReaction: vi.fn().mockResolvedValue(undefined),
  removeMovieReaction: vi.fn().mockResolvedValue(undefined),
  setMovieWatched: vi.fn().mockResolvedValue(undefined),
}));

/** The overlay now loads the detail from the API instead of a fixture, so the
 * screen tests provide that payload. */
function stubMovieDetail(item: LikedMovieItem) {
  fetchMovieDetail.mockResolvedValue({
    movie: {
      ...item.movie,
      tagline: null,
      runtime: 120,
      genres: [{ id: 18, name: "Drama" }],
      director: null,
      cast: [],
      keywords: [],
      trailer: null,
    },
    viewerState: { reaction: "LIKE", watchedAt: item.watchedAt },
    reviewSummary: {
      recommended: 0,
      notWorthIt: 0,
      total: 0,
      recommendationRate: null,
    },
    myReview: null,
  });
  fetchMovieReviews.mockResolvedValue({
    data: [],
    meta: {
      page: 1,
      pageSize: 20,
      totalPages: 0,
      totalResults: 0,
      hasNextPage: false,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

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

function createMeta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalResults: 3,
    hasNextPage: false,
    ...overrides,
  };
}

const ITEMS = [
  createLikedMovie(1, "Interstellar", "2026-08-02T12:00:00Z"),
  createLikedMovie(2, "Parásitos", null),
  createLikedMovie(3, "Her", null),
];

function renderScreen(options?: {
  items?: LikedMovieItem[];
  meta?: Partial<PaginationMeta>;
  watched?: LikesWatchedFilter;
  search?: string;
}) {
  return render(
    <LikedMoviesScreen
      items={options?.items ?? ITEMS}
      meta={createMeta(options?.meta)}
      search={options?.search}
      watched={options?.watched ?? "all"}
    />,
  );
}

async function openDetail(item: LikedMovieItem) {
  stubMovieDetail(item);
  fireEvent.click(
    screen.getByRole("button", { name: `Ver detalle de ${item.movie.title}` }),
  );

  return screen.findByRole("dialog", {
    name: `Detalle de ${item.movie.title}`,
  });
}

const [INTERSTELLAR, PARASITOS] = ITEMS;

describe("LikedMoviesScreen", () => {
  it("renders the complete collection with its watched presentation", () => {
    renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: "Mis películas" }),
    ).toBeTruthy();
    expect(screen.getByText("3 películas")).toBeTruthy();
    expect(screen.getByText("Interstellar")).toBeTruthy();
    expect(screen.getByText("Parásitos")).toBeTruthy();
    expect(screen.getByText("Her")).toBeTruthy();
    expect(screen.getByText("Vista", { exact: true })).toBeTruthy();
    expect(screen.getByRole("list").classList).toContain("xl:grid-cols-5");
    // The library caps at five across like every other grid in the app: at six
    // a full page of twenty left a ragged row of two.
    expect(screen.getByRole("list").className).not.toMatch(/2xl:grid-cols/);
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens the movie detail when selecting a liked movie", async () => {
    renderScreen();

    expect(await openDetail(INTERSTELLAR!)).toBeInTheDocument();
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
    renderScreen();

    await openDetail(INTERSTELLAR!);
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

  it("shows the watched badge after marking a movie from the detail", async () => {
    renderScreen();

    await openDetail(PARASITOS!);
    fireEvent.click(screen.getByRole("button", { name: "Marcar vista" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Detalle de Parásitos" }),
      ).not.toBeInTheDocument();
    });
    const parasitosAction = screen.getByRole("button", {
      name: "Ver detalle de Parásitos",
    });
    expect(
      within(parasitosAction.closest("article")!).getByText("Vista"),
    ).toBeInTheDocument();
  });

  /** The screen used to paint its own hover layer and then neutralise the one
   * the card painted over the whole tile. The card handles it now. */
  it("leaves the hover treatment to the poster card", () => {
    renderScreen();

    const action = screen.getByRole("button", {
      name: "Ver detalle de Interstellar",
    });

    expect(action.className).not.toMatch(/hover:bg-/);
    expect(action.closest("li")?.className).not.toMatch(/bg-transparent!/);
    expect(
      screen
        .getByRole("img", { name: "Póster de Interstellar" })
        .closest("figure"),
    ).toHaveClass("overflow-hidden");
  });
});

describe("LikedMoviesScreen paging", () => {
  it("reports the whole library instead of the movies on screen", () => {
    renderScreen({ meta: { page: 2, totalPages: 3, totalResults: 47 } });

    expect(
      screen.getByText("47 películas · Página 2 de 3"),
    ).toBeInTheDocument();
  });

  it("walks to the next page and back to the previous one", () => {
    const { rerender } = renderScreen({
      meta: { page: 2, totalPages: 3, totalResults: 47, hasNextPage: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(push).toHaveBeenLastCalledWith("/liked?page=3");

    rerender(
      <LikedMoviesScreen
        items={ITEMS}
        meta={createMeta({ page: 3, totalPages: 3, totalResults: 47 })}
        watched="all"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));

    expect(push).toHaveBeenLastCalledWith("/liked?page=2");
  });

  /** The list used to be copied into state on mount, so a second page arrived
   * as a new prop and was never shown. */
  it("shows the movies of the page it receives, not the ones it mounted with", () => {
    const { rerender } = renderScreen({
      meta: { page: 1, totalPages: 2, totalResults: 25, hasNextPage: true },
    });

    rerender(
      <LikedMoviesScreen
        items={[createLikedMovie(21, "Dune", null)]}
        meta={createMeta({ page: 2, totalPages: 2, totalResults: 25 })}
        watched="all"
      />,
    );

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.queryByText("Interstellar")).not.toBeInTheDocument();
  });

  it("keeps the first page out of the URL so /liked stays clean", () => {
    renderScreen({
      meta: { page: 2, totalPages: 2, totalResults: 25 },
      watched: "watched",
    });

    fireEvent.click(screen.getByRole("button", { name: "Página 1" }));

    expect(push).toHaveBeenLastCalledWith("/liked?watched=watched");
  });

  it("hides the controls while the whole library fits on one page", () => {
    renderScreen();

    expect(
      screen.queryByRole("navigation", { name: "Paginación de resultados" }),
    ).not.toBeInTheDocument();
  });
});

describe("LikedMoviesScreen filters", () => {
  /** Filtering in the browser only ever saw the twenty movies the page had
   * already loaded, so the filter asks the database now. */
  it("asks the server for the filtered library from its first page", () => {
    renderScreen({ meta: { page: 3, totalPages: 4, totalResults: 70 } });

    fireEvent.click(screen.getByRole("button", { name: "Vistas" }));

    expect(push).toHaveBeenLastCalledWith("/liked?watched=watched");
  });

  it("marks the filter the server actually applied", () => {
    renderScreen({ watched: "unwatched" });

    expect(screen.getByRole("button", { name: "No vistas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("carries the active filter into the next page", () => {
    renderScreen({
      meta: { page: 1, totalPages: 2, totalResults: 25, hasNextPage: true },
      watched: "unwatched",
    });

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(push).toHaveBeenLastCalledWith("/liked?watched=unwatched&page=2");
  });

  it("explains an empty library in the terms of the active filter", () => {
    renderScreen({
      items: [],
      meta: { totalPages: 0, totalResults: 0 },
      watched: "watched",
    });

    expect(
      screen.getByRole("heading", {
        name: "Todavía no marcaste ninguna como vista",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("LikedMoviesScreen posters", () => {
  it("paints the real artwork instead of a placeholder", () => {
    const withPoster = {
      ...INTERSTELLAR!,
      movie: { ...INTERSTELLAR!.movie, posterPath: "/poster.jpg" },
    };

    renderScreen({ items: [withPoster] });

    const poster = screen.getByRole("img", {
      name: `Póster de ${withPoster.movie.title}`,
    });

    expect(poster).toHaveStyle({
      backgroundImage: 'url("https://image.tmdb.org/t/p/w780/poster.jpg")',
    });
  });

  it("falls back to a neutral fill when the movie has no artwork", () => {
    const withoutPoster = {
      ...INTERSTELLAR!,
      movie: { ...INTERSTELLAR!.movie, posterPath: null, backdropPath: null },
    };

    renderScreen({ items: [withoutPoster] });

    const poster = screen.getByRole("img", {
      name: `Póster de ${withoutPoster.movie.title}`,
    });

    expect(poster.getAttribute("style")).toContain("repeating-linear-gradient");
  });
});

describe("LikedMoviesScreen search", () => {
  function openSearch() {
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir buscador de la biblioteca",
      }),
    );
  }

  it("keeps the box out of the way until it is asked for", () => {
    renderScreen();

    expect(screen.queryByRole("search")).not.toBeInTheDocument();

    openSearch();

    expect(
      screen.getByRole("search", { name: "Búsqueda en la biblioteca" }),
    ).toBeInTheDocument();
  });

  /** A different term is a different library, so it cannot land on an offset
   * that belonged to the previous one. */
  it("searches from the first page and keeps the active filter", () => {
    renderScreen({
      meta: { page: 4, totalPages: 7, totalResults: 133 },
      watched: "watched",
    });
    openSearch();

    fireEvent.change(
      screen.getByRole("textbox", { name: /Buscar en mis películas/i }),
      { target: { value: "  matrix  " } },
    );
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenLastCalledWith("/liked?search=matrix&watched=watched");
  });

  it("opens already showing the term that produced the list", () => {
    renderScreen({ search: "matrix" });

    expect(
      screen.getByRole("textbox", { name: /Buscar en mis películas/i }),
    ).toHaveValue("matrix");
  });

  it("carries the term into the next page", () => {
    renderScreen({
      meta: { page: 1, totalPages: 2, totalResults: 25, hasNextPage: true },
      search: "matrix",
    });

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(push).toHaveBeenLastCalledWith("/liked?search=matrix&page=2");
  });

  it("drops the term when the search is cleared", () => {
    renderScreen({ search: "matrix" });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(push).toHaveBeenLastCalledWith("/liked");
  });

  it("says which term found nothing", () => {
    renderScreen({
      items: [],
      meta: { totalPages: 0, totalResults: 0 },
      search: "zzzz",
    });

    expect(
      screen.getByRole("heading", {
        name: 'Nada en tu biblioteca para "zzzz"',
      }),
    ).toBeInTheDocument();
  });

  it("submits nothing when the box holds only spaces", () => {
    renderScreen();
    openSearch();

    fireEvent.change(
      screen.getByRole("textbox", { name: /Buscar en mis películas/i }),
      { target: { value: "   " } },
    );
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenLastCalledWith("/liked");
  });
});
