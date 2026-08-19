import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PAGE_SIZE } from "../../src/contracts/common";
import {
  ReviewRepository,
  UserMovieInteractionRepository,
  UserPreferencesRepository,
  UserRepository,
} from "../../src/db/repositories";
import {
  reviews,
  userMovieInteractions,
  userPreferences,
  users,
} from "../../src/db/schema";
import { createIntegrationDatabase } from "./support/database";
import { createTestAuthUser, deleteTestAuthUser } from "./support/supabase";

let database: ReturnType<typeof createIntegrationDatabase> | undefined;
let userRepository: UserRepository | undefined;
let userPreferencesRepository: UserPreferencesRepository | undefined;
let userMovieInteractionRepository: UserMovieInteractionRepository | undefined;
let reviewRepository: ReviewRepository | undefined;
const task6AuthUserIds: string[] = [];
const task7AuthUserIds: string[] = [];

beforeAll(() => {
  database = createIntegrationDatabase();
  userRepository = new UserRepository(database.db);
});

afterAll(async () => {
  await database?.close();
});

function getUserRepository() {
  if (!userRepository) {
    throw new Error("User repository was not created");
  }

  return userRepository;
}

function getDatabase() {
  if (!database) {
    throw new Error("Integration database connection was not created");
  }

  return database.db;
}

function getUserPreferencesRepository() {
  if (!userPreferencesRepository) {
    throw new Error("User preferences repository was not created");
  }

  return userPreferencesRepository;
}

function getUserMovieInteractionRepository() {
  if (!userMovieInteractionRepository) {
    throw new Error("User movie interaction repository was not created");
  }

  return userMovieInteractionRepository;
}

function getReviewRepository() {
  if (!reviewRepository) {
    throw new Error("Review repository was not created");
  }

  return reviewRepository;
}

function getTask6AuthUserId(index: number) {
  const userId = task6AuthUserIds[index];

  if (!userId) {
    throw new Error("Task 6 Auth user was not created");
  }

  return userId;
}

function getTask7AuthUserId(index: number) {
  const userId = task7AuthUserIds[index];

  if (!userId) {
    throw new Error("Task 7 Auth user was not created");
  }

  return userId;
}

async function expectDatabaseViolation(
  operation: Promise<unknown>,
  expected: { code: string; constraintName: string | undefined },
) {
  let databaseError: { code: unknown; constraintName: unknown } | undefined;

  try {
    await operation;
  } catch (error) {
    const cause =
      error instanceof Error && "cause" in error ? error.cause : undefined;

    if (typeof cause === "object" && cause !== null) {
      const databaseCause = cause as Record<string, unknown>;
      databaseError = {
        code: databaseCause.code,
        constraintName: databaseCause.constraint_name,
      };
    }
  }

  expect(databaseError).toEqual(expected);
}

async function expectCheckConstraintViolation(
  operation: Promise<unknown>,
  constraintName: string,
) {
  await expectDatabaseViolation(operation, {
    code: "23514",
    constraintName,
  });
}

async function cleanupTask6AuthUsers() {
  const userIds = [...task6AuthUserIds];
  const cleanupResults = await Promise.allSettled(
    userIds.map((userId) => deleteTestAuthUser(userId)),
  );

  task6AuthUserIds.length = 0;
  cleanupResults.forEach((result, index) => {
    const userId = userIds[index];

    if (result.status === "rejected" && userId) {
      task6AuthUserIds.push(userId);
    }
  });

  return cleanupResults.every((result) => result.status === "fulfilled");
}

async function cleanupTask7AuthUsers() {
  const userIds = [...task7AuthUserIds];
  const cleanupResults = await Promise.allSettled(
    userIds.map((userId) => deleteTestAuthUser(userId)),
  );

  task7AuthUserIds.length = 0;
  cleanupResults.forEach((result, index) => {
    const userId = userIds[index];

    if (result.status === "rejected" && userId) {
      task7AuthUserIds.push(userId);
    }
  });

  return cleanupResults.every((result) => result.status === "fulfilled");
}

it("creates and finds a profile using the Auth UUID", async () => {
  const authUser = await createTestAuthUser();

  try {
    const created = await getUserRepository().create({
      id: authUser.id,
      displayName: "Created profile",
      avatarUrl: "https://example.test/created.png",
    });
    const found = await getUserRepository().findById(authUser.id);

    expect(created).toMatchObject({
      id: authUser.id,
      displayName: "Created profile",
      avatarUrl: "https://example.test/created.png",
    });
    expect(found).toEqual(created);
  } finally {
    await deleteTestAuthUser(authUser.id);
  }
});

it("updates only the requested profile fields", async () => {
  const authUser = await createTestAuthUser();

  try {
    await getUserRepository().create({
      id: authUser.id,
      displayName: "Original profile",
      avatarUrl: "https://example.test/original.png",
    });
    const previousUpdatedAt = new Date("2000-01-01T00:00:00.000Z");

    await getDatabase()
      .update(users)
      .set({ updatedAt: previousUpdatedAt })
      .where(eq(users.id, authUser.id));

    const updated = await getUserRepository().update(authUser.id, {
      displayName: "Updated profile",
    });
    const unchanged = await getUserRepository().update(authUser.id, {});

    expect(updated).toMatchObject({
      id: authUser.id,
      displayName: "Updated profile",
      avatarUrl: "https://example.test/original.png",
      onboardingCompletedAt: null,
    });
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(
      previousUpdatedAt.getTime(),
    );
    expect(unchanged).toEqual(updated);
  } finally {
    await deleteTestAuthUser(authUser.id);
  }
});

it("returns null for an unknown UUID", async () => {
  const unknownUserId = crypto.randomUUID();

  expect(await getUserRepository().findById(unknownUserId)).toBeNull();
  expect(
    await getUserRepository().update(unknownUserId, {
      displayName: "Unknown profile",
    }),
  ).toBeNull();
});

it("upsertFromAuthUser repairs a missing profile idempotently", async () => {
  const authUser = await createTestAuthUser();
  const authProfile = {
    id: authUser.id,
    displayName: "Auth profile",
    avatarUrl: "https://example.test/auth.png",
  };

  try {
    const created = await getUserRepository().upsertFromAuthUser(authProfile);
    const repeated = await getUserRepository().upsertFromAuthUser(authProfile);
    const edited = await getUserRepository().update(authUser.id, {
      displayName: "Edited profile",
      avatarUrl: "https://example.test/edited.png",
    });
    const preserved = await getUserRepository().upsertFromAuthUser(authProfile);

    expect(created).toMatchObject(authProfile);
    expect(repeated).toEqual(created);
    expect(edited).toMatchObject({
      displayName: "Edited profile",
      avatarUrl: "https://example.test/edited.png",
    });
    expect(preserved).toEqual(edited);
  } finally {
    await deleteTestAuthUser(authUser.id);
  }
});

it("deleting the Auth user cascades to public.users", async () => {
  const authUser = await createTestAuthUser();
  let authUserDeleted = false;

  try {
    await getUserRepository().create({
      id: authUser.id,
      displayName: "Cascade profile",
      avatarUrl: null,
    });

    await deleteTestAuthUser(authUser.id);
    authUserDeleted = true;

    expect(await getUserRepository().findById(authUser.id)).toBeNull();
  } finally {
    if (!authUserDeleted) {
      await deleteTestAuthUser(authUser.id);
    }
  }
});

describe("Task 6 repositories", () => {
  beforeAll(async () => {
    userPreferencesRepository = new UserPreferencesRepository(getDatabase());
    userMovieInteractionRepository = new UserMovieInteractionRepository(
      getDatabase(),
    );

    try {
      for (const displayName of ["Task 6 primary", "Task 6 secondary"]) {
        const authUser = await createTestAuthUser();
        task6AuthUserIds.push(authUser.id);
        await getUserRepository().create({
          id: authUser.id,
          displayName,
          avatarUrl: null,
        });
      }
    } catch {
      await cleanupTask6AuthUsers();
      throw new Error("Could not set up Task 6 fixtures");
    }
  });

  afterAll(async () => {
    if (!(await cleanupTask6AuthUsers())) {
      throw new Error("Could not clean up Task 6 Auth users");
    }
  });

  beforeEach(async () => {
    await getDatabase()
      .delete(userMovieInteractions)
      .where(inArray(userMovieInteractions.userId, task6AuthUserIds));
    await getDatabase()
      .delete(userPreferences)
      .where(inArray(userPreferences.userId, task6AuthUserIds));
  });

  it("creates, reads, updates and upserts preferences scoped by userId", async () => {
    const userId = getTask6AuthUserId(0);
    const otherUserId = getTask6AuthUserId(1);
    const repository = getUserPreferencesRepository();
    const previousUpdatedAt = new Date("2000-01-01T00:00:00.000Z");

    const created = await repository.create(userId, [28, 12]);
    const otherUserPreferences = await repository.upsert(otherUserId, [16, 35]);
    const found = await repository.findByUserId(userId);

    await getDatabase()
      .update(userPreferences)
      .set({ updatedAt: previousUpdatedAt })
      .where(eq(userPreferences.userId, userId));

    const updated = await repository.update(userId, [18, 53]);

    await getDatabase()
      .update(userPreferences)
      .set({ updatedAt: previousUpdatedAt })
      .where(eq(userPreferences.userId, userId));

    const upserted = await repository.upsert(userId, [80, 99]);

    expect(created).toMatchObject({ userId, preferredGenreIds: [28, 12] });
    expect(found).toEqual(created);
    expect(updated).toMatchObject({ userId, preferredGenreIds: [18, 53] });
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(
      previousUpdatedAt.getTime(),
    );
    expect(upserted).toMatchObject({ userId, preferredGenreIds: [80, 99] });
    expect(upserted.updatedAt.getTime()).toBeGreaterThan(
      previousUpdatedAt.getTime(),
    );
    expect(await repository.findByUserId(otherUserId)).toEqual(
      otherUserPreferences,
    );
  });

  it("rejects fewer than two preferred genres at the database boundary", async () => {
    const userId = getTask6AuthUserId(0);
    const repository = getUserPreferencesRepository();

    await expectCheckConstraintViolation(
      repository.create(userId, [28]),
      "user_preferences_minimum_genres_check",
    );
    expect(await repository.findByUserId(userId)).toBeNull();
  });

  it("rejects non-positive preferred genre IDs at the database boundary", async () => {
    const userId = getTask6AuthUserId(0);
    const repository = getUserPreferencesRepository();

    for (const invalidGenreId of [0, -1]) {
      await expectCheckConstraintViolation(
        repository.create(userId, [28, invalidGenreId]),
        "user_preferences_positive_genres_check",
      );
    }

    expect(await repository.findByUserId(userId)).toBeNull();
  });

  it("creates a LIKE with watchedAt null", async () => {
    const userId = getTask6AuthUserId(0);
    const otherUserId = getTask6AuthUserId(1);
    const repository = getUserMovieInteractionRepository();

    const created = await repository.upsertReaction(userId, 101, "LIKE");
    const otherUserInteraction = await repository.upsertReaction(
      otherUserId,
      101,
      "DISLIKE",
    );

    expect(created).toMatchObject({
      userId,
      movieId: 101,
      reaction: "LIKE",
      watchedAt: null,
    });
    expect(await repository.findByUserAndMovie(userId, 101)).toEqual(created);
    expect(await repository.findByUserAndMovie(otherUserId, 101)).toEqual(
      otherUserInteraction,
    );
  });

  it("switches LIKE to DISLIKE without changing watchedAt", async () => {
    const userId = getTask6AuthUserId(0);
    const repository = getUserMovieInteractionRepository();
    const watchedAt = new Date("2026-01-15T12:00:00.000Z");
    const previousUpdatedAt = new Date("2000-01-01T00:00:00.000Z");

    await repository.upsertReaction(userId, 102, "LIKE");
    await repository.setWatched(userId, 102, watchedAt);
    await getDatabase()
      .update(userMovieInteractions)
      .set({ updatedAt: previousUpdatedAt })
      .where(
        and(
          eq(userMovieInteractions.userId, userId),
          eq(userMovieInteractions.movieId, 102),
        ),
      );

    const switched = await repository.upsertReaction(userId, 102, "DISLIKE");

    expect(switched).toMatchObject({
      userId,
      movieId: 102,
      reaction: "DISLIKE",
      watchedAt,
    });
    expect(switched.updatedAt.getTime()).toBeGreaterThan(
      previousUpdatedAt.getTime(),
    );
  });

  it("setWatched updates an existing row and never creates one", async () => {
    const userId = getTask6AuthUserId(0);
    const otherUserId = getTask6AuthUserId(1);
    const repository = getUserMovieInteractionRepository();
    const watchedAt = new Date("2026-02-20T18:30:00.000Z");

    await repository.upsertReaction(userId, 103, "LIKE");
    await repository.upsertReaction(otherUserId, 103, "DISLIKE");

    const watched = await repository.setWatched(userId, 103, watchedAt);
    const otherUserUnchanged = await repository.findByUserAndMovie(
      otherUserId,
      103,
    );
    const unwatched = await repository.setWatched(userId, 103, null);

    await repository.upsertReaction(otherUserId, 104, "LIKE");
    const missing = await repository.setWatched(userId, 104, watchedAt);
    const otherUserStillUnchanged = await repository.findByUserAndMovie(
      otherUserId,
      104,
    );

    expect(watched).toMatchObject({ userId, movieId: 103, watchedAt });
    expect(otherUserUnchanged).toMatchObject({
      userId: otherUserId,
      movieId: 103,
      reaction: "DISLIKE",
      watchedAt: null,
    });
    expect(unwatched).toMatchObject({ userId, movieId: 103, watchedAt: null });
    expect(missing).toBeNull();
    expect(await repository.findByUserAndMovie(userId, 104)).toBeNull();
    expect(otherUserStillUnchanged).toMatchObject({
      userId: otherUserId,
      movieId: 104,
      reaction: "LIKE",
      watchedAt: null,
    });
  });

  it("findLikesByUser and findDislikesByUser cannot return another user data", async () => {
    const userId = getTask6AuthUserId(0);
    const otherUserId = getTask6AuthUserId(1);
    const repository = getUserMovieInteractionRepository();
    const rowsPerReaction = PAGE_SIZE + 1;
    const baseTimestamp = Date.parse("2026-04-01T00:00:00.000Z");
    const likeRows = Array.from({ length: rowsPerReaction }, (_, index) => ({
      userId,
      movieId: 1_000 + index,
      reaction: "LIKE" as const,
      updatedAt: new Date(baseTimestamp + index * 2_000),
    }));
    const dislikeRows = Array.from({ length: rowsPerReaction }, (_, index) => ({
      userId,
      movieId: 2_000 + index,
      reaction: "DISLIKE" as const,
      updatedAt: new Date(baseTimestamp + (index * 2 + 1) * 1_000),
    }));

    await getDatabase()
      .insert(userMovieInteractions)
      .values([
        ...likeRows,
        ...dislikeRows,
        {
          userId: otherUserId,
          movieId: likeRows[0]!.movieId,
          reaction: "LIKE",
          updatedAt: new Date(baseTimestamp + 100_000),
        },
        {
          userId: otherUserId,
          movieId: dislikeRows[0]!.movieId,
          reaction: "DISLIKE",
          updatedAt: new Date(baseTimestamp + 101_000),
        },
      ]);

    const expectedLikeIds = [...likeRows]
      .reverse()
      .map(({ movieId }) => movieId);
    const expectedDislikeIds = [...dislikeRows]
      .reverse()
      .map(({ movieId }) => movieId);
    const expectedInteractionIds = [...likeRows, ...dislikeRows]
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )
      .map(({ movieId }) => movieId);

    const interactionsDefault = await repository.findByUser(userId);
    const interactionsPageOne = await repository.findByUser(userId, 1);
    const interactionsPageTwo = await repository.findByUser(userId, 2);
    const interactionsPageThree = await repository.findByUser(userId, 3);
    const likesDefault = await repository.findLikesByUser(userId);
    const likesPageOne = await repository.findLikesByUser(userId, 1);
    const likesPageTwo = await repository.findLikesByUser(userId, 2);
    const dislikesDefault = await repository.findDislikesByUser(userId);
    const dislikesPageOne = await repository.findDislikesByUser(userId, 1);
    const dislikesPageTwo = await repository.findDislikesByUser(userId, 2);

    expect(interactionsDefault.map(({ movieId }) => movieId)).toEqual(
      expectedInteractionIds.slice(0, PAGE_SIZE),
    );
    expect(interactionsPageOne).toEqual(interactionsDefault);
    expect(interactionsPageOne).toHaveLength(PAGE_SIZE);
    expect(interactionsPageTwo.map(({ movieId }) => movieId)).toEqual(
      expectedInteractionIds.slice(PAGE_SIZE, PAGE_SIZE * 2),
    );
    expect(interactionsPageTwo).toHaveLength(PAGE_SIZE);
    expect(interactionsPageThree.map(({ movieId }) => movieId)).toEqual(
      expectedInteractionIds.slice(PAGE_SIZE * 2),
    );
    expect(interactionsPageThree).toHaveLength(2);

    const interactionIds = [
      ...interactionsPageOne,
      ...interactionsPageTwo,
      ...interactionsPageThree,
    ].map(({ movieId }) => movieId);
    expect(interactionIds).toEqual(expectedInteractionIds);
    expect(new Set(interactionIds).size).toBe(expectedInteractionIds.length);
    expect(
      [
        ...interactionsPageOne,
        ...interactionsPageTwo,
        ...interactionsPageThree,
      ].every((interaction) => interaction.userId === userId),
    ).toBe(true);

    expect(likesDefault.map(({ movieId }) => movieId)).toEqual(
      expectedLikeIds.slice(0, PAGE_SIZE),
    );
    expect(likesPageOne).toEqual(likesDefault);
    expect(likesPageOne).toHaveLength(PAGE_SIZE);
    expect(likesPageTwo.map(({ movieId }) => movieId)).toEqual(
      expectedLikeIds.slice(PAGE_SIZE),
    );
    expect(likesPageTwo).toHaveLength(1);
    const likeIds = [...likesPageOne, ...likesPageTwo].map(
      ({ movieId }) => movieId,
    );
    expect(likeIds).toEqual(expectedLikeIds);
    expect(new Set(likeIds).size).toBe(expectedLikeIds.length);
    expect(
      [...likesPageOne, ...likesPageTwo].every(
        (interaction) => interaction.userId === userId,
      ),
    ).toBe(true);

    expect(dislikesDefault.map(({ movieId }) => movieId)).toEqual(
      expectedDislikeIds.slice(0, PAGE_SIZE),
    );
    expect(dislikesPageOne).toEqual(dislikesDefault);
    expect(dislikesPageOne).toHaveLength(PAGE_SIZE);
    expect(dislikesPageTwo.map(({ movieId }) => movieId)).toEqual(
      expectedDislikeIds.slice(PAGE_SIZE),
    );
    expect(dislikesPageTwo).toHaveLength(1);
    const dislikeIds = [...dislikesPageOne, ...dislikesPageTwo].map(
      ({ movieId }) => movieId,
    );
    expect(dislikeIds).toEqual(expectedDislikeIds);
    expect(new Set(dislikeIds).size).toBe(expectedDislikeIds.length);
    expect(
      [...dislikesPageOne, ...dislikesPageTwo].every(
        (interaction) => interaction.userId === userId,
      ),
    ).toBe(true);
  });

  it("deleting an interaction removes reaction and watchedAt together", async () => {
    const userId = getTask6AuthUserId(0);
    const otherUserId = getTask6AuthUserId(1);
    const repository = getUserMovieInteractionRepository();
    const watchedAt = new Date("2026-03-10T09:15:00.000Z");
    const otherUserWatchedAt = new Date("2026-03-11T10:30:00.000Z");

    await repository.upsertReaction(userId, 109, "DISLIKE");
    await repository.upsertReaction(otherUserId, 109, "LIKE");
    await repository.setWatched(userId, 109, watchedAt);
    await repository.setWatched(otherUserId, 109, otherUserWatchedAt);

    expect(await repository.delete(userId, 109)).toBe(true);
    expect(await repository.findByUserAndMovie(userId, 109)).toBeNull();
    expect(await repository.findByUserAndMovie(otherUserId, 109)).toMatchObject(
      {
        userId: otherUserId,
        movieId: 109,
        reaction: "LIKE",
        watchedAt: otherUserWatchedAt,
      },
    );
    expect(await repository.delete(userId, 109)).toBe(false);
  });

  it("rejects a non-positive TMDB movie ID", async () => {
    const userId = getTask6AuthUserId(0);
    const repository = getUserMovieInteractionRepository();

    for (const invalidMovieId of [0, -1]) {
      await expectCheckConstraintViolation(
        repository.upsertReaction(userId, invalidMovieId, "LIKE"),
        "user_movie_interactions_movie_id_positive_check",
      );
      expect(
        await repository.findByUserAndMovie(userId, invalidMovieId),
      ).toBeNull();
    }
  });
});

describe("Task 7 repositories", () => {
  beforeAll(async () => {
    reviewRepository = new ReviewRepository(getDatabase());

    try {
      for (const displayName of ["Task 7 primary", "Task 7 secondary"]) {
        const authUser = await createTestAuthUser();
        task7AuthUserIds.push(authUser.id);
        await getUserRepository().create({
          id: authUser.id,
          displayName,
          avatarUrl: null,
        });
      }
    } catch {
      await cleanupTask7AuthUsers();
      throw new Error("Could not set up Task 7 fixtures");
    }
  });

  afterAll(async () => {
    if (!(await cleanupTask7AuthUsers())) {
      throw new Error("Could not clean up Task 7 Auth users");
    }
  });

  beforeEach(async () => {
    await getDatabase()
      .delete(reviews)
      .where(inArray(reviews.userId, task7AuthUserIds));
  });

  it("creates and finds one review per user and movie", async () => {
    const userId = getTask7AuthUserId(0);
    const otherUserId = getTask7AuthUserId(1);
    const repository = getReviewRepository();
    const movieId = 7_001;
    const input = {
      verdict: "RECOMMENDED" as const,
      title: "Strong recommendation",
      description: "A thoughtful community recommendation.",
    };

    const created = await repository.create(userId, movieId, input);
    const otherUserReview = await repository.create(otherUserId, movieId, {
      verdict: "NOT_WORTH_IT",
      title: "Different opinion",
      description: "The second viewer had a different experience.",
    });
    const sameUserOtherMovie = await repository.create(userId, movieId + 1, {
      verdict: "RECOMMENDED",
      title: "Another movie",
      description: "The same viewer reviewed a different movie too.",
    });

    await expectDatabaseViolation(repository.create(userId, movieId, input), {
      code: "23505",
      constraintName: "reviews_user_id_movie_id_unique",
    });

    expect(created).toMatchObject({ userId, movieId, ...input });
    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByUserAndMovie(userId, movieId)).toEqual(
      created,
    );
    expect(await repository.findByUserAndMovie(otherUserId, movieId)).toEqual(
      otherUserReview,
    );
    expect(await repository.findByUserAndMovie(userId, movieId + 1)).toEqual(
      sameUserOtherMovie,
    );
  });

  it("updates and deletes only when userId owns the review", async () => {
    const userId = getTask7AuthUserId(0);
    const otherUserId = getTask7AuthUserId(1);
    const repository = getReviewRepository();
    const previousUpdatedAt = new Date("2000-01-01T00:00:00.000Z");
    const created = await repository.create(userId, 7_002, {
      verdict: "RECOMMENDED",
      title: "Original review",
      description: "This is the original review description.",
    });
    const otherUserReview = await repository.create(otherUserId, 7_002, {
      verdict: "RECOMMENDED",
      title: "Other owner review",
      description: "This review belongs to the other fixture user.",
    });

    await getDatabase()
      .update(reviews)
      .set({ updatedAt: previousUpdatedAt })
      .where(eq(reviews.id, created.id));

    const wrongOwnerUpdate = await repository.update(otherUserId, created.id, {
      verdict: "NOT_WORTH_IT",
      title: "Unauthorized change",
      description: "This change must not be persisted by the repository.",
    });
    const unchanged = await repository.findById(created.id);
    const updated = await repository.update(userId, created.id, {
      verdict: "NOT_WORTH_IT",
      title: "Updated review",
      description: "The owner changed the community review content.",
    });
    const wrongOwnerDelete = await repository.delete(otherUserId, created.id);
    const otherUserUnchanged = await repository.findById(otherUserReview.id);

    expect(wrongOwnerUpdate).toBeNull();
    expect(unchanged).toMatchObject({
      userId,
      verdict: "RECOMMENDED",
      title: "Original review",
      updatedAt: previousUpdatedAt,
    });
    expect(updated).toMatchObject({
      id: created.id,
      userId,
      verdict: "NOT_WORTH_IT",
      title: "Updated review",
    });
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(
      previousUpdatedAt.getTime(),
    );
    expect(wrongOwnerDelete).toBe(false);
    expect(otherUserUnchanged).toEqual(otherUserReview);
    expect(await repository.findById(created.id)).toEqual(updated);
    expect(await repository.delete(userId, created.id)).toBe(true);
    expect(await repository.findById(created.id)).toBeNull();
    expect(await repository.delete(userId, created.id)).toBe(false);
  });

  it("upserts without creating a duplicate review", async () => {
    const userId = getTask7AuthUserId(0);
    const repository = getReviewRepository();
    const movieId = 7_003;
    const previousUpdatedAt = new Date("2000-01-01T00:00:00.000Z");
    const created = await repository.upsert(userId, movieId, {
      verdict: "RECOMMENDED",
      title: "Initial review",
      description: "This is the initial review description.",
    });

    await getDatabase()
      .update(reviews)
      .set({ updatedAt: previousUpdatedAt })
      .where(eq(reviews.id, created.id));

    const upserted = await repository.upsert(userId, movieId, {
      verdict: "NOT_WORTH_IT",
      title: "Replacement review",
      description: "This content replaces the initial review cleanly.",
    });
    const storedReviews = await getDatabase()
      .select()
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.movieId, movieId)));

    expect(upserted).toMatchObject({
      id: created.id,
      userId,
      movieId,
      verdict: "NOT_WORTH_IT",
      title: "Replacement review",
      description: "This content replaces the initial review cleanly.",
      createdAt: created.createdAt,
    });
    expect(upserted.updatedAt.getTime()).toBeGreaterThan(
      previousUpdatedAt.getTime(),
    );
    expect(storedReviews).toEqual([upserted]);
  });

  it("findByMovie returns community reviews with author data by page", async () => {
    const userId = getTask7AuthUserId(0);
    const otherUserId = getTask7AuthUserId(1);
    const repository = getReviewRepository();
    const movieId = 7_004;
    const older = await repository.create(userId, movieId, {
      verdict: "RECOMMENDED",
      title: "Older review",
      description: "This community review was created first.",
    });
    const newer = await repository.create(otherUserId, movieId, {
      verdict: "NOT_WORTH_IT",
      title: "Newer review",
      description: "This community review was created more recently.",
    });
    const unrelatedMovie = await repository.create(userId, movieId + 1, {
      verdict: "RECOMMENDED",
      title: "Unrelated movie",
      description: "This review must not appear for the selected movie.",
    });

    await getDatabase()
      .update(reviews)
      .set({ createdAt: new Date("2026-01-01T00:00:00.000Z") })
      .where(eq(reviews.id, older.id));
    await getDatabase()
      .update(reviews)
      .set({ createdAt: new Date("2026-01-02T00:00:00.000Z") })
      .where(eq(reviews.id, newer.id));
    await getDatabase()
      .update(reviews)
      .set({ createdAt: new Date("2026-01-03T00:00:00.000Z") })
      .where(eq(reviews.id, unrelatedMovie.id));

    const defaultPage = await repository.findByMovie(movieId);
    const firstPage = await repository.findByMovie(movieId, 1);
    const secondPage = await repository.findByMovie(movieId, 2);

    expect(defaultPage).toEqual(firstPage);
    expect(
      firstPage.map(({ review, author }) => ({
        reviewId: review.id,
        author,
      })),
    ).toEqual([
      {
        reviewId: newer.id,
        author: { displayName: "Task 7 secondary", avatarUrl: null },
      },
      {
        reviewId: older.id,
        author: { displayName: "Task 7 primary", avatarUrl: null },
      },
    ]);
    expect(firstPage[0]?.review).toMatchObject({
      movieId,
      verdict: "NOT_WORTH_IT",
      title: "Newer review",
    });
    expect(secondPage).toEqual([]);
  });

  it("countByVerdict aggregates both approved verdicts", async () => {
    const userId = getTask7AuthUserId(0);
    const otherUserId = getTask7AuthUserId(1);
    const repository = getReviewRepository();
    const movieId = 7_005;

    await repository.create(userId, movieId, {
      verdict: "RECOMMENDED",
      title: "Recommended review",
      description: "This viewer recommends the selected movie.",
    });
    await repository.create(otherUserId, movieId, {
      verdict: "NOT_WORTH_IT",
      title: "Critical review",
      description: "This viewer does not recommend the selected movie.",
    });

    expect(await repository.countByVerdict(movieId)).toEqual({
      recommended: 1,
      notWorthIt: 1,
    });
    expect(await repository.countByVerdict(7_006)).toEqual({
      recommended: 0,
      notWorthIt: 0,
    });
  });

  it("enforces title and description lengths in PostgreSQL", async () => {
    const userId = getTask7AuthUserId(0);
    const repository = getReviewRepository();
    const validInput = {
      verdict: "RECOMMENDED" as const,
      title: "Valid review",
      description: "This description has a valid database length.",
    };
    const invalidCases = [
      {
        movieId: 7_007,
        input: { ...validInput, title: "ab" },
        expected: {
          code: "23514",
          constraintName: "reviews_title_length_check",
        },
      },
      {
        movieId: 7_008,
        input: { ...validInput, title: "t".repeat(31) },
        expected: { code: "22001", constraintName: undefined },
      },
      {
        movieId: 7_009,
        input: { ...validInput, description: "d".repeat(9) },
        expected: {
          code: "23514",
          constraintName: "reviews_description_length_check",
        },
      },
      {
        movieId: 7_010,
        input: { ...validInput, description: "d".repeat(401) },
        expected: { code: "22001", constraintName: undefined },
      },
    ];

    for (const { movieId, input, expected } of invalidCases) {
      await expectDatabaseViolation(
        repository.create(userId, movieId, input),
        expected,
      );
      expect(await repository.findByUserAndMovie(userId, movieId)).toBeNull();
    }

    const minimum = await repository.create(userId, 7_011, {
      verdict: "RECOMMENDED",
      title: "abc",
      description: "d".repeat(10),
    });
    const maximum = await repository.create(userId, 7_012, {
      verdict: "NOT_WORTH_IT",
      title: "t".repeat(30),
      description: "d".repeat(400),
    });

    expect(minimum.title).toHaveLength(3);
    expect(minimum.description).toHaveLength(10);
    expect(maximum.title).toHaveLength(30);
    expect(maximum.description).toHaveLength(400);
  });
});
