import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/db";
import { UserRepository } from "@/db/repositories";
import { resolveRouteGuard } from "@/features/auth/route-guard";
import { updateSession } from "@/integrations/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated, userId } = await updateSession(request);
  let onboardingCompletedAt: Date | null | undefined = null;

  if (userId) {
    try {
      const user = await new UserRepository(getDatabase()).findById(userId);
      onboardingCompletedAt = user?.onboardingCompletedAt;
    } catch {
      // A profile lookup failure must never unlock product routes.
      onboardingCompletedAt = null;
    }
  }

  const decision = resolveRouteGuard(
    request.nextUrl.pathname,
    isAuthenticated,
    onboardingCompletedAt,
  );

  if (decision.type === "continue") {
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = decision.to;
  redirectUrl.search = "";

  const redirectResponse = NextResponse.redirect(redirectUrl);

  // The session may have been rotated while resolving the claims. Dropping the
  // refreshed cookies here would sign the user out on every guarded redirect.
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
