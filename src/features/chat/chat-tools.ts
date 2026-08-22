import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { RecommendationFiltersSchema, type MovieSummary } from "@/contracts";

import type { RecommendationService } from "../recommendations/recommendation-service";

/** How many movies a single tool call may hand back to the model. The chat
 * shows a compact row, and a longer list only burns context. */
export const CHAT_RECOMMENDATION_LIMIT = 5;

/** TMDB's own labels for what a person is known for. They decide which of the
 * people sharing a name is the one being asked about. */
const ACTING_DEPARTMENT = "Acting";
const DIRECTING_DEPARTMENT = "Directing";

/** A rating filter with no floor on votes hands back whatever obscure title
 * three people rated a ten. Well reviewed has to mean widely reviewed. */
const WELL_REVIEWED_MIN_VOTES = 500;

type RecommendationPort = Pick<RecommendationService, "getDiscoverBatch">;

type CatalogPort = {
  findPersonId(input: {
    name: string;
    department?: string;
  }): Promise<number | null>;
  searchMovies(input: { query: string; page: number }): Promise<{
    data: MovieSummary[];
  }>;
};

/** The shape the model fills in. Names rather than ids: a model cannot know
 * that Leonardo DiCaprio is 6193, and making it find out first would cost an
 * extra step of every conversation -- each step is a request against a daily
 * budget the assistant already has to ration. It says the name, this resolves
 * it, one call. */
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
  actorName: z
    .string()
    .min(2)
    .max(100)
    .optional()
    .describe(
      "Full name of an actor the viewer asked for, e.g. 'Leonardo DiCaprio'.",
    ),
  directorName: z
    .string()
    .min(2)
    .max(100)
    .optional()
    .describe(
      "Full name of a director the viewer asked for, e.g. 'Steven Spielberg'.",
    ),
  similarToTitle: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe(
      "Title of a movie the viewer wants something like, e.g. 'Interstellar'.",
    ),
  wellReviewed: z
    .boolean()
    .optional()
    .describe(
      "True only when the viewer asked for highly rated or acclaimed movies.",
    ),
});

export type ChatToolMovies = { movies: MovieSummary[] };

/** Every name the model supplied, resolved in one round of lookups. A name that
 * matches nothing is dropped rather than failing the call: a viewer who
 * misspells an actor should still get recommendations, not an error. */
async function resolveFilters(
  catalog: CatalogPort,
  input: z.infer<typeof RecommendMoviesInputSchema>,
) {
  const [castId, crewId, similarMovies] = await Promise.all([
    input.actorName
      ? catalog.findPersonId({
          name: input.actorName,
          department: ACTING_DEPARTMENT,
        })
      : null,
    input.directorName
      ? catalog.findPersonId({
          name: input.directorName,
          department: DIRECTING_DEPARTMENT,
        })
      : null,
    input.similarToTitle
      ? catalog.searchMovies({ query: input.similarToTitle, page: 1 })
      : null,
  ]);

  return RecommendationFiltersSchema.parse({
    ...(input.genreIds?.length ? { genreIds: input.genreIds } : {}),
    ...(input.originalLanguage
      ? { originalLanguage: input.originalLanguage }
      : {}),
    ...(castId !== null ? { castIds: [castId] } : {}),
    ...(crewId !== null ? { crewIds: [crewId] } : {}),
    ...(similarMovies?.data[0]
      ? { similarToMovieId: similarMovies.data[0].id }
      : {}),
    ...(input.wellReviewed
      ? { minTmdbRating: 7.5, minTmdbVoteCount: WELL_REVIEWED_MIN_VOTES }
      : {}),
  });
}

/** Bound to the viewer resolved from the session, never to an id the model or
 * the request could supply. The model asks for recommendations; it cannot ask
 * for someone else's. */
export function createChatTools(
  recommendations: RecommendationPort,
  catalog: CatalogPort,
  userId: string,
) {
  return {
    recommendMovies: tool({
      description:
        "Recommends movies for the current viewer using their taste profile. " +
        "Accepts an actor, a director, a movie to resemble and a request for " +
        "well reviewed titles, on top of genre and language. " +
        "Always call this before naming any movie; never invent titles.",
      inputSchema: RecommendMoviesInputSchema,
      execute: async (input) => {
        const filters = await resolveFilters(catalog, input);
        const batch = await recommendations.getDiscoverBatch(userId, {
          filters,
          limit: CHAT_RECOMMENDATION_LIMIT,
        });

        // The whole summary travels: the model talks about the movies and the
        // screen reads the same tool output from the stream to render them, so
        // there is one payload rather than a side channel that a streamed
        // response could never deliver.
        // The batch pairs each movie with why it was picked; the assistant
        // only needs the movie.
        return {
          movies: batch.movies.map(({ movie }) => movie),
        } satisfies ChatToolMovies;
      },
    }),
  };
}
