/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISCOVER_MOVIES_FIXTURE } from "@/fixtures/discover-movies";

import { fetchMovieDetail } from "@/features/movie-detail/movie-detail-client";
import { fetchMovieReviews } from "@/features/reviews/review-client";

import { MovieAssistantScreen } from "./movie-assistant-screen";

/** The screen now talks to the assistant through useChat, so the conversation
 * is driven from here instead of a simulated reply timer. */
const { chat } = vi.hoisted(() => ({
  chat: {
    messages: [] as unknown[],
    sendMessage: vi.fn(),
    error: undefined as Error | undefined,
  },
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));

/** The overlay loads the detail from the API, like every other screen that
 * opens it. */
vi.mock("@/features/movie-detail/movie-detail-client", () => ({
  fetchMovieDetail: vi.fn(),
}));

vi.mock("@/features/reviews/review-client", () => ({
  fetchMovieReviews: vi.fn(),
  upsertMovieReview: vi.fn().mockResolvedValue(null),
  deleteMovieReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/interactions/interaction-client", () => ({
  setMovieReaction: vi.fn().mockResolvedValue(undefined),
  removeMovieReaction: vi.fn().mockResolvedValue(undefined),
  setMovieWatched: vi.fn().mockResolvedValue(undefined),
}));

const MOVIES = DISCOVER_MOVIES_FIXTURE.data.movies.slice(0, 3);

function userMessage(id: string, text: string) {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(id: string, text: string, withMovies = true) {
  return {
    id,
    role: "assistant",
    parts: [
      ...(withMovies
        ? [
            {
              type: "tool-recommendMovies",
              state: "output-available",
              output: { movies: MOVIES },
            },
          ]
        : []),
      { type: "text", text },
    ],
  };
}

function stubDetail(movie: (typeof MOVIES)[number]) {
  vi.mocked(fetchMovieDetail).mockResolvedValue({
    movie: {
      ...movie,
      tagline: null,
      runtime: 120,
      genres: [{ id: 878, name: "Ciencia ficción" }],
      director: null,
      cast: [],
      keywords: [],
      trailer: null,
    },
    viewerState: { reaction: null, watchedAt: null },
    reviewSummary: {
      recommended: 0,
      notWorthIt: 0,
      total: 0,
      recommendationRate: null,
    },
    myReview: null,
  } as never);
  vi.mocked(fetchMovieReviews).mockResolvedValue({
    data: [],
    meta: {
      page: 1,
      pageSize: 20,
      totalPages: 0,
      totalResults: 0,
      hasNextPage: false,
    },
  } as never);
}

beforeEach(() => {
  chat.messages = [];
  chat.error = undefined;
  vi.clearAllMocks();
});

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
    render(<MovieAssistantScreen />);

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
    render(<MovieAssistantScreen />);

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

  it("sends a suggested prompt to the assistant", () => {
    render(<MovieAssistantScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Algo parecido a Dune" }),
    );

    expect(chat.sendMessage).toHaveBeenCalledWith({
      text: "Algo parecido a Dune",
    });
  });

  it("shows Buti thinking until the reply text arrives", () => {
    chat.messages = [userMessage("u1", "Algo parecido a Dune")];
    render(<MovieAssistantScreen />);

    const conversation = screen.getByRole("region", { name: "Conversación" });

    expect(screen.getByText("Algo parecido a Dune")).toBeInTheDocument();
    expect(
      within(conversation).getByRole("img", { name: "Buti hablando" }),
    ).toHaveAttribute("data-activity", "talking");
    expect(within(conversation).getByRole("status")).toHaveTextContent(
      "Buti está pensando",
    );
  });

  it("renders the movies the tool returned, not titles from the prose", () => {
    chat.messages = [
      userMessage("u1", "Algo parecido a Dune"),
      assistantMessage("a1", "Te dejo estas tres."),
    ];
    render(<MovieAssistantScreen />);

    const conversation = screen.getByRole("region", { name: "Conversación" });

    expect(screen.getByText("Te dejo estas tres.")).toBeInTheDocument();
    expect(
      within(conversation).getByRole("img", { name: "Buti feliz, match alto" }),
    ).toHaveAttribute("data-activity", "jumping");
    expect(screen.getAllByRole("article")).toHaveLength(MOVIES.length);
    expect(
      screen.getByRole("img", { name: `Póster de ${MOVIES[0]!.title}` }),
    ).toBeInTheDocument();
  });

  it("omits the recommendation list when the reply carries no movies", () => {
    chat.messages = [
      userMessage("u1", "Hola"),
      assistantMessage("a1", "¡Buenas!", false),
    ];
    render(<MovieAssistantScreen />);

    expect(screen.getByText("¡Buenas!")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Recomendaciones" }),
    ).not.toBeInTheDocument();
  });

  it("reports a failed reply instead of leaving the turn silent", () => {
    chat.messages = [userMessage("u1", "Algo parecido a Dune")];
    chat.error = new Error("provider down");
    render(<MovieAssistantScreen />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Buti no pudo responder",
    );
  });

  it("submits a custom request and opens a recommendation in Movie Detail", async () => {
    chat.messages = [
      userMessage("u1", "Quiero algo parecido a Dune."),
      assistantMessage("a1", "Mirá estas."),
    ];
    stubDetail(MOVIES[0]!);
    render(<MovieAssistantScreen />);

    const input = screen.getByRole("textbox", { name: "Pedime una película" });
    fireEvent.change(input, { target: { value: "Otra cosa" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar consulta" }));

    expect(chat.sendMessage).toHaveBeenCalledWith({ text: "Otra cosa" });
    expect(input).toHaveValue("");

    const recommendation = screen.getByRole("article", {
      name: `Recomendación: ${MOVIES[0]!.title}`,
    });
    fireEvent.click(
      within(recommendation).getByRole("button", {
        name: `Ver detalle de ${MOVIES[0]!.title}`,
      }),
    );

    expect(
      await screen.findByRole("dialog", {
        name: `Detalle de ${MOVIES[0]!.title}`,
      }),
    ).toBeInTheDocument();
    expect(vi.mocked(fetchMovieDetail)).toHaveBeenCalledWith(MOVIES[0]!.id);
  });

  it("keeps the beginning of the latest Buti response in view", () => {
    chat.messages = [userMessage("u1", "Algo parecido a Dune")];
    const { rerender } = render(<MovieAssistantScreen />);

    const conversation = screen.getByTestId(
      "movie-assistant-conversation-scroll",
    );
    let scrollTop = 80;
    let latestButiOffset = 520;
    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      scrollTop = Number(top);
    });

    const rectAt = (top: number) =>
      ({
        bottom: top,
        height: 0,
        left: 0,
        right: 0,
        toJSON: () => ({}),
        top,
        width: 0,
        x: 0,
        y: top,
      }) as DOMRect;

    Object.defineProperties(conversation, {
      scrollTop: { configurable: true, get: () => scrollTop },
      scrollTo: { configurable: true, value: scrollTo },
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this === conversation) {
          return rectAt(100);
        }

        if (this.dataset.testid === "latest-buti-message") {
          return rectAt(latestButiOffset);
        }

        return rectAt(0);
      },
    );

    // The reply arrives: the scroll lands on the top of Buti's message.
    chat.messages = [
      userMessage("u1", "Algo parecido a Dune"),
      assistantMessage("a1", "Te dejo estas tres."),
    ];
    rerender(<MovieAssistantScreen />);

    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 476,
    });

    // A second turn scrolls again, to the new message rather than the old one.
    latestButiOffset = 1180;
    chat.messages = [
      ...(chat.messages as unknown[]),
      userMessage("u2", "Algo más corto"),
      assistantMessage("a2", "Estas son más cortas."),
    ];
    rerender(<MovieAssistantScreen />);

    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 1532,
    });
  });
});
