import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  find: vi.fn(),
  preferencesUpsert: vi.fn(),
  upsertReaction: vi.fn(),
  setWatched: vi.fn(),
}));

vi.mock("@/db/repositories", () => ({
  UserRepository: vi.fn(function UserRepository() {
    return { claimOnboardingCompletion: mocks.claim, findById: mocks.find };
  }),
  UserPreferencesRepository: vi.fn(function UserPreferencesRepository() {
    return { upsert: mocks.preferencesUpsert };
  }),
  UserMovieInteractionRepository: vi.fn(function UserMovieInteractionRepository() {
    return {
      upsertReaction: mocks.upsertReaction,
      setWatched: mocks.setWatched,
    };
  }),
}));

import { OnboardingService } from "./onboarding-service";

const viewer = {
  id: "00000000-0000-4000-8000-000000000001",
  onboardingCompletedAt: null,
};
const input = { preferredGenreIds: [28, 12], likedMovieIds: [550, 680, 155] };

describe("OnboardingService", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("uses one transaction, a conditional claim, and one shared timestamp", async () => {
    let transactionExecutor: unknown;
    const database = {
      transaction: vi.fn(async (callback) => callback(transactionExecutor)),
    };
    mocks.claim.mockImplementation(async (_userId, completedAt) => ({
      ...viewer,
      onboardingCompletedAt: completedAt,
    }));
    mocks.preferencesUpsert.mockResolvedValue({});
    mocks.upsertReaction.mockResolvedValue({});
    mocks.setWatched.mockResolvedValue({});

    const result = await new OnboardingService(database as never).complete(
      viewer,
      input,
    );

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.claim).toHaveBeenCalledWith(viewer.id, expect.any(Date));
    const completedAt = new Date(result.completedAt);
    expect(mocks.preferencesUpsert).toHaveBeenCalledWith(viewer.id, [28, 12]);
    expect(mocks.upsertReaction).toHaveBeenCalledTimes(3);
    expect(mocks.setWatched).toHaveBeenCalledTimes(3);
    for (const [, , watchedAt] of mocks.setWatched.mock.calls) {
      expect(watchedAt).toEqual(completedAt);
    }
  });

  it("returns the persisted timestamp when a completion was already claimed", async () => {
    const existingTimestamp = new Date("2026-08-21T18:00:00.000Z");
    mocks.claim.mockResolvedValue(null);
    mocks.find.mockResolvedValue({ ...viewer, onboardingCompletedAt: existingTimestamp });
    const database = { transaction: async (callback: (tx: unknown) => unknown) => callback({}) };

    await expect(new OnboardingService(database as never).complete(viewer, input)).resolves.toEqual({
      completed: true,
      completedAt: existingTimestamp.toISOString(),
    });
    expect(mocks.preferencesUpsert).not.toHaveBeenCalled();
    expect(mocks.upsertReaction).not.toHaveBeenCalled();
  });

  it("does not begin a transaction when the trusted viewer is already complete", async () => {
    const timestamp = new Date("2026-08-21T18:00:00.000Z");
    const transaction = vi.fn();

    await expect(
      new OnboardingService({ transaction } as never).complete(
        { ...viewer, onboardingCompletedAt: timestamp },
        input,
      ),
    ).resolves.toEqual({ completed: true, completedAt: timestamp.toISOString() });
    expect(transaction).not.toHaveBeenCalled();
  });
});
