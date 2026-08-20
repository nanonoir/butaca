import { sql } from "drizzle-orm";
import { check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    preferredGenreIds: integer("preferred_genre_ids").array().notNull(),
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
    check(
      "user_preferences_minimum_genres_check",
      sql`cardinality(${table.preferredGenreIds}) >= 2`,
    ),
    check(
      "user_preferences_positive_genres_check",
      sql`coalesce(0 < ALL(${table.preferredGenreIds}), false)`,
    ),
  ],
);

export type UserPreferenceRecord = typeof userPreferences.$inferSelect;
export type NewUserPreferenceRecord = typeof userPreferences.$inferInsert;
