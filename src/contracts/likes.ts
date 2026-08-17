import { z } from "zod";

import {
  IsoDateTimeSchema,
  PageQuerySchema,
  paginatedResponseSchema,
} from "./common";
import { MovieSummarySchema } from "./movies";

export const LikesWatchedFilterSchema = z.enum(["all", "watched", "unwatched"]);

export const LikesQuerySchema = PageQuerySchema.extend({
  watched: LikesWatchedFilterSchema.default("all"),
});

export const LikedMovieItemSchema = z.object({
  movie: MovieSummarySchema,
  likedAt: IsoDateTimeSchema,
  watchedAt: IsoDateTimeSchema.nullable(),
});

export const LikesResponseSchema =
  paginatedResponseSchema(LikedMovieItemSchema);

export type LikesWatchedFilter = z.infer<typeof LikesWatchedFilterSchema>;
export type LikesQuery = z.infer<typeof LikesQuerySchema>;
export type LikedMovieItem = z.infer<typeof LikedMovieItemSchema>;
