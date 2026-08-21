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

  it("loads only explicit numbered pages while preserving valid detail content", async () => {
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

    await screen.findByRole("button", { name: "Página 2" });
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));

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
      screen.getByRole("group", { name: "Tu reacción" }),
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
        persistence={persistence}
        publicReviews={INITIAL.publicReviews}
      />,
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: "Tu reacción" })).getByRole(
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
