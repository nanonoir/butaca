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

const clientMocks = vi.hoisted(() => ({
  fetchSimilarMovies: vi.fn(),
  fetchMovieDetail: vi.fn(),
  fetchMovieReviews: vi.fn(),
}));

vi.mock("@/features/movies/movie-catalog-client", () => ({
  fetchSimilarMovies: clientMocks.fetchSimilarMovies,
}));
vi.mock("@/features/movie-detail/movie-detail-client", () => ({
  fetchMovieDetail: clientMocks.fetchMovieDetail,
}));
vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews: clientMocks.fetchMovieReviews,
}));

import { getMovieDetailExperienceFixture } from "@/fixtures/movie-details";

import { MovieDetailScreen } from "./movie-detail-screen";

const INITIAL = getMovieDetailExperienceFixture({
  id: 438631,
  title: "Dune",
  originalTitle: "Dune",
  overview: "",
  posterPath: "/dune.jpg",
  backdropPath: null,
  genreIds: [878],
  releaseDate: "2021-09-15",
  originalLanguage: "en",
  tmdbRating: 7.8,
  tmdbVoteCount: 13_400,
});

const SIMILAR_MOVIE = {
  id: 603,
  title: "The Matrix",
  originalTitle: "The Matrix",
  overview: "A hacker discovers the world is simulated.",
  posterPath: "/matrix.jpg",
  backdropPath: null,
  genreIds: [28, 878],
  releaseDate: "1999-03-30",
  originalLanguage: "en",
  tmdbRating: 8.2,
  tmdbVoteCount: 26_000,
};

function createSimilarResponse(movieId: number, page = 1) {
  return {
    data: [
      {
        ...SIMILAR_MOVIE,
        id: movieId,
        title: movieId === INITIAL.pageData.movie.id ? "Dune" : "The Matrix",
      },
      SIMILAR_MOVIE,
    ],
    meta: {
      page,
      pageSize: 20 as const,
      totalPages: 2,
      totalResults: 21,
      hasNextPage: page < 2,
    },
  };
}

function createSimilarDetail() {
  return {
    ...INITIAL.pageData,
    movie: {
      ...INITIAL.pageData.movie,
      id: SIMILAR_MOVIE.id,
      title: SIMILAR_MOVIE.title,
      originalTitle: SIMILAR_MOVIE.originalTitle,
      overview: SIMILAR_MOVIE.overview,
      trailer: null,
    },
    viewerState: { reaction: null, watchedAt: null },
    myReview: null,
  };
}

function createPersistence() {
  return {
    setReaction: vi.fn().mockResolvedValue(undefined),
    clearReaction: vi.fn().mockResolvedValue(undefined),
    setWatched: vi.fn().mockResolvedValue(undefined),
    saveReview: vi.fn(),
    deleteReview: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(cleanup);

beforeEach(() => {
  clientMocks.fetchSimilarMovies.mockReset();
  clientMocks.fetchMovieDetail.mockReset();
  clientMocks.fetchMovieReviews.mockReset();
});

describe("MovieDetailScreen similar movies", () => {
  it("filters the active movie, opens a similar detail in the same modal, and resets to page one", async () => {
    clientMocks.fetchSimilarMovies.mockImplementation((movieId: number) =>
      Promise.resolve(createSimilarResponse(movieId)),
    );
    clientMocks.fetchMovieDetail.mockResolvedValue(createSimilarDetail());
    clientMocks.fetchMovieReviews.mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 0,
        totalResults: 0,
        hasNextPage: false,
      },
    });
    render(
      <MovieDetailScreen
        onClose={vi.fn()}
        pageData={INITIAL.pageData}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    const similarSection = await screen.findByRole("region", {
      name: "Películas similares",
    });
    expect(
      within(similarSection).queryByRole("button", {
        name: "Ver detalle de Dune",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(similarSection).getByRole("button", {
        name: "Ver detalle de The Matrix",
      }),
    );

    await screen.findByRole("dialog", { name: "Detalle de The Matrix" });
    expect(
      screen.getByRole("button", { name: "Cerrar detalle" }),
    ).toHaveFocus();
    expect(clientMocks.fetchMovieDetail).toHaveBeenCalledWith(SIMILAR_MOVIE.id);
    expect(clientMocks.fetchSimilarMovies).toHaveBeenLastCalledWith(
      SIMILAR_MOVIE.id,
      1,
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Escribir reseña" }),
    ).toBeInTheDocument();
  });

  it("shows three similar movies at a time and walks the window without refetching", async () => {
    const movies = Array.from({ length: 6 }, (_unused, index) => ({
      ...SIMILAR_MOVIE,
      id: 9_000 + index,
      title: `Similar ${index + 1}`,
    }));
    clientMocks.fetchSimilarMovies.mockResolvedValue({
      data: movies,
      meta: {
        page: 1,
        pageSize: 20 as const,
        totalPages: 1,
        totalResults: 6,
        hasNextPage: false,
      },
    });
    render(
      <MovieDetailScreen
        onClose={vi.fn()}
        pageData={INITIAL.pageData}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    const section = await screen.findByRole("region", {
      name: "Películas similares",
    });

    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(section).getByRole("button", { name: "Ver detalle de Similar 1" }),
    ).toBeInTheDocument();

    fireEvent.click(within(section).getByRole("button", { name: "Página siguiente" }));

    await waitFor(() => {
      expect(
        within(section).getByRole("button", {
          name: "Ver detalle de Similar 4",
        }),
      ).toBeInTheDocument();
    });
    expect(
      within(section).queryByRole("button", {
        name: "Ver detalle de Similar 1",
      }),
    ).not.toBeInTheDocument();
    // The second window came from the movies already loaded.
    expect(clientMocks.fetchSimilarMovies).toHaveBeenCalledOnce();
  });

  it("walks the similar movies window back and reports the page", async () => {
    const movies = Array.from({ length: 6 }, (_unused, index) => ({
      ...SIMILAR_MOVIE,
      id: 9_000 + index,
      title: `Similar ${index + 1}`,
    }));
    clientMocks.fetchSimilarMovies.mockResolvedValue({
      data: movies,
      meta: {
        page: 1,
        pageSize: 20 as const,
        totalPages: 1,
        totalResults: 6,
        hasNextPage: false,
      },
    });
    render(
      <MovieDetailScreen
        onClose={vi.fn()}
        pageData={INITIAL.pageData}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    const section = await screen.findByRole("region", {
      name: "Películas similares",
    });

    expect(within(section).getByText("Página 1")).toBeInTheDocument();
    expect(
      within(section).getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();

    fireEvent.click(within(section).getByRole("button", { name: "Página siguiente" }));

    await waitFor(() => {
      expect(within(section).getByText("Página 2")).toBeInTheDocument();
    });
    expect(
      within(section).getByRole("button", { name: "Página anterior" }),
    ).toBeEnabled();
    // Nothing left after the second window, so continuing is offered no more.
    expect(
      within(section).getByRole("button", { name: "Página siguiente" }),
    ).toBeDisabled();

    fireEvent.click(within(section).getByRole("button", { name: "Página anterior" }));

    await waitFor(() => {
      expect(within(section).getByText("Página 1")).toBeInTheDocument();
    });
    expect(
      within(section).getByRole("button", { name: "Ver detalle de Similar 1" }),
    ).toBeInTheDocument();
  });

  it("pulls the next provider page once the loaded similar movies run out", async () => {
    clientMocks.fetchSimilarMovies.mockResolvedValue(
      createSimilarResponse(INITIAL.pageData.movie.id),
    );
    render(
      <MovieDetailScreen
        onClose={vi.fn()}
        pageData={INITIAL.pageData}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    await screen.findByRole("button", { name: "Página siguiente" });
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    await waitFor(() => {
      expect(clientMocks.fetchSimilarMovies).toHaveBeenLastCalledWith(
        INITIAL.pageData.movie.id,
        2,
      );
    });
    expect(screen.getByText("Sinopsis")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver trailer" }),
    ).toBeInTheDocument();
  });

  it("keeps primary detail usable when similar movies fail and a trailer is absent", async () => {
    clientMocks.fetchSimilarMovies.mockRejectedValue(
      new Error("catalog unavailable"),
    );
    const detailWithoutTrailer = {
      ...INITIAL.pageData,
      movie: { ...INITIAL.pageData.movie, trailer: null },
    };
    render(
      <MovieDetailScreen
        onClose={vi.fn()}
        pageData={detailWithoutTrailer}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    await screen.findByRole("alert");
    expect(screen.getByText("Sinopsis")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Tu estado" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver trailer" }),
    ).not.toBeInTheDocument();
  });

  it("preserves original viewer state and persistence callbacks after similar navigation", async () => {
    const persistence = createPersistence();
    const onClose = vi.fn();
    clientMocks.fetchSimilarMovies.mockImplementation((movieId: number) =>
      Promise.resolve(createSimilarResponse(movieId)),
    );
    clientMocks.fetchMovieDetail.mockResolvedValue(createSimilarDetail());
    clientMocks.fetchMovieReviews.mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalPages: 0,
        totalResults: 0,
        hasNextPage: false,
      },
    });
    render(
      <MovieDetailScreen
        onClose={onClose}
        pageData={INITIAL.pageData}
        createPersistence={() => persistence}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "Tu estado" })).getByRole(
        "button",
        { name: "Me gusta" },
      ),
    );
    await screen.findByRole("button", { name: "Ver detalle de The Matrix" });
    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle de The Matrix" }),
    );
    await screen.findByRole("dialog", { name: "Detalle de The Matrix" });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    expect(persistence.setReaction).toHaveBeenCalledWith("LIKE");
    expect(onClose).toHaveBeenCalledWith({ reaction: "LIKE", watchedAt: null });
  });
});

describe("MovieDetailScreen viewer state", () => {
  function renderDetail(persistence = createPersistence()) {
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
    render(
      <MovieDetailScreen
        createPersistence={() => persistence}
        onClose={vi.fn()}
        pageData={INITIAL.pageData}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    return persistence;
  }

  /** They used to live in a card under the synopsis, past a scroll. */
  it("puts the three controls on the artwork, above the synopsis", () => {
    renderDetail();

    const group = screen.getByRole("group", { name: "Tu estado" });
    expect(group.closest("header")).not.toBeNull();
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Me gusta", "No me gusta", "Marcar vista"]);
  });

  /** On one column the page is a sequence, and what other people said about
   * this movie belongs before a list of other movies. Side by side from lg up
   * the order stops meaning anything, so only this one is worth pinning. */
  it("puts the reviews before the similar movies in reading order", () => {
    renderDetail();

    const reviews = screen.getByRole("heading", { name: "La comunidad" });
    const similar = screen.getByRole("heading", {
      name: "Películas similares",
    });

    expect(
      reviews.compareDocumentPosition(similar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /** The separate "Quitar reacción" button is gone: each control undoes
   * itself, which is the only way an icon on its own can. */
  it("clears the reaction when the one already on is pressed again", async () => {
    const persistence = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Me gusta" }));

    const liked = screen.getByRole("button", { name: "Quitar me gusta" });
    expect(liked).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(liked);

    await waitFor(() => {
      expect(persistence.clearReaction).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("button", { name: "Me gusta" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("swaps one reaction for the other without clearing in between", async () => {
    const persistence = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Me gusta" }));
    fireEvent.click(screen.getByRole("button", { name: "No me gusta" }));

    await waitFor(() => {
      expect(persistence.setReaction).toHaveBeenLastCalledWith("DISLIKE");
    });
    expect(persistence.clearReaction).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Me gusta" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the eye answering for itself while a reaction is on", async () => {
    const persistence = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Me gusta" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar vista" }));

    await waitFor(() => {
      expect(persistence.setWatched).toHaveBeenCalledWith(true);
    });
    expect(
      screen.getByRole("button", { name: "Quitar me gusta" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Marcar no vista" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
