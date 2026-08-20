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

import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";

import { DiscoverScreen } from "./discover-screen";
import { resolveSwipeIntent } from "./resolve-swipe-intent";

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
