/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";

import { MovieAssistantScreen } from "./movie-assistant-screen";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SUGGESTED_PROMPTS = [
  "Algo para reírme",
  "Ciencia ficción corta",
  "Algo parecido a Dune",
  "Una película para ver en pareja",
  "Algo intenso para esta noche",
  "Una película poco conocida",
] as const;

describe("MovieAssistantScreen", () => {
  it("renders the cinematic assistant initial state", () => {
    render(
      <MovieAssistantScreen
        recommendations={DISCOVER_MOVIES_FIXTURE.data.movies.slice(1, 4)}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Asistente de películas",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "¿Qué querés ver hoy?" }),
    ).toBeInTheDocument();
    SUGGESTED_PROMPTS.forEach((prompt) => {
      expect(screen.getByRole("button", { name: prompt })).toBeInTheDocument();
    });
    expect(
      screen.getByRole("textbox", { name: "Pedime una película" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar consulta" }),
    ).toBeDisabled();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("keeps desktop content in one compact centered column", () => {
    render(
      <MovieAssistantScreen
        recommendations={DISCOVER_MOVIES_FIXTURE.data.movies.slice(1, 4)}
      />,
    );

    const headerContent = screen.getByRole("banner").firstElementChild;
    expect(headerContent).toHaveClass("mx-auto", "w-full", "max-w-5xl");

    const promptSection = screen.getByRole("region", {
      name: "¿Qué querés ver hoy?",
    });
    expect(promptSection.parentElement).toHaveClass(
      "mx-auto",
      "w-full",
      "max-w-5xl",
    );

    const suggestions = screen.getByRole("group", {
      name: "Consultas sugeridas",
    });
    expect(suggestions).toHaveClass("flex", "flex-wrap");
    SUGGESTED_PROMPTS.forEach((prompt) => {
      expect(screen.getByRole("button", { name: prompt })).toHaveClass(
        "w-auto",
      );
    });

    expect(
      screen.getByRole("form", { name: "Consultar al asistente" }),
    ).toHaveClass("mx-auto", "w-full", "max-w-5xl");
  });

  it("turns a suggested prompt into a conversation with real movie cards", () => {
    vi.useFakeTimers();
    render(
      <MovieAssistantScreen
        recommendations={DISCOVER_MOVIES_FIXTURE.data.movies.slice(1, 4)}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Algo parecido a Dune" }),
    );

    expect(screen.getByText("Algo parecido a Dune")).toBeInTheDocument();
    const conversation = screen.getByRole("region", { name: "Conversación" });
    expect(
      within(conversation).getByRole("img", { name: "Buti hablando" }),
    ).toHaveAttribute("data-activity", "talking");
    expect(within(conversation).getByRole("status")).toHaveTextContent(
      "Buti está pensando",
    );
    expect(
      within(conversation).queryByText(
        /Tomé tu pedido y lo crucé con tus gustos/i,
      ),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(
      screen.getByText(/Tomé tu pedido y lo crucé con tus gustos/i),
    ).toBeInTheDocument();
    expect(
      within(conversation).getByRole("img", {
        name: "Buti feliz, match alto",
      }),
    ).toHaveAttribute("data-activity", "jumping");
    const recommendationList = screen.getByRole("list", {
      name: "Recomendaciones",
    });
    expect(recommendationList).toHaveClass("grid-cols-2", "sm:grid-cols-3");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(
      screen.getByRole("img", { name: "Póster de La llegada" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Blade Runner 2049")).toBeInTheDocument();
  });

  it("submits a custom request and opens a recommendation in Movie Detail", () => {
    vi.useFakeTimers();
    render(
      <MovieAssistantScreen
        recommendations={DISCOVER_MOVIES_FIXTURE.data.movies.slice(1, 4)}
      />,
    );

    const input = screen.getByRole("textbox", {
      name: "Pedime una película",
    });
    fireEvent.change(input, {
      target: {
        value: "Quiero algo parecido a Dune pero de menos de dos horas.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar consulta" }));

    expect(input).toHaveValue("");
    expect(
      screen.getByText(
        "Quiero algo parecido a Dune pero de menos de dos horas.",
      ),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    const recommendation = screen.getByRole("article", {
      name: "Recomendación: La llegada",
    });
    fireEvent.click(
      within(recommendation).getByRole("button", {
        name: "Ver detalle de La llegada",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Detalle de La llegada" }),
    ).toBeInTheDocument();
  });
});
