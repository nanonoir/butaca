import { describe, expect, it } from "vitest";

import type { MovieSummary } from "@/contracts";

import {
  toChatTurns,
  toContractMessages,
  type ChatUiMessage,
} from "./chat-turns";

function createMovie(id: number, title: string): MovieSummary {
  return {
    id,
    title,
    originalTitle: title,
    overview: "Sinopsis",
    posterPath: "/poster.jpg",
    backdropPath: null,
    genreIds: [878],
    releaseDate: "2020-01-01",
    originalLanguage: "en",
    tmdbRating: 8,
    tmdbVoteCount: 2_000,
  };
}

function userMessage(id: string, text: string): ChatUiMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(id: string, parts: ChatUiMessage["parts"]) {
  return { id, role: "assistant" as const, parts };
}

describe("toChatTurns", () => {
  it("pairs each user message with the reply that follows it", () => {
    const turns = toChatTurns([
      userMessage("u1", "Hola"),
      assistantMessage("a1", [{ type: "text", text: "¡Buenas!" }]),
      userMessage("u2", "Otra"),
      assistantMessage("a2", [{ type: "text", text: "Va otra" }]),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0]?.user.content).toBe("Hola");
    expect(turns[0]?.assistant?.content).toBe("¡Buenas!");
    expect(turns[1]?.assistant?.content).toBe("Va otra");
  });

  it("joins the streamed text chunks of one reply", () => {
    const turns = toChatTurns([
      userMessage("u1", "Hola"),
      assistantMessage("a1", [
        { type: "text", text: "Te reco" },
        { type: "text", text: "miendo dos" },
      ]),
    ]);

    expect(turns[0]?.assistant?.content).toBe("Te recomiendo dos");
  });

  it("takes the movies from the tool output, not from the prose", () => {
    const movies = [createMovie(157_336, "Interstellar")];
    const turns = toChatTurns([
      userMessage("u1", "Recomendame"),
      assistantMessage("a1", [
        {
          type: "tool-recommendMovies",
          state: "output-available",
          output: { movies },
        },
        { type: "text", text: "Mirá Interstellar" },
      ]),
    ]);

    expect(turns[0]?.movies).toEqual(movies);
  });

  it("ignores a tool call whose output has not arrived", () => {
    const turns = toChatTurns([
      userMessage("u1", "Recomendame"),
      assistantMessage("a1", [
        { type: "tool-recommendMovies", state: "input-available" },
      ]),
    ]);

    expect(turns[0]?.movies).toEqual([]);
    expect(turns[0]?.assistant).toBeUndefined();
  });

  it("drops a tool output that does not match the movie contract", () => {
    const turns = toChatTurns([
      userMessage("u1", "Recomendame"),
      assistantMessage("a1", [
        {
          type: "tool-recommendMovies",
          state: "output-available",
          output: { movies: [{ id: "no-es-un-id" }] },
        },
      ]),
    ]);

    expect(turns[0]?.movies).toEqual([]);
  });

  it("leaves the turn pending while only a tool call has streamed", () => {
    const turns = toChatTurns([
      userMessage("u1", "Recomendame"),
      assistantMessage("a1", [
        {
          type: "tool-recommendMovies",
          state: "output-available",
          output: { movies: [createMovie(1, "Dune")] },
        },
      ]),
    ]);

    expect(turns[0]?.assistant).toBeUndefined();
    expect(turns[0]?.movies).toHaveLength(1);
  });

  it("ignores an assistant message with no user turn before it", () => {
    expect(
      toChatTurns([assistantMessage("a1", [{ type: "text", text: "hola" }])]),
    ).toEqual([]);
  });

  it("returns nothing for an empty conversation", () => {
    expect(toChatTurns([])).toEqual([]);
  });
});

describe("toContractMessages", () => {
  it("flattens parts into the request contract shape", () => {
    expect(
      toContractMessages([
        userMessage("u1", "Hola"),
        assistantMessage("a1", [{ type: "text", text: "¡Buenas!" }]),
      ]),
    ).toEqual([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "¡Buenas!" },
    ]);
  });

  it("leaves tool parts behind because the server runs the tool itself", () => {
    expect(
      toContractMessages([
        userMessage("u1", "Recomendame"),
        assistantMessage("a1", [
          {
            type: "tool-recommendMovies",
            state: "output-available",
            output: { movies: [createMovie(1, "Dune")] },
          },
          { type: "text", text: "Mirá Dune" },
        ]),
      ]),
    ).toEqual([
      { role: "user", content: "Recomendame" },
      { role: "assistant", content: "Mirá Dune" },
    ]);
  });

  it("drops a message with no text so the contract minimum holds", () => {
    expect(
      toContractMessages([
        userMessage("u1", "Hola"),
        assistantMessage("a1", [
          { type: "tool-recommendMovies", state: "input-available" },
        ]),
      ]),
    ).toEqual([{ role: "user", content: "Hola" }]);
  });

  it("keeps only the most recent twenty messages", () => {
    const messages = Array.from({ length: 26 }, (_unused, index) =>
      userMessage(`u${index}`, `mensaje ${index}`),
    );
    const result = toContractMessages(messages);

    expect(result).toHaveLength(20);
    expect(result.at(-1)?.content).toBe("mensaje 25");
  });
});
