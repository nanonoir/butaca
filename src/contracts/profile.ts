import { z } from "zod";

import { IsoDateTimeSchema, UuidSchema } from "./common";
import { MovieSummarySchema } from "./movies";
import {
  ReviewDescriptionSchema,
  ReviewTitleSchema,
  ReviewVerdictSchema,
} from "./reviews";

/** A review as its own author sees it, listed away from the movie it belongs
 * to. The author is dropped -- it is the viewer, on every one of them -- and
 * the movie takes its place, since that is what tells one card from the next
 * here. */
export const MyReviewSchema = z.object({
  id: UuidSchema,
  movie: MovieSummarySchema,
  verdict: ReviewVerdictSchema,
  title: ReviewTitleSchema,
  description: ReviewDescriptionSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type MyReview = z.infer<typeof MyReviewSchema>;
