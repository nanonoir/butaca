import { z } from "zod";

import { TmdbGenreIdSchema, TmdbPersonIdSchema } from "./common";

export const TasteGenreSchema = z.object({
  id: TmdbGenreIdSchema,
  name: z.string().min(1),
});

/** Carries its own arithmetic. A genre the recommender decided to avoid is the
 * part most likely to feel wrong, and it can only be argued with by somebody
 * who can see what it was counted from. */
export const AvoidedGenreSchema = TasteGenreSchema.extend({
  disliked: z.number().int().min(0),
  liked: z.number().int().min(0),
});

export const TastePersonSchema = z.object({
  id: TmdbPersonIdSchema,
  name: z.string().min(1),
});

export const TasteSummarySchema = z.object({
  /** False while the profile is built on too little to mean anything. Every
   * other field is still filled, so the screen decides what to say rather than
   * being handed an empty object with no way to tell "nothing yet" from
   * "nothing found". */
  hasEnough: z.boolean(),
  likedCount: z.number().int().min(0),
  genres: z.array(TasteGenreSchema),
  avoidedGenres: z.array(AvoidedGenreSchema),
  actors: z.array(TastePersonSchema),
  directors: z.array(TastePersonSchema),
});

export type TasteGenre = z.infer<typeof TasteGenreSchema>;
export type AvoidedGenre = z.infer<typeof AvoidedGenreSchema>;
export type TasteSummary = z.infer<typeof TasteSummarySchema>;
