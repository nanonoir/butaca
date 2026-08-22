import { z } from "zod";

/** `known_for_department` is what separates two people who share a name: asking
 * for a director called Anderson and an actor called Anderson are different
 * questions, and TMDB answers both from the same endpoint. */
export const TmdbPersonSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  known_for_department: z.string().nullish(),
  popularity: z.number().nullish(),
  profile_path: z.string().nullish(),
});

export const TmdbPersonListResponseSchema = z.object({
  page: z.number().int().positive(),
  results: z.array(TmdbPersonSummarySchema),
  total_pages: z.number().int().min(0),
  total_results: z.number().int().min(0),
});

export type TmdbPersonSummary = z.infer<typeof TmdbPersonSummarySchema>;
export type TmdbPersonListResponse = z.infer<
  typeof TmdbPersonListResponseSchema
>;

/** `/person/{id}/movie_credits`. `job` is the field discover has no equivalent
 * for: `with_crew` matches anyone who worked on a film, so a director filter
 * built on it hands back everything they ever produced. */
export const TmdbPersonCreditSchema = z.object({
  id: z.number().int().positive(),
  job: z.string().nullish(),
  /** Billing position. Zero is the lead, and it is what separates a starring
   * role from the one line an actor had before they were famous -- TMDB lists
   * DiCaprio in Critters 3 exactly as it lists him in Titanic. */
  order: z.number().int().min(0).nullish(),
});

export const TmdbPersonCreditsResponseSchema = z.object({
  cast: z.array(TmdbPersonCreditSchema).default([]),
  crew: z.array(TmdbPersonCreditSchema).default([]),
});

export type TmdbPersonCreditsResponse = z.infer<
  typeof TmdbPersonCreditsResponseSchema
>;
