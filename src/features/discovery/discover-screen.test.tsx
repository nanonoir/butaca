/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

  it("opens and closes the current movie detail without leaving Discover", async () => {
    render(<DiscoverScreen movies={MOVIES} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Más información sobre Dune" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Detalle de Dune" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Paul Atreides debe viajar al planeta más peligroso/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
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
