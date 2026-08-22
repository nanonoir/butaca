import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { reviewVerdictEnum } from "./enums";
import { users } from "./users";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id").notNull(),
    verdict: reviewVerdictEnum("verdict").notNull(),
    title: varchar("title", { length: 30 }).notNull(),
    description: varchar("description", { length: 400 }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("reviews_user_id_movie_id_unique").on(table.userId, table.movieId),
    check("reviews_movie_id_positive_check", sql`${table.movieId} > 0`),
    check(
      "reviews_title_length_check",
      sql`char_length(btrim(${table.title})) between 3 and 30`,
    ),
    check(
      "reviews_description_length_check",
      sql`char_length(btrim(${table.description})) between 10 and 400`,
    ),
    index("reviews_movie_created_at_idx").on(
      table.movieId,
      table.createdAt.desc(),
    ),
    index("reviews_movie_verdict_idx").on(table.movieId, table.verdict),
  ],
);

export type ReviewRecord = typeof reviews.$inferSelect;
export type NewReviewRecord = typeof reviews.$inferInsert;
