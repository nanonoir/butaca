import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { RecommendationFiltersSchema, type MovieSummary } from "@/contracts";

import type { RecommendationService } from "../recommendations/recommendation-service";

/** How many movies a single tool call may hand back to the model. The chat
 * shows a compact row, and a longer list only burns context. */
export const CHAT_RECOMMENDATION_LIMIT = 5;

type RecommendationPort = Pick<RecommendationService, "getDiscoverBatch">;

/** The shape the model fills in. It is deliberately narrower than the full
 * filter contract: the model picks a mood, not runtimes or vote counts. */
const RecommendMoviesInputSchema = z.object({
  genreIds: z
    .array(z.number().int().positive())
    .max(3)
    .optional()
    .describe(
      "TMDB genre ids to steer the batch, when the viewer named a genre.",
    ),
  originalLanguage: z
    .string()
    .min(2)
    .max(5)
    .optional()
    .describe("ISO 639-1 code, only when the viewer asked for a language."),
});

export type ChatToolMovies = { movies: MovieSummary[] };

/** Bound to the viewer resolved from the session, never to an id the model or
 * the request could supply. The model asks for recommendations; it cannot ask
 * for someone else's. */
export function createChatTools(
  recommendations: RecommendationPort,
  userId: string,
) {
  return {
    recommendMovies: tool({
      description:
        "Recommends movies for the current viewer using their taste profile. " +
        "Always call this before naming any movie; never invent titles.",
      inputSchema: RecommendMoviesInputSchema,
      execute: async (input) => {
        const filters = RecommendationFiltersSchema.parse({
          ...(input.genreIds?.length ? { genreIds: input.genreIds } : {}),
          ...(input.originalLanguage
            ? { originalLanguage: input.originalLanguage }
            : {}),
        });
        const batch = await recommendations.getDiscoverBatch(userId, {
          filters,
          limit: CHAT_RECOMMENDATION_LIMIT,
        });

        // The whole summary travels: the model talks about the movies and the
        // screen reads the same tool output from the stream to render them, so
        // there is one payload rather than a side channel that a streamed
        // response could never deliver.
        return { movies: batch.movies } satisfies ChatToolMovies;
      },
    }),
  };
}
