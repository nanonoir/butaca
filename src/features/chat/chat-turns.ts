import {
  ChatMovieSchema,
  type ChatMessage,
  type ChatMovie,
} from "@/contracts";

/** Shape of a message part as it reaches the screen. Kept structural rather
 * than importing the SDK union, so the conversion stays testable without a
 * chat runtime. */
type MessagePart = {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
};

export type ChatUiMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  parts: MessagePart[];
};

export type ChatTurn = {
  id: string;
  user: { id: string; role: "user"; content: string };
  assistant?: { id: string; role: "assistant"; content: string };
  movies: ChatMovie[];
};

const RECOMMEND_TOOL_PART = "tool-recommendMovies";

function readText(parts: MessagePart[]): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
}

/** Movies come from the tool output rather than from the prose, so what the
 * screen renders is exactly what the recommender returned even if the model
 * paraphrases the titles. */
function readMovies(parts: MessagePart[]): ChatMovie[] {
  return parts
    .filter(
      (part) =>
        part.type === RECOMMEND_TOOL_PART && part.state === "output-available",
    )
    .flatMap((part) => {
      const output = part.output as { movies?: unknown } | undefined;
      const parsed = ChatMovieSchema.array().safeParse(output?.movies);

      return parsed.success ? parsed.data : [];
    });
}

/** Pairs every user message with the assistant reply that follows it. The
 * screen renders turns, while the SDK keeps a flat list. */
export function toChatTurns(messages: ChatUiMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        id: message.id,
        user: {
          id: message.id,
          role: "user",
          content: readText(message.parts),
        },
        movies: [],
      });
      continue;
    }

    if (message.role !== "assistant") {
      continue;
    }

    const turn = turns[turns.length - 1];

    if (!turn) {
      continue;
    }

    const content = readText(message.parts);

    turn.movies = [...turn.movies, ...readMovies(message.parts)];

    // An assistant message that only carries a tool call has no prose yet;
    // leaving `assistant` unset keeps the turn in its pending state.
    if (content) {
      turn.assistant = { id: message.id, role: "assistant", content };
    }
  }

  return turns;
}

/** The contract caps a conversation at twenty messages, so only the most recent
 * ones travel. The newest is always the user's, which is what the request
 * schema requires. */
const MAX_CONTRACT_MESSAGES = 20;
const MAX_CONTRACT_CONTENT = 4_000;

/** The SDK keeps messages as parts; the request contract expects plain roles
 * and content. Tool parts stay behind: the server re-runs the tool itself. */
export function toContractMessages(messages: ChatUiMessage[]): ChatMessage[] {
  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      role: message.role as ChatMessage["role"],
      content: readText(message.parts).slice(0, MAX_CONTRACT_CONTENT),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-MAX_CONTRACT_MESSAGES);
}
