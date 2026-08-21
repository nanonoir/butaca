import { pgEnum } from "drizzle-orm/pg-core";

export const movieReactionEnum = pgEnum("movie_reaction", ["LIKE", "DISLIKE"]);

export const reviewVerdictEnum = pgEnum("review_verdict", [
  "RECOMMENDED",
  "NOT_WORTH_IT",
]);
