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

export const MatchInsightSchema = z.object({
  tier: MatchTierSchema,
  matchedGenres: z.array(z.string().min(1)).max(5),
  clashingGenres: z.array(z.string().min(1)).max(5),
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
    castIds: z.array(TmdbPersonIdSchema).optional(),
    crewIds: z.array(TmdbPersonIdSchema).optional(),
    originalLanguage: z.string().min(2).optional(),
    minRuntime: z.number().int().positive().optional(),
    maxRuntime: z.number().int().positive().optional(),
    minTmdbRating: z.number().min(0).max(10).optional(),
    minTmdbVoteCount: z.number().int().min(0).optional(),
    similarToMovieId: TmdbMovieIdSchema.optional(),
  })
  .superRefine((value, ctx) => {
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
export type RecommendedMovie = z.infer<typeof RecommendedMovieSchema>;
export type RecommendationFilters = z.infer<typeof RecommendationFiltersSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
