import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { movieReactionEnum } from "./enums";
import { users } from "./users";

export const userMovieInteractions = pgTable(
  "user_movie_interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id").notNull(),
    reaction: movieReactionEnum("reaction").notNull(),
    watchedAt: timestamp("watched_at", {
      withTimezone: true,
      mode: "date",
    }),
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
    unique("user_movie_interactions_user_id_movie_id_unique").on(
      table.userId,
      table.movieId,
    ),
    check(
      "user_movie_interactions_movie_id_positive_check",
      sql`${table.movieId} > 0`,
    ),
    index("user_movie_interactions_user_updated_at_idx").on(
      table.userId,
      table.updatedAt.desc(),
    ),
    index("user_movie_interactions_user_reaction_updated_at_idx").on(
      table.userId,
      table.reaction,
      table.updatedAt.desc(),
    ),
  ],
);

export type UserMovieInteractionRecord =
  typeof userMovieInteractions.$inferSelect;
export type NewUserMovieInteractionRecord =
  typeof userMovieInteractions.$inferInsert;
