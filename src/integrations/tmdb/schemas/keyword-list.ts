import { z } from "zod";

export const TmdbKeywordSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

export const TmdbKeywordListResponseSchema = z.object({
  results: z.array(TmdbKeywordSummarySchema),
});

export type TmdbKeywordListResponse = z.infer<
  typeof TmdbKeywordListResponseSchema
>;
