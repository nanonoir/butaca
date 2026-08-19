import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import {
  UserMovieInteractionRepository,
  UserPreferencesRepository,
  UserRepository,
} from "../../src/db/repositories";
import {
  userMovieInteractions,
  userPreferences,
  users,
} from "../../src/db/schema";
import { createIntegrationDatabase } from "./support/database";
import {
  createTestAuthUser,
  deleteTestAuthUser,
} from "./support/supabase";

let database: ReturnType<typeof createIntegrationDatabase> | undefined;
let userRepository: UserRepository | undefined;
let userPreferencesRepository: UserPreferencesRepository | undefined;
let userMovieInteractionRepository:
  | UserMovieInteractionRepository
  | undefined;
const task6AuthUserIds: string[] = [];

beforeAll(async () => {
  database = createIntegrationDatabase();
  userRepository = new UserRepository(database.db);
  userPreferencesRepository = new UserPreferencesRepository(database.db);
  userMovieInteractionRepository = new UserMovieInteractionRepository(
    database.db,
  );

  for (const displayName of ["Task 6 primary", "Task 6 secondary"]) {
    const authUser = await createTestAuthUser();
    task6AuthUserIds.push(authUser.id);
    await userRepository.create({
      id: authUser.id,
      displayName,
      avatarUrl: null,
    });
  }
});

afterAll(async () => {
  const cleanupResults = await Promise.allSettled(
    task6AuthUserIds.map((userId) => deleteTestAuthUser(userId)),
  );
  await database?.close();

  if (cleanupResults.some((result) => result.status === "rejected")) {
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

function getTask6AuthUserId(index: number) {
  const userId = task6AuthUserIds[index];

  if (!userId) {
    throw new Error("Task 6 Auth user was not created");
  }

  return userId;
}

async function expectCheckConstraintViolation(
  operation: Promise<unknown>,
  constraintName: string,
) {
  let databaseError:
    | { code: unknown; constraintName: unknown }
    | undefined;

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

  expect(databaseError).toEqual({ code: "23514", constraintName });
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

  await expectCheckConstraintViolation(
    repository.create(userId, [28, 0]),
    "user_preferences_positive_genres_check",
  );
  expect(await repository.findByUserId(userId)).toBeNull();
});

it("creates a LIKE with watchedAt null", async () => {
  const userId = getTask6AuthUserId(0);
  const repository = getUserMovieInteractionRepository();

  const created = await repository.upsertReaction(userId, 101, "LIKE");

  expect(created).toMatchObject({
    userId,
    movieId: 101,
    reaction: "LIKE",
    watchedAt: null,
  });
  expect(await repository.findByUserAndMovie(userId, 101)).toEqual(created);
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
  const repository = getUserMovieInteractionRepository();
  const watchedAt = new Date("2026-02-20T18:30:00.000Z");

  await repository.upsertReaction(userId, 103, "LIKE");

  const watched = await repository.setWatched(userId, 103, watchedAt);
  const unwatched = await repository.setWatched(userId, 103, null);
  const missing = await repository.setWatched(userId, 104, watchedAt);

  expect(watched?.watchedAt).toEqual(watchedAt);
  expect(unwatched?.watchedAt).toBeNull();
  expect(missing).toBeNull();
  expect(await repository.findByUserAndMovie(userId, 104)).toBeNull();
});

it("findLikesByUser and findDislikesByUser cannot return another user data", async () => {
  const userId = getTask6AuthUserId(0);
  const otherUserId = getTask6AuthUserId(1);
  const repository = getUserMovieInteractionRepository();

  await repository.upsertReaction(userId, 105, "LIKE");
  await repository.upsertReaction(userId, 106, "DISLIKE");
  await repository.upsertReaction(otherUserId, 107, "LIKE");
  await repository.upsertReaction(otherUserId, 108, "DISLIKE");

  const interactions = await repository.findByUser(userId);
  const likes = await repository.findLikesByUser(userId);
  const dislikes = await repository.findDislikesByUser(userId);

  expect(interactions.map(({ movieId }) => movieId).sort()).toEqual([105, 106]);
  expect(likes).toHaveLength(1);
  expect(likes[0]).toMatchObject({ userId, movieId: 105, reaction: "LIKE" });
  expect(dislikes).toHaveLength(1);
  expect(dislikes[0]).toMatchObject({
    userId,
    movieId: 106,
    reaction: "DISLIKE",
  });
});

it("deleting an interaction removes reaction and watchedAt together", async () => {
  const userId = getTask6AuthUserId(0);
  const repository = getUserMovieInteractionRepository();

  await repository.upsertReaction(userId, 109, "DISLIKE");
  await repository.setWatched(
    userId,
    109,
    new Date("2026-03-10T09:15:00.000Z"),
  );

  expect(await repository.delete(userId, 109)).toBe(true);
  expect(await repository.findByUserAndMovie(userId, 109)).toBeNull();
  expect(await repository.delete(userId, 109)).toBe(false);
});

it("rejects a non-positive TMDB movie ID", async () => {
  const userId = getTask6AuthUserId(0);
  const repository = getUserMovieInteractionRepository();

  await expectCheckConstraintViolation(
    repository.upsertReaction(userId, 0, "LIKE"),
    "user_movie_interactions_movie_id_positive_check",
  );
  expect(await repository.findByUserAndMovie(userId, 0)).toBeNull();
});
