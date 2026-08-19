import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { users } from "../../src/db/schema/users";
import { UserRepository } from "../../src/db/repositories";
import { createIntegrationDatabase } from "./support/database";
import {
  createTestAuthUser,
  deleteTestAuthUser,
} from "./support/supabase";

let database: ReturnType<typeof createIntegrationDatabase> | undefined;
let userRepository: UserRepository | undefined;

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
