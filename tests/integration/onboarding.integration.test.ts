import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OnboardingService } from "../../src/features/onboarding/onboarding-service";
import {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
  UserRepository,
} from "../../src/db/repositories";
import { createIntegrationDatabase } from "./support/database";
import { createTestAuthUser, deleteTestAuthUser } from "./support/supabase";

let database: ReturnType<typeof createIntegrationDatabase> | undefined;

beforeAll(() => {
  database = createIntegrationDatabase();
});

afterAll(async () => {
  await database?.close();
});

function getDatabase() {
  if (!database) {
    throw new Error("Integration database was not created");
  }

  return database.db;
}

describe("OnboardingService integration", () => {
  it("commits genres, liked/watched movies, and one completion timestamp atomically", async () => {
    const authUser = await createTestAuthUser();
    const users = new UserRepository(getDatabase());
    const service = new OnboardingService(getDatabase());

    try {
      const viewer = await users.create({
        id: authUser.id,
        displayName: "Onboarding service integration",
        avatarUrl: null,
      });
      const input = {
        preferredGenreIds: [28, 12],
        likedMovieIds: [550, 680, 155],
      };

      const [first, repeated] = await Promise.all([
        service.complete(viewer, input),
        service.complete(viewer, input),
      ]);
      const preferences = await new UserPreferencesRepository(
        getDatabase(),
      ).findByUserId(authUser.id);
      const interactions = await Promise.all(
        input.likedMovieIds.map((movieId) =>
          new UserMovieInteractionRepository(getDatabase()).findByUserAndMovie(
            authUser.id,
            movieId,
          ),
        ),
      );

      expect(repeated).toEqual(first);
      expect(preferences).toMatchObject({ preferredGenreIds: [28, 12] });
      expect(interactions).toHaveLength(3);
      for (const interaction of interactions) {
        expect(interaction).toMatchObject({
          reaction: "LIKE",
          watchedAt: new Date(first.completedAt),
        });
      }
      expect(await users.findById(authUser.id)).toMatchObject({
        onboardingCompletedAt: new Date(first.completedAt),
      });
    } finally {
      await deleteTestAuthUser(authUser.id);
    }
  });
});
