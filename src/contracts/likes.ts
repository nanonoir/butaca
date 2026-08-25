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
  /** Matched against the titles of the movies already in the library, not
   * against the catalog. Trimmed to nothing means no search at all, so an empty
   * box behaves like the plain list rather than like a query for everything. */
  search: z.string().trim().min(1).max(80).optional(),
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
