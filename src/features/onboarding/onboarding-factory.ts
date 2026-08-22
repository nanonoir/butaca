import "server-only";

import { getDatabase } from "@/db";

import { OnboardingService } from "./onboarding-service";

export function getOnboardingService(): OnboardingService {
  return new OnboardingService(getDatabase());
}
