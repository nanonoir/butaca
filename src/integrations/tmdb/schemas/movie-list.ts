import { z } from "zod";

import { TmdbMovieCoreSchema } from "./common";

export const TmdbMovieSummarySchema = TmdbMovieCoreSchema.extend({
  genre_ids: z.array(z.number().int().positive()),
});

export const TmdbMovieListResponseSchema = z.object({
  page: z.number().int().positive(),
  results: z.array(TmdbMovieSummarySchema),
  total_pages: z.number().int().min(0),
  total_results: z.number().int().min(0),
});

export type TmdbMovieSummary = z.infer<typeof TmdbMovieSummarySchema>;
export type TmdbMovieListResponse = z.infer<typeof TmdbMovieListResponseSchema>;
