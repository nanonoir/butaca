import { config } from "dotenv";

import { deleteTestAuthUserByEmail } from "../integration/support/supabase";

import type { OnboardingTestUser } from "./onboarding-page";

config({ path: ".env.local", quiet: true });
config({ path: ".env.integration.local", override: true, quiet: true });

export function createOnboardingTestUser(): OnboardingTestUser {
  const id = crypto.randomUUID();

  return {
    username: `e2e_${id.replaceAll("-", "").slice(0, 16)}`,
    email: `filmmatch-onboarding-${id}@example.test`,
    password: `Onboarding-${id}A1`,
  };
}

export async function cleanupOnboardingTestUser(email: string): Promise<void> {
  const cleanup = await deleteTestAuthUserByEmail(email);

  if (cleanup.authUserPresentAfterCleanup) {
    throw new Error("Could not clean up onboarding E2E Auth user");
  }
}
