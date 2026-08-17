import { z } from "zod";

import { apiDataResponseSchema } from "./common";
import { ViewerMovieStateSchema } from "./interactions";
import { MovieDetailSchema } from "./movies";
import { ReviewSchema, ReviewSummarySchema } from "./reviews";

export const MovieDetailPageDataSchema = z.object({
  movie: MovieDetailSchema,
  viewerState: ViewerMovieStateSchema,
  reviewSummary: ReviewSummarySchema,
  myReview: ReviewSchema.nullable(),
});

export const MovieDetailResponseSchema = apiDataResponseSchema(
  MovieDetailPageDataSchema,
);

export type MovieDetailPageData = z.infer<typeof MovieDetailPageDataSchema>;
