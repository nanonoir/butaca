import { relations } from "drizzle-orm";

import { reviews } from "./reviews";
import { userMovieInteractions } from "./user-movie-interactions";
import { userPreferences } from "./user-preferences";
import { users } from "./users";

export const usersRelations = relations(users, ({ many, one }) => ({
  preferences: one(userPreferences),
  interactions: many(userMovieInteractions),
  reviews: many(reviews),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const userMovieInteractionsRelations = relations(
  userMovieInteractions,
  ({ one }) => ({
    user: one(users, {
      fields: [userMovieInteractions.userId],
      references: [users.id],
    }),
  }),
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));
