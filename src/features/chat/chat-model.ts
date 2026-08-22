import { google } from "@ai-sdk/google";
import {
  APICallError,
  wrapLanguageModel,
  type LanguageModel,
  type LanguageModelMiddleware,
} from "ai";

/** Ordered by how much daily budget each model carries, not by how good it is.
 * A chat turn spends one request per step, so the two Flash Lite models are
 * worth roughly fifty times what the Flash ones are before either is touched.
 *
 * | model                  | requests per day |
 * | ---------------------- | ---------------- |
 * | gemini-3.5-flash-lite  | 500              |
 * | gemini-3.1-flash-lite  | 500              |
 * | gemini-3.6-flash       | 20               |
 * | gemini-3.7-flash       | 20               |
 * | gemini-3-flash         | 20               |
 * | gemini-2.5-flash-lite  | 20               |
 *
 * Every id is pinned rather than an alias like `gemini-flash-latest`: an alias
 * swaps the model underneath, and tool calling is the fragile part here. */
export const CHAT_MODEL_IDS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3-flash",
  "gemini-2.5-flash-lite",
] as const;

/** A quota that ran out, a model buckling under load, a model that no longer
 * exists or a network fault all say something about this model rather than
 * about the request, so another one may well answer.
 *
 * 404 belongs here: Google retires model ids, and this project has already seen
 * one go (`gemini-2.5-flash` stopped being served to new keys). A retirement
 * that took the chat down while five healthy models sat behind it would be the
 * exact fragility this chain exists to remove.
 *
 * A rejected request is deliberately absent: a malformed body or a refused key
 * fails identically on every model here -- they all speak to Google with the
 * same credential -- so walking the chain would turn one wasted call into six.
 * A chain spanning providers would want to reconsider 401. */
const FALL_THROUGH_STATUSES = new Set([404, 408, 429]);

function shouldFallBack(error: unknown): boolean {
  if (!APICallError.isInstance(error)) {
    // A transport fault never reached a model, so the next one deserves a turn.
    return true;
  }

  const { statusCode } = error;

  if (statusCode === undefined) {
    return true;
  }

  return FALL_THROUGH_STATUSES.has(statusCode) || statusCode >= 500;
}

export interface ChatModelAttempt {
  modelId: string;
  error: unknown;
}

export interface ChatModelChain {
  model: LanguageModel;
  /** Filled as the chain is walked, so a caller can log which models were spent
   * before one answered. */
  attempts: ChatModelAttempt[];
}

type StreamCall = Parameters<
  NonNullable<LanguageModelMiddleware["wrapStream"]>
>[0];

/** Presents a list of models as one. The wrapped model is asked first; if it
 * answers, its stream is returned untouched and nothing else is called.
 *
 * The hand-off happens while resolving the request, before any token is
 * produced, so a viewer never sees half an answer from one model finished by
 * another. */
export function createChatModelChain(
  modelIds: readonly string[] = CHAT_MODEL_IDS,
): ChatModelChain {
  const [firstId, ...fallbackIds] = modelIds;

  if (!firstId) {
    throw new Error("A chat model chain needs at least one model");
  }

  const attempts: ChatModelAttempt[] = [];

  const middleware: LanguageModelMiddleware = {
    wrapStream: async ({ doStream, params }: StreamCall) => {
      try {
        return await doStream();
      } catch (error) {
        attempts.push({ modelId: firstId, error });

        if (!shouldFallBack(error)) {
          throw error;
        }
      }

      let lastError: unknown = attempts.at(-1)?.error;

      for (const modelId of fallbackIds) {
        try {
          return await google(modelId).doStream(params);
        } catch (error) {
          attempts.push({ modelId, error });
          lastError = error;

          if (!shouldFallBack(error)) {
            throw error;
          }
        }
      }

      throw lastError;
    },
  };

  return {
    attempts,
    model: wrapLanguageModel({ model: google(firstId), middleware }),
  };
}
