import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const movieCache = pgTable(
  "movie_cache",
  {
    movieId: integer("movie_id").notNull(),
    language: varchar("language", { length: 10 }).notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.movieId, table.language] }),
    check("movie_cache_movie_id_positive_check", sql`${table.movieId} > 0`),
    check(
      "movie_cache_language_length_check",
      sql`char_length(btrim(${table.language})) between 2 and 10`,
    ),
    index("movie_cache_fetched_at_idx").on(table.fetchedAt),
  ],
);

export type MovieCacheRecord = typeof movieCache.$inferSelect;
export type NewMovieCacheRecord = typeof movieCache.$inferInsert;
