import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "ONBOARDING_REQUIRED",
  "MOVIE_NOT_FOUND",
  "REACTION_NOT_FOUND",
  "REACTION_REQUIRED",
  "REVIEW_NOT_FOUND",
  "TMDB_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
