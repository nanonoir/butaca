import { z } from "zod";

import {
  TmdbGenreIdSchema,
  TmdbKeywordIdSchema,
  TmdbMovieIdSchema,
  TmdbPersonIdSchema,
  apiDataResponseSchema,
} from "./common";
import { MovieSummarySchema } from "./movies";

export const DiscoverResponseSchema = apiDataResponseSchema(
  z.object({
    movies: z.array(MovieSummarySchema).max(20),
    batchSize: z.literal(20),
    returned: z.number().int().min(0).max(20),
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
  limit: z.number().int().min(1).max(20).default(20),
  excludeMovieIds: z.array(TmdbMovieIdSchema).default([]),
});

export type RecommendationFilters = z.infer<typeof RecommendationFiltersSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
