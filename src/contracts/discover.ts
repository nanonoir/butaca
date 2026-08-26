import { z } from "zod";

import {
  TmdbGenreIdSchema,
  TmdbKeywordIdSchema,
  TmdbMovieIdSchema,
  TmdbPersonIdSchema,
  apiDataResponseSchema,
} from "./common";
import { MovieSummarySchema } from "./movies";

/** Size of a Discover deck refill. Declared here so the schema, the recommender
 * and the client cannot drift apart. */
export const DISCOVER_BATCH_SIZE = 10;

/** How well a movie lines up with the viewer's taste, and why. Computed from
 * the same weights that produced the ranking, so the card can explain the
 * order instead of restating the rating. */
export const MatchTierSchema = z.enum(["high", "medium", "low"]);

/** Why this movie is in the deck. The tier says how enthusiastic to be; this
 * says what to point at, which is the difference between "es ciencia ficción"
 * and "sale de Nolan, que venís mirando". */
export const MatchReasonKindSchema = z.enum([
  "genre",
  "keyword",
  "cast",
  "crew",
  "similar",
]);

export const MatchReasonSchema = z.object({
  kind: MatchReasonKindSchema,
  /** A person for cast and crew, a movie title for similar. Absent for the
   * traits that have nothing to name, and for a request the viewer made
   * themselves -- they already know what they asked for. */
  name: z.string().min(1).nullable(),
});

export const MatchInsightSchema = z.object({
  tier: MatchTierSchema,
  matchedGenres: z.array(z.string().min(1)).max(5),
  clashingGenres: z.array(z.string().min(1)).max(5),
  reason: MatchReasonSchema,
});

export const RecommendedMovieSchema = z.object({
  movie: MovieSummarySchema,
  insight: MatchInsightSchema,
});

export const DiscoverResponseSchema = apiDataResponseSchema(
  z.object({
    movies: z.array(RecommendedMovieSchema).max(DISCOVER_BATCH_SIZE),
    batchSize: z.literal(DISCOVER_BATCH_SIZE),
    returned: z.number().int().min(0).max(DISCOVER_BATCH_SIZE),
  }),
);

export const RecommendationFiltersSchema = z
  .object({
    genreIds: z.array(TmdbGenreIdSchema).optional(),
    excludedGenreIds: z.array(TmdbGenreIdSchema).optional(),
    keywordIds: z.array(TmdbKeywordIdSchema).optional(),
    /** How to read the list. A film's own tags are matched on any -- carrying
     * every one of a dozen is nothing at all -- while two or three words
     * somebody asked for are matched on all, which is what makes the answer
     * about what they asked rather than about one word of it. */
    keywordMatch: z.enum(["any", "all"]).optional(),
    castIds: z.array(TmdbPersonIdSchema).optional(),
    crewIds: z.array(TmdbPersonIdSchema).optional(),
    originalLanguage: z.string().min(2).optional(),
    minRuntime: z.number().int().positive().optional(),
    maxRuntime: z.number().int().positive().optional(),
    minTmdbRating: z.number().min(0).max(10).optional(),
    minTmdbVoteCount: z.number().int().min(0).optional(),
    /** Whole years rather than dates: every way a viewer asks for this -- a
     * decade, "after 2010", "something recent" -- is a year, and a month would
     * only be precision nobody supplied. */
    minReleaseYear: z.number().int().min(1874).max(2200).optional(),
    maxReleaseYear: z.number().int().min(1874).max(2200).optional(),
    similarToMovieId: TmdbMovieIdSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minReleaseYear !== undefined &&
      value.maxReleaseYear !== undefined &&
      value.minReleaseYear > value.maxReleaseYear
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["minReleaseYear"],
        message: "minReleaseYear cannot be greater than maxReleaseYear",
      });
    }

    if (
      value.minRuntime !== undefined &&
      value.maxRuntime !== undefined &&
      value.minRuntime > value.maxRuntime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxRuntime"],
        message: "maxRuntime must be greater than or equal to minRuntime",
      });
    }
  });

export const RecommendationRequestSchema = z.object({
  filters: RecommendationFiltersSchema.default({}),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DISCOVER_BATCH_SIZE)
    .default(DISCOVER_BATCH_SIZE),
  excludeMovieIds: z.array(TmdbMovieIdSchema).default([]),
});

export type MatchTier = z.infer<typeof MatchTierSchema>;
export type MatchInsight = z.infer<typeof MatchInsightSchema>;
export type MatchReason = z.infer<typeof MatchReasonSchema>;
export type MatchReasonKind = z.infer<typeof MatchReasonKindSchema>;
export type RecommendedMovie = z.infer<typeof RecommendedMovieSchema>;
export type RecommendationFilters = z.infer<typeof RecommendationFiltersSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
