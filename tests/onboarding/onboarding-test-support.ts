import { loadTestEnvironmentFile } from "../integration/support/env";
import {
  deleteTestAuthUserByEmail,
  TEST_EMAIL_DOMAIN,
  TEST_EMAIL_PREFIX,
} from "../integration/support/identity";
import { createStandaloneTestDatabase } from "../integration/support/standalone-database";

import type { OnboardingTestUser } from "./onboarding-page";

// Same explicit, isolated target as the Playwright config: never `.env.local`.
loadTestEnvironmentFile();

export function createOnboardingTestUser(): OnboardingTestUser {
  const id = crypto.randomUUID();

  return {
    username: `e2e_${id.replaceAll("-", "").slice(0, 16)}`,
    email: `${TEST_EMAIL_PREFIX}onboarding-${id}@${TEST_EMAIL_DOMAIN}`,
    password: `Onboarding-${id}A1`,
  };
}

/** Removes the one generated account (and what cascades from it). */
export async function cleanupOnboardingTestUser(email: string): Promise<void> {
  const connection = createStandaloneTestDatabase();

  try {
    const cleanup = await deleteTestAuthUserByEmail(connection.db, email);

    if (cleanup.authUserPresentAfterCleanup) {
      throw new Error("Could not clean up onboarding E2E Auth user");
    }
  } finally {
    await connection.close();
  }
}
