import "server-only";

import { tool } from "ai";
import { z } from "zod";

import {
  ChatMovieSchema,
  RecommendationFiltersSchema,
  type RecommendationFilters,
  type ChatMovie,
  type MovieSummary,
} from "@/contracts";

import type { RecommendationService } from "../recommendations/recommendation-service";

/** A ceiling, not a quota. The chat shows a compact row and a longer list only
 * burns context, but a question with one honest answer gets one movie: naming
 * both an actor and a director, or a decade on top of a director, narrows the
 * pool to what actually exists rather than padding it back up to five. */
export const CHAT_RECOMMENDATION_LIMIT = 6;

/** TMDB's own labels for what a person is known for. They decide which of the
 * people sharing a name is the one being asked about. */
const ACTING_DEPARTMENT = "Acting";
const DIRECTING_DEPARTMENT = "Directing";

/** A rating filter with no floor on votes hands back whatever obscure title
 * three people rated a ten. Well reviewed has to mean widely reviewed. */
const WELL_REVIEWED_MIN_VOTES = 500;

type RecommendationPort = Pick<RecommendationService, "getDiscoverBatch">;

type CatalogPort = {
  findKeywordId(term: string): Promise<number | null>;
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
  themes: z
    .array(z.string().min(2).max(40))
    .max(3)
    .optional()
    .describe(
      "What the viewer asked the film to be ABOUT or to feel like, as one to " +
        "three single English words, most specific first. TMDB's tags are " +
        "English whatever language the conversation is in: 'algo triste' is " +
        "['sadness', 'grief'], not ['triste']. Use this for moods, subjects " +
        "and situations -- sadness, revenge, friendship, heist, dystopia, " +
        "coming of age. Not for genres, which have their own field. Fewer and " +
        "more precise beats more: every word narrows the answer.",
    ),
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
  actorNames: z
    .array(z.string().min(2).max(100))
    .max(3)
    .optional()
    .describe(
      "Full names of actors the viewer asked for. Several names means movies " +
        "with all of them together, e.g. ['Leonardo DiCaprio', 'Brad Pitt'].",
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
  maxRuntimeMinutes: z
    .number()
    .int()
    .min(20)
    .max(400)
    .optional()
    .describe(
      "Upper bound in minutes when the viewer asked for something short.",
    ),
  minRuntimeMinutes: z
    .number()
    .int()
    .min(20)
    .max(400)
    .optional()
    .describe("Lower bound in minutes when the viewer asked for something long."),
  fromYear: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .describe(
      "Earliest release year. For a decade like the nineties, send 1990 here and 1999 in toYear.",
    ),
  toYear: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .describe("Latest release year."),
})
  /** Asked for in the description first, and ignored every time. A tool
   * description is a request the model may decline; the schema is the shape of
   * the call, and a call that does not fit never happens.
   *
   * The genres matter because TMDB has no usable tag for a good half of how
   * people ask. "chill" and "relaxing" name tags no film carries, and "joy"
   * holds three -- the genres are what answers when the tag cannot. */
  .refine(
    (input) => !input.themes?.length || Boolean(input.genreIds?.length),
    {
      path: ["genreIds"],
      error:
        "Send genreIds alongside themes: the nearest genres to the same " +
        "request. Many moods have no usable tag in TMDB, and the genres are " +
        "what answers when the tag comes back empty.",
    },
  );

export type ChatToolMovies = { movies: ChatMovie[] };

/** Every name the model supplied, resolved in one round of lookups. A name that
 * matches nothing is dropped rather than failing the call: a viewer who
 * misspells an actor should still get recommendations, not an error. */
/** A word that names nothing in TMDB drops out rather than emptying the
 * answer: "sadness" and "grief" both resolving is the good case, and only one
 * of them resolving still beats asking the profile what it always asks. */
async function resolveKeywordIds(
  catalog: CatalogPort,
  themes: string[] | undefined,
): Promise<number[]> {
  if (!themes?.length) {
    return [];
  }

  const resolved = await Promise.all(
    themes.map((theme) => catalog.findKeywordId(theme)),
  );

  return resolved.filter((id): id is number => id !== null);
}

async function resolveFilters(
  catalog: CatalogPort,
  input: z.infer<typeof RecommendMoviesInputSchema>,
) {
  const [keywordIds, castIds, crewId, similarMovies] = await Promise.all([
    resolveKeywordIds(catalog, input.themes),
    Promise.all(
      (input.actorNames ?? []).map((name) =>
        catalog.findPersonId({ name, department: ACTING_DEPARTMENT }),
      ),
    ),
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
    // Matched on all of them. Two words somebody chose are a description; the
    // films carrying both are the ones they described.
    ...(keywordIds.length ? { keywordIds, keywordMatch: "all" as const } : {}),
    ...(input.genreIds?.length ? { genreIds: input.genreIds } : {}),
    ...(input.originalLanguage
      ? { originalLanguage: input.originalLanguage }
      : {}),
    ...(castIds.some((id) => id !== null)
      ? { castIds: castIds.filter((id): id is number => id !== null) }
      : {}),
    ...(crewId !== null ? { crewIds: [crewId] } : {}),
    ...(similarMovies?.data[0]
      ? { similarToMovieId: similarMovies.data[0].id }
      : {}),
    ...(input.wellReviewed
      ? { minTmdbRating: 7.5, minTmdbVoteCount: WELL_REVIEWED_MIN_VOTES }
      : {}),
    ...(input.maxRuntimeMinutes
      ? { maxRuntime: input.maxRuntimeMinutes }
      : {}),
    ...(input.minRuntimeMinutes
      ? { minRuntime: input.minRuntimeMinutes }
      : {}),
    ...(input.fromYear ? { minReleaseYear: input.fromYear } : {}),
    ...(input.toYear ? { maxReleaseYear: input.toYear } : {}),
  });
}

/** Bound to the viewer resolved from the session, never to an id the model or
 * the request could supply. The model asks for recommendations; it cannot ask
 * for someone else's. */
/** What the model asked for, what it resolved to, and how much came back.
 *
 * Everything about how this behaves is decided by the model: whether it turns
 * "algo alegre" into a tag at all, which one, and how many. None of that is
 * visible from the conversation -- an empty answer looks the same whether the
 * model sent nothing or sent a word the catalogue has never heard of -- and
 * tuning it by looking at the replies is guessing.
 *
 * Off unless asked for. `next start` runs a production build whatever the
 * environment says, so keying this on NODE_ENV would have silenced it exactly
 * where it is needed -- and a line about what somebody asked for has no
 * business appearing in a log by default. Set BUTI_TRACE=1 to watch. */
function traceRequest(
  input: z.infer<typeof RecommendMoviesInputSchema>,
  filters: RecommendationFilters,
  returned: number,
): void {
  if (process.env.BUTI_TRACE !== "1") {
    return;
  }

  console.log(
    "[buti]",
    JSON.stringify({
      pidio: {
        themes: input.themes ?? null,
        genreIds: input.genreIds ?? null,
        actorNames: input.actorNames ?? null,
        directorName: input.directorName ?? null,
        similarToTitle: input.similarToTitle ?? null,
        wellReviewed: input.wellReviewed ?? null,
      },
      resolvio: {
        keywordIds: filters.keywordIds ?? null,
        keywordMatch: filters.keywordMatch ?? null,
        genreIds: filters.genreIds ?? null,
        castIds: filters.castIds ?? null,
        crewIds: filters.crewIds ?? null,
        similarToMovieId: filters.similarToMovieId ?? null,
      },
      devolvio: returned,
    }),
  );
}

export function createChatTools(
  recommendations: RecommendationPort,
  catalog: CatalogPort,
  userId: string,
) {
  return {
    recommendMovies: tool({
      description:
        "Recommends movies for the current viewer using their taste profile. " +
        "Accepts an actor, a director, a movie to resemble, a release year " +
        "range, a runtime bound and a request for well reviewed titles, on " +
        "top of genre and language. Combine them freely: two actors means the " +
        "films they appear in together, and an actor with a director means " +
        "the films they made together. " +
        "Always call this before naming any movie; never invent titles.",
      inputSchema: RecommendMoviesInputSchema,
      execute: async (input) => {
        const filters = await resolveFilters(catalog, input);
        const ask = (applied: RecommendationFilters) =>
          recommendations.getDiscoverBatch(userId, {
            filters: applied,
            limit: CHAT_RECOMMENDATION_LIMIT,
            // Somebody asked. Marked here rather than worked out from the
            // filters downstream, because a theme that resolves to nothing
            // leaves a request indistinguishable from a plain batch.
            requested: true,
          });

        let batch = await ask(filters);
        let applied = filters;

        // Two words are a description and the films carrying both are the ones
        // described -- when both are tags the catalogue uses. Some are tiny:
        // "joy" holds three films and "uplifting" two, and asking for both is
        // asking for the overlap of three and two. Rather than answer nothing,
        // the second try asks for either.
        if (batch.movies.length === 0 && (filters.keywordIds?.length ?? 0) > 1) {
          applied = { ...filters, keywordMatch: "any" as const };
          batch = await ask(applied);
        }

        traceRequest(input, applied, batch.movies.length);

        // One payload rather than a side channel: the model talks about these
        // movies and the screen reads the same tool output from the stream to
        // render them, which a streamed response could not deliver twice.
        //
        // Parsed rather than passed through. Everything here is read back by
        // the model as context, and the synopsis TMDB carries is a paragraph
        // written by a stranger -- the schema drops it, and parsing is what
        // makes that true of the bytes and not only of the type.
        return {
          movies: batch.movies.map(({ movie }) => ChatMovieSchema.parse(movie)),
        } satisfies ChatToolMovies;
      },
    }),
  };
}
