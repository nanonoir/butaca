import { describe, expect, it } from "vitest";

import { PreferredGenreIdsSchema } from "./preferences";
import { CompleteOnboardingRequestSchema } from "./onboarding";

const validInput = {
  preferredGenreIds: [28, 12],
  likedMovieIds: [550, 680, 155],
};

describe("CompleteOnboardingRequestSchema", () => {
  it("uses the canonical payload fields and accepts both maximum boundaries", () => {
    expect(CompleteOnboardingRequestSchema.parse(validInput)).toEqual(validInput);
    expect(
      CompleteOnboardingRequestSchema.parse({
        preferredGenreIds: Array.from({ length: 8 }, (_, index) => index + 1),
        likedMovieIds: Array.from({ length: 8 }, (_, index) => index + 1),
      }),
    ).toBeDefined();
  });

  it("rejects invalid counts, duplicate ids, and non-positive TMDB ids", () => {
    for (const invalidInput of [
      { ...validInput, preferredGenreIds: [28] },
      { ...validInput, likedMovieIds: [550, 680] },
      { ...validInput, preferredGenreIds: Array(9).fill(28) },
      { ...validInput, likedMovieIds: Array(9).fill(550) },
      { ...validInput, preferredGenreIds: [28, 28] },
      { ...validInput, likedMovieIds: [550, 550, 155] },
      { ...validInput, preferredGenreIds: [0, 28] },
      { ...validInput, likedMovieIds: [-1, 680, 155] },
    ]) {
      expect(CompleteOnboardingRequestSchema.safeParse(invalidInput).success).toBe(
        false,
      );
    }
  });

  it("does not apply the onboarding-only maximum to global preferences", () => {
    expect(
      PreferredGenreIdsSchema.safeParse(
        Array.from({ length: 9 }, (_, index) => index + 1),
      ).success,
    ).toBe(true);
  });
});
