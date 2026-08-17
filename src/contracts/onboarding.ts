import { z } from "zod";

import {
  IsoDateTimeSchema,
  TmdbGenreIdSchema,
  TmdbMovieIdSchema,
  apiDataResponseSchema,
} from "./common";

const UniquePreferredGenreIdsSchema = z
  .array(TmdbGenreIdSchema)
  .min(2, { error: "Select at least 2 preferred genres" })
  .refine((ids) => new Set(ids).size === ids.length, {
    error: "preferredGenreIds cannot contain duplicates",
  });

const UniqueLikedMovieIdsSchema = z
  .array(TmdbMovieIdSchema)
  .min(3, { error: "Select at least 3 liked movies" })
  .refine((ids) => new Set(ids).size === ids.length, {
    error: "likedMovieIds cannot contain duplicates",
  });

export const CompleteOnboardingRequestSchema = z.object({
  preferredGenreIds: UniquePreferredGenreIdsSchema,
  likedMovieIds: UniqueLikedMovieIdsSchema,
});

export const CompleteOnboardingResponseSchema = apiDataResponseSchema(
  z.object({
    completed: z.literal(true),
    completedAt: IsoDateTimeSchema,
  }),
);

export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>;
