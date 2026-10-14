import { eq } from "drizzle-orm";

import type { Database } from "../../../src/db/client";
import { authUser, authVerification, users } from "../../../src/db/schema";

/** Every identity created by the tests carries this prefix and domain, and the
 * cleanup helpers refuse anything else: they can only ever remove rows the
 * suite itself generated. */
export const TEST_EMAIL_PREFIX = "butaca-test-";
export const TEST_EMAIL_DOMAIN = "example.test";

export function generateTestEmail(label = "user"): string {
  return `${TEST_EMAIL_PREFIX}${label}-${crypto.randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

export function generateTestPassword(): string {
  return `Test-${crypto.randomUUID()}-A1`;
}

function assertTestEmail(email: string): void {
  if (
    !email.startsWith(TEST_EMAIL_PREFIX) ||
    !email.endsWith(`@${TEST_EMAIL_DOMAIN}`)
  ) {
    throw new Error("Refusing to touch an identity the tests did not create");
  }
}

export type TestAuthUser = { id: string; email: string };

/**
 * Inserts an identity directly into `auth_user`. The database trigger creates
 * the matching `users` profile in the same statement, so the returned user is
 * ready for the repository tests. `profile: "absent"` removes that profile to
 * exercise the paths that create or repair it.
 */
export async function createTestAuthUser(
  db: Database,
  options: { displayName?: string; profile?: "trigger" | "absent" } = {},
): Promise<TestAuthUser> {
  const email = generateTestEmail("identity");
  const [created] = await db
    .insert(authUser)
    .values({ name: options.displayName ?? "Integration user", email })
    .returning({ id: authUser.id, email: authUser.email });

  if (!created) {
    throw new Error("Could not create test auth user");
  }

  if (options.profile === "absent") {
    await db.delete(users).where(eq(users.id, created.id));
  }

  return created;
}

/** Removes one generated identity. Profile, preferences, interactions,
 * reviews, sessions and accounts follow by cascade. */
export async function deleteTestAuthUser(
  db: Database,
  userId: string,
): Promise<void> {
  const [target] = await db
    .select({ email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, userId));

  if (!target) {
    return;
  }

  assertTestEmail(target.email);
  await deleteTestVerifications(db, userId);
  await db.delete(authUser).where(eq(authUser.id, userId));
}

/** `auth_verification` has no foreign key: reset tokens reference the user only
 * through `value`, so they are removed explicitly and by that owner alone. */
async function deleteTestVerifications(db: Database, userId: string) {
  await db.delete(authVerification).where(eq(authVerification.value, userId));
}

/** Removes the generated identity registered under `email`, plus any
 * verification rows addressed to it. Reports whether the identity is gone. */
export async function deleteTestAuthUserByEmail(
  db: Database,
  email: string,
): Promise<{ deleted: boolean; authUserPresentAfterCleanup: boolean }> {
  assertTestEmail(email);

  const [target] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email));

  if (!target) {
    return { deleted: false, authUserPresentAfterCleanup: false };
  }

  await deleteTestVerifications(db, target.id);
  await db.delete(authUser).where(eq(authUser.id, target.id));

  const [remaining] = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email));

  return { deleted: true, authUserPresentAfterCleanup: Boolean(remaining) };
}
