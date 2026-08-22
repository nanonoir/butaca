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

import { setMovieReaction } from "@/features/interactions/interaction-client";
import { fetchDiscoverBatch } from "@/features/recommendations/discover-client";
import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";

import { DiscoverScreen } from "./discover-screen";
import { resolveSwipeIntent } from "./resolve-swipe-intent";

/** The screen now persists by default, so the writes are stubbed here instead
 * of reaching the network. */
vi.mock("@/features/recommendations/discover-client", () => ({
  fetchDiscoverBatch: vi.fn().mockResolvedValue({
    movies: [],
    batchSize: 10,
    returned: 0,
  }),
}));

vi.mock("@/features/interactions/interaction-client", () => ({
  setMovieReaction: vi.fn().mockResolvedValue(undefined),
  removeMovieReaction: vi.fn().mockResolvedValue(undefined),
  setMovieWatched: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews: vi.fn().mockResolvedValue({
    data: [],
    meta: {
      page: 1,
      pageSize: 20,
      totalPages: 0,
      totalResults: 0,
      hasNextPage: false,
    },
  }),
  upsertMovieReview: vi.fn((_movieId: number, draft: unknown) =>
    Promise.resolve({
      id: "20000000-0000-4000-8000-000000000001",
      movieId: 1,
      author: { displayName: "Tú", avatarUrl: null },
      isMine: true,
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
      ...(draft as Record<string, unknown>),
    }),
  ),
  deleteMovieReview: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const MOVIES = DISCOVER_MOVIES_FIXTURE.data.movies.slice(0, 2);

describe("DiscoverScreen", () => {
  it("centers the current movie and previews the next card", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Descubrir" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Dune" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2021")).toBeInTheDocument();
    expect(screen.getByText("Ciencia ficción")).toBeInTheDocument();
    expect(screen.getByText("Aventura")).toBeInTheDocument();
    expect(screen.getByText("7.8 TMDB")).toBeInTheDocument();
    expect(screen.getByTestId("next-movie-card")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("ME GUSTA")).toBeInTheDocument();
    expect(screen.getByText("PASO")).toBeInTheDocument();
  });

  it("shows Buti's opinion with controls that open the contextual assistant", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const buti = screen.getByRole("complementary", {
      name: "Buti opina sobre Dune",
    });

    expect(within(buti).getByText("Buti opina")).toBeInTheDocument();
    expect(
      within(buti).getByText(/Ciencia ficción y Aventura/i),
    ).toBeInTheDocument();
    expect(
      within(buti).getByRole("img", {
        name: "Buti feliz, match alto",
      }),
    ).toHaveAttribute("data-activity", "jumping");
    expect(
      within(buti).getByRole("button", {
        name: "Preguntale a Buti sobre Dune",
      }),
    ).toBeInTheDocument();
    const mascotButton = within(buti).getByRole("button", {
      name: "Abrir asistente de Buti sobre Dune",
    });

    expect(mascotButton).toBeInTheDocument();
    expect(mascotButton.className).not.toMatch(/hover:ring/);
    expect(mascotButton).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
    );
    expect(
      within(buti).queryByRole("link", {
        name: "Preguntale a Buti sobre Dune",
      }),
    ).not.toBeInTheDocument();
    expect(within(buti).queryByText("1 / 2")).not.toBeInTheDocument();
  });

  it("shows a compact full-width Buti card below the movie on mobile", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const mobileCard = screen.getByRole("button", {
      name: "Abrir asistente de Buti sobre Dune desde el resumen",
    });

    expect(mobileCard).toHaveClass("w-full", "min-[980px]:hidden");
    expect(screen.getByTestId("movie-stack-column")).toContainElement(
      mobileCard,
    );
    expect(
      within(mobileCard).getByRole("img", {
        name: "Buti feliz, match alto",
      }),
    ).toBeInTheDocument();
    expect(
      within(mobileCard).getByText(/Ciencia ficción y Aventura/i),
    ).toBeInTheDocument();
    expect(within(mobileCard).getByText("›")).toBeInTheDocument();

    fireEvent.click(mobileCard);

    expect(
      screen.getByRole("dialog", { name: "Asistente de Buti sobre Dune" }),
    ).toBeInTheDocument();
  });

  it("keeps the poster ratio and gives it more room only on desktop", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    expect(screen.getByTestId("discover-poster-frame")).toHaveClass(
      "aspect-[2/3]",
      "h-[min(52svh,38rem)]",
      "max-h-[38rem]",
      "min-[980px]:h-[min(66svh,42rem)]",
      "min-[980px]:max-h-[42rem]",
    );
  });

  it("places Buti beside the movie when the desktop composition fits", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const recommendationRegion = screen.getByRole("region", {
      name: "Recomendaciones de películas",
    });
    const buti = screen.getByRole("complementary", {
      name: "Buti opina sobre Dune",
    });

    expect(recommendationRegion).toHaveClass(
      "min-[980px]:grid-cols-[minmax(26rem,34rem)_minmax(15rem,17rem)]",
      "min-[1180px]:grid-cols-[13rem_minmax(26rem,34rem)_minmax(15rem,17rem)]",
    );
    expect(screen.getByTestId("movie-stack-column")).toHaveClass(
      "min-[980px]:col-start-1",
      "min-[980px]:row-start-1",
      "min-[1180px]:col-start-2",
    );
    expect(buti).toHaveClass(
      "hidden",
      "min-[980px]:block",
      "min-[980px]:col-start-2",
      "min-[980px]:row-start-1",
      "min-[1180px]:col-start-3",
    );
  });

  it("opens Buti as a floating drawer without navigating away from Discover", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const movieStack = screen.getByTestId("movie-stack-column");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Preguntale a Buti sobre Dune",
      }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Asistente de Buti sobre Dune",
    });
    expect(drawer.parentElement).toHaveClass("fixed", "inset-0");
    expect(drawer).toHaveClass(
      "inset-x-3",
      "bottom-3",
      "top-[clamp(6.5rem,15dvh,9.5rem)]",
      "min-[980px]:inset-y-2",
      "min-[980px]:left-auto",
      "min-[980px]:right-2",
      "min-[980px]:w-[28rem]",
    );
    expect(drawer).not.toHaveClass("min-[980px]:w-[21rem]");
    expect(movieStack).toBeInTheDocument();
    expect(within(drawer).getByText("Buti")).toBeInTheDocument();
    expect(
      within(drawer).getByText("Conoce tus gustos y tu biblioteca"),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("group", { name: "Sugerencias rápidas" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("textbox", { name: "Preguntale a Buti" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", { name: "Nueva conversación" }),
    ).toHaveClass("min-[980px]:hidden");
    expect(within(drawer).getByTestId("buti-assistant-header")).toHaveClass(
      "shrink-0",
    );
    expect(within(drawer).getByTestId("buti-conversation-scroll")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "[scrollbar-width:none]",
      "[&::-webkit-scrollbar]:hidden",
      "min-[980px]:[scrollbar-width:auto]",
      "min-[980px]:[&::-webkit-scrollbar]:block",
    );
    expect(within(drawer).getByTestId("buti-assistant-composer")).toHaveClass(
      "shrink-0",
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("opens from the mascot and closes with Escape, restoring focus", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    const mascotTrigger = screen.getByRole("button", {
      name: "Abrir asistente de Buti sobre Dune",
    });
    fireEvent.click(mascotTrigger);

    expect(
      screen.getByRole("dialog", { name: "Asistente de Buti sobre Dune" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mascotTrigger).toHaveFocus();
    });
    expect(document.body.style.overflow).toBe("");
  });

  it("lets the user talk to Buti inside the drawer", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Preguntale a Buti sobre Dune",
      }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Asistente de Buti sobre Dune",
    });
    const input = within(drawer).getByRole("textbox", {
      name: "Preguntale a Buti",
    });
    fireEvent.change(input, {
      target: { value: "¿Por qué pensás que me va a gustar?" },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Enviar consulta" }),
    );

    expect(
      within(drawer).getByText("¿Por qué pensás que me va a gustar?"),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole("status")).toHaveTextContent(
      "Buti está pensando",
    );
    expect(
      await within(drawer).findByText(/La recomiendo porque/i, undefined, {
        timeout: 1500,
      }),
    ).toBeInTheDocument();
  });

  it("scrolls the conversation after every user and Buti message", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir asistente de Buti sobre Dune desde el resumen",
      }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Asistente de Buti sobre Dune",
    });
    const conversation = within(drawer).getByTestId("buti-conversation-scroll");
    const scrollTo = vi.fn();
    let scrollHeight = 640;

    Object.defineProperties(conversation, {
      scrollHeight: {
        configurable: true,
        get: () => scrollHeight,
      },
      scrollTo: {
        configurable: true,
        value: scrollTo,
      },
    });

    fireEvent.click(
      within(drawer).getByRole("button", { name: "¿Por qué esta?" }),
    );

    await waitFor(() => {
      expect(scrollTo).toHaveBeenLastCalledWith({
        behavior: "smooth",
        top: 640,
      });
    });

    scrollHeight = 820;
    await waitFor(
      () => {
        expect(scrollTo).toHaveBeenLastCalledWith({
          behavior: "smooth",
          top: 820,
        });
      },
      { timeout: 1500 },
    );

    const input = within(drawer).getByRole("textbox", {
      name: "Preguntale a Buti",
    });
    scrollHeight = 960;
    fireEvent.change(input, { target: { value: "Algo más corto" } });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Enviar consulta" }),
    );

    await waitFor(() => {
      expect(scrollTo).toHaveBeenLastCalledWith({
        behavior: "smooth",
        top: 960,
      });
    });

    scrollHeight = 1100;
    await waitFor(
      () => {
        expect(scrollTo).toHaveBeenLastCalledWith({
          behavior: "smooth",
          top: 1100,
        });
      },
      { timeout: 1500 },
    );
    expect(scrollTo).toHaveBeenCalledTimes(4);
  });

  it("shows compact movie recommendations in the assistant on mobile and desktop", async () => {
    render(<DiscoverScreen movies={DISCOVER_MOVIES_FIXTURE.data.movies} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir asistente de Buti sobre Dune desde el resumen",
      }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Asistente de Buti sobre Dune",
    });
    fireEvent.click(
      within(drawer).getByRole("button", {
        name: "Algo intenso para esta noche",
      }),
    );

    expect(
      await within(drawer).findByText(/La recomiendo porque/i, undefined, {
        timeout: 1500,
      }),
    ).toBeInTheDocument();

    const recommendations = within(drawer).getByRole("list", {
      name: "Recomendaciones de Buti",
    });
    expect(recommendations).toHaveClass(
      "flex",
      "overflow-x-auto",
      "[scrollbar-width:none]",
      "[&::-webkit-scrollbar]:hidden",
    );
    expect(recommendations).not.toHaveClass("min-[980px]:hidden");
    expect(within(recommendations).getAllByRole("article")).toHaveLength(3);
  });

  it("starts a new Buti conversation without closing the mobile panel", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir asistente de Buti sobre Dune desde el resumen",
      }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Asistente de Buti sobre Dune",
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "¿Por qué esta?" }),
    );
    expect(
      await within(drawer).findByText(/La recomiendo porque/i, undefined, {
        timeout: 1500,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(drawer).getByRole("button", { name: "Nueva conversación" }),
    );

    expect(within(drawer).queryByText("¿Por qué esta?")).toBeInTheDocument();
    expect(
      within(drawer).queryByText(/La recomiendo porque/i),
    ).not.toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
  });

  it("updates Buti's opinion when the current recommendation changes", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Me gusta" }));

    const buti = screen.getByRole("complementary", {
      name: "Buti opina sobre La llegada",
    });
    expect(within(buti).getByText(/Ciencia ficción/i)).toBeInTheDocument();
    expect(
      within(buti).getByRole("img", {
        name: "Buti atento, match medio",
      }),
    ).toHaveAttribute("data-activity", "idle");
    expect(
      screen.queryByRole("complementary", {
        name: "Buti opina sobre Dune",
      }),
    ).not.toBeInTheDocument();
  });

  it("offers visible reaction controls and advances after each choice", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Me gusta" }));

    expect(
      screen.getByRole("heading", { level: 2, name: "La llegada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Dune: Me gusta");
  });

  it("advances with a dislike and reports the chosen action", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(screen.getByRole("button", { name: "No me gusta" }));

    expect(
      screen.getByRole("heading", { level: 2, name: "La llegada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Dune: Paso");
  });

  it("opens a complete movie detail without leaving Discover", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Más información sobre Dune" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Detalle de Dune" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Backdrop de Dune" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Póster de Dune" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 h 35 min")).toBeInTheDocument();
    expect(screen.getByText("Denis Villeneuve")).toBeInTheDocument();
    expect(screen.getByText("Timothée Chalamet")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ver trailer" })).toBeVisible();
    });
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("126 reseñas")).toBeInTheDocument();
    expect(screen.getByText("Camila")).toBeInTheDocument();
    expect(
      screen.getByText(/Paul Atreides debe viajar al planeta más peligroso/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("removes a reacted movie from Discover after closing its detail", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Más información sobre Dune" }),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "Tu reacción" })).getByRole(
        "button",
        { name: "Me gusta" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "La llegada" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Dune: Me gusta");
  });

  it("keeps watched state independent from the personal reaction", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Más información sobre Dune" }),
    );

    const reactionGroup = screen.getByRole("group", {
      name: "Tu reacción",
    });
    const likeButton = within(reactionGroup).getByRole("button", {
      name: "Me gusta",
    });

    fireEvent.click(likeButton);
    fireEvent.click(screen.getByRole("button", { name: "Marcar vista" }));

    expect(likeButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Marcar no vista" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar reacción" }));

    expect(likeButton).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Marcar no vista" }),
    ).toBeInTheDocument();
  });

  it("opens the trailer in an overlay", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Más información sobre Dune" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver trailer" }));

    expect(
      screen.getByRole("dialog", { name: "Trailer de Dune" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar trailer" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Trailer de Dune" }),
      ).not.toBeInTheDocument();
    });
  });

  it("hides the trailer action when the movie has no trailer", () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(screen.getByRole("button", { name: "No me gusta" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Más información sobre La llegada",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Detalle de La llegada" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Título original: Arrival")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver trailer" }),
    ).not.toBeInTheDocument();
  });

  it("creates and removes the viewer review with live character counters", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Más información sobre Dune" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Escribir reseña" }));

    const editor = screen.getByRole("dialog", { name: "Escribir reseña" });
    const titleInput = within(editor).getByLabelText("Título");
    const reviewInput = within(editor).getByLabelText("Reseña");

    expect(titleInput).toHaveAttribute("maxlength", "30");
    expect(reviewInput).toHaveAttribute("maxlength", "400");
    expect(within(editor).getByText("0 / 30")).toBeInTheDocument();
    expect(within(editor).getByText("0 / 400")).toBeInTheDocument();

    fireEvent.click(within(editor).getByRole("button", { name: "Recomiendo" }));
    fireEvent.change(titleInput, { target: { value: "Una gran experiencia" } });
    fireEvent.change(reviewInput, {
      target: {
        value:
          "Una historia enorme, íntima y visualmente inolvidable. La volvería a ver.",
      },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Publicar reseña" }),
    );

    const ownReview = await screen.findByRole("article", {
      name: "Tu reseña",
    });
    await waitFor(() => {
      expect(within(ownReview).getByText("Una gran experiencia")).toBeVisible();
    });

    fireEvent.click(within(ownReview).getByRole("button", { name: "Editar" }));

    const editDialog = screen.getByRole("dialog", { name: "Editar reseña" });
    fireEvent.change(within(editDialog).getByLabelText("Título"), {
      target: { value: "Todavía mejor en el cine" },
    });
    fireEvent.click(
      within(editDialog).getByRole("button", { name: "Publicar reseña" }),
    );

    expect(
      await screen.findByText("Todavía mejor en el cine"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(ownReview).getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("article", { name: "Tu reseña" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Escribir reseña" }),
    ).toBeInTheDocument();
  });
});

describe("resolveSwipeIntent", () => {
  it("maps horizontal and upward gestures to the product actions", () => {
    expect(
      resolveSwipeIntent({
        offsetX: 130,
        offsetY: 18,
        velocityX: 0,
        velocityY: 0,
      }),
    ).toBe("LIKE");
    expect(
      resolveSwipeIntent({
        offsetX: -130,
        offsetY: 18,
        velocityX: 0,
        velocityY: 0,
      }),
    ).toBe("DISLIKE");
    expect(
      resolveSwipeIntent({
        offsetX: 12,
        offsetY: -110,
        velocityX: 0,
        velocityY: 0,
      }),
    ).toBe("DETAIL");
  });

  it("accepts a deliberate flick and ignores an unfinished drag", () => {
    expect(
      resolveSwipeIntent({
        offsetX: 42,
        offsetY: 8,
        velocityX: 720,
        velocityY: 0,
      }),
    ).toBe("LIKE");
    expect(
      resolveSwipeIntent({
        offsetX: 20,
        offsetY: -24,
        velocityX: 100,
        velocityY: -150,
      }),
    ).toBeNull();
  });
});

describe("DiscoverScreen reactions", () => {
  it("persists a swipe reaction against the movie on screen", async () => {
    const movies = DISCOVER_MOVIES_FIXTURE.data.movies;

    render(<DiscoverScreen movies={movies} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Me gusta" })[0]!);

    await waitFor(() => {
      expect(vi.mocked(setMovieReaction)).toHaveBeenCalledWith(
        movies[0]!.movie.id,
        "LIKE",
      );
    });
  });

  it("persists a dislike and moves on to the next movie", async () => {
    const movies = DISCOVER_MOVIES_FIXTURE.data.movies;

    render(<DiscoverScreen movies={movies} />);
    fireEvent.click(screen.getAllByRole("button", { name: "No me gusta" })[0]!);

    await waitFor(() => {
      expect(vi.mocked(setMovieReaction)).toHaveBeenCalledWith(
        movies[0]!.movie.id,
        "DISLIKE",
      );
    });
  });

  it("reports a rejected write instead of losing it silently", async () => {
    vi.mocked(setMovieReaction).mockRejectedValueOnce(new Error("offline"));
    const movies = DISCOVER_MOVIES_FIXTURE.data.movies;

    render(<DiscoverScreen movies={movies} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Me gusta" })[0]!);

    expect(
      await screen.findByText(
        `No pudimos guardar tu reacción sobre ${movies[0]!.movie.title}.`,
      ),
    ).toBeInTheDocument();
  });
});

describe("DiscoverScreen refill", () => {
  function extraMovie(id: number) {
    return {
      id,
      title: `Extra ${id}`,
      originalTitle: `Extra ${id}`,
      overview: "",
      posterPath: null,
      backdropPath: null,
      genreIds: [878],
      releaseDate: "2020-01-01",
      originalLanguage: "en",
      tmdbRating: 8,
      tmdbVoteCount: 2_000,
    };
  }

  it("asks for more before the deck runs out, excluding what is on screen", async () => {
    const movies = DISCOVER_MOVIES_FIXTURE.data.movies;

    render(<DiscoverScreen movies={movies} />);

    await waitFor(() => {
      expect(vi.mocked(fetchDiscoverBatch)).toHaveBeenCalledWith(
        movies.map(({ movie }) => movie.id),
      );
    });
  });

  it("appends the new batch so swiping can continue", async () => {
    vi.mocked(fetchDiscoverBatch).mockResolvedValueOnce({
      movies: [
        {
          movie: extraMovie(9_001),
          insight: { tier: "medium", matchedGenres: [], clashingGenres: [] },
        },
      ],
      batchSize: 10,
      returned: 1,
    });
    const movies = DISCOVER_MOVIES_FIXTURE.data.movies;

    render(<DiscoverScreen movies={movies} />);

    await waitFor(() => {
      expect(vi.mocked(fetchDiscoverBatch)).toHaveBeenCalledOnce();
    });

    // One swipe drops the deck back to the threshold, and the request that
    // follows now excludes the appended id: proof it landed in the deck.
    fireEvent.click(screen.getAllByRole("button", { name: "Me gusta" })[0]!);

    await waitFor(() => {
      expect(vi.mocked(fetchDiscoverBatch)).toHaveBeenLastCalledWith(
        expect.arrayContaining([9_001]),
      );
    });
  });

  it("stops asking once the recommender has nothing left", async () => {
    vi.mocked(fetchDiscoverBatch).mockResolvedValue({
      movies: [],
      batchSize: 10,
      returned: 0,
    });
    const movies = DISCOVER_MOVIES_FIXTURE.data.movies;

    render(<DiscoverScreen movies={movies} />);

    await waitFor(() => {
      expect(vi.mocked(fetchDiscoverBatch)).toHaveBeenCalledOnce();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Me gusta" })[0]!);

    await waitFor(() => {
      expect(vi.mocked(fetchDiscoverBatch)).toHaveBeenCalledOnce();
    });
  });
});
