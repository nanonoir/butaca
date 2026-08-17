import { z } from "zod";

import { PageQuerySchema, paginatedResponseSchema } from "./common";
import { MovieSummarySchema } from "./movies";

export const SearchMoviesQuerySchema = PageQuerySchema.extend({
  query: z.string().trim().min(1).max(100),
});

export const SearchMoviesResponseSchema =
  paginatedResponseSchema(MovieSummarySchema);

export type SearchMoviesQuery = z.infer<typeof SearchMoviesQuerySchema>;
