import { redirect } from "next/navigation";

import { getServerAuthService } from "@/features/auth/server-auth-factory";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";

export default async function OnboardingPage() {
  const session = await (await getServerAuthService()).getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.onboardingCompletedAt) {
    redirect("/");
  }

  return <OnboardingScreen />;
}
