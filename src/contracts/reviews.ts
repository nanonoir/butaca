import { z } from "zod";

import {
  IsoDateTimeSchema,
  PageQuerySchema,
  TmdbMovieIdSchema,
  UuidSchema,
  apiDataResponseSchema,
  paginatedResponseSchema,
} from "./common";

export const ReviewVerdictSchema = z.enum(["RECOMMENDED", "NOT_WORTH_IT"]);

export const ReviewTitleSchema = z.string().trim().min(3).max(30);

export const ReviewDescriptionSchema = z.string().trim().min(10).max(400);

export const ReviewAuthorSchema = z.object({
  displayName: z.string().min(1).max(80),
  avatarUrl: z.preprocess(
    (value) => (value === "" ? null : value),
    z.url().nullable(),
  ),
});

export const ReviewSchema = z.object({
  id: UuidSchema,
  movieId: TmdbMovieIdSchema,
  author: ReviewAuthorSchema,
  verdict: ReviewVerdictSchema,
  title: ReviewTitleSchema,
  description: ReviewDescriptionSchema,
  isMine: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ReviewSummarySchema = z
  .object({
    recommended: z.number().int().min(0),
    notWorthIt: z.number().int().min(0),
    total: z.number().int().min(0),
    recommendationRate: z.number().min(0).max(100).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.total !== value.recommended + value.notWorthIt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "total must equal recommended + notWorthIt",
      });
    }

    if (value.total === 0 && value.recommendationRate !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendationRate"],
        message: "recommendationRate must be null when total is 0",
      });
    }
  });

export const UpsertReviewRequestSchema = z.object({
  verdict: ReviewVerdictSchema,
  title: ReviewTitleSchema,
  description: ReviewDescriptionSchema,
});

export const UpsertReviewResponseSchema = apiDataResponseSchema(ReviewSchema);

export const ReviewsQuerySchema = PageQuerySchema;

export const ReviewsResponseSchema = paginatedResponseSchema(ReviewSchema);

export const DeleteReviewResponseSchema = apiDataResponseSchema(
  z.object({
    movieId: TmdbMovieIdSchema,
    deleted: z.literal(true),
  }),
);

export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
export type UpsertReviewRequest = z.infer<typeof UpsertReviewRequestSchema>;
