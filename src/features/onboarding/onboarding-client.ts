import {
  CompleteOnboardingResponseSchema,
  type CompleteOnboardingRequest,
} from "@/contracts";
import { apiRequest } from "@/lib/api/client";

export async function completeOnboarding(input: CompleteOnboardingRequest) {
  const { data } = await apiRequest(
    "/api/onboarding",
    CompleteOnboardingResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return data;
}
