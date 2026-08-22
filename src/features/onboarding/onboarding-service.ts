import "server-only";

import type { CompleteOnboardingRequest } from "@/contracts";
import type { Database } from "@/db";
import {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
  UserRepository,
} from "@/db/repositories";
import type { UserRecord } from "@/db/schema";

export interface OnboardingCompletion {
  completed: true;
  completedAt: string;
}

/** Coordinates the existing preference and interaction persistence APIs; there
 * is no onboarding-specific storage model. */
export class OnboardingService {
  constructor(
    private readonly db: Pick<Database, "transaction">,
  ) {}

  async complete(
    viewer: Pick<UserRecord, "id" | "onboardingCompletedAt">,
    input: CompleteOnboardingRequest,
  ): Promise<OnboardingCompletion> {
    if (viewer.onboardingCompletedAt) {
      return this.toCompletion(viewer.onboardingCompletedAt);
    }

    const completedAt = new Date();

    return this.db.transaction(async (transaction) => {
      const users = new UserRepository(transaction);
      const claimedUser = await users.claimOnboardingCompletion(
        viewer.id,
        completedAt,
      );

      if (!claimedUser) {
        const existingUser = await users.findById(viewer.id);

        if (existingUser?.onboardingCompletedAt) {
          return this.toCompletion(existingUser.onboardingCompletedAt);
        }

        throw new Error("Could not claim onboarding completion");
      }

      const preferences = new UserPreferencesRepository(transaction);
      const interactions = new UserMovieInteractionRepository(transaction);

      await preferences.upsert(viewer.id, input.preferredGenreIds);

      for (const movieId of input.likedMovieIds) {
        await interactions.upsertReaction(viewer.id, movieId, "LIKE");
        await interactions.setWatched(viewer.id, movieId, completedAt);
      }

      return this.toCompletion(claimedUser.onboardingCompletedAt ?? completedAt);
    });
  }

  private toCompletion(completedAt: Date): OnboardingCompletion {
    return { completed: true, completedAt: completedAt.toISOString() };
  }
}
