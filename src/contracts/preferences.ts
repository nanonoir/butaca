import { z } from "zod";

import {
  IsoDateTimeSchema,
  TmdbGenreIdSchema,
  apiDataResponseSchema,
} from "./common";

export const PreferredGenreIdsSchema = z
  .array(TmdbGenreIdSchema)
  .min(2)
  .refine((ids) => new Set(ids).size === ids.length, {
    error: "preferredGenreIds cannot contain duplicates",
  });

export const UserPreferencesSchema = z.object({
  preferredGenreIds: PreferredGenreIdsSchema,
  onboardingCompleted: z.boolean(),
  onboardingCompletedAt: IsoDateTimeSchema.nullable(),
});

export const GetPreferencesResponseSchema = apiDataResponseSchema(
  UserPreferencesSchema,
);

export const UpdatePreferencesRequestSchema = z.object({
  preferredGenreIds: PreferredGenreIdsSchema,
});

export const UpdatePreferencesResponseSchema = apiDataResponseSchema(
  UserPreferencesSchema,
);

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
