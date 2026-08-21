import { NextResponse, type NextRequest } from "next/server";

import { resolveRouteGuard } from "@/features/auth/route-guard";
import { updateSession } from "@/integrations/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const decision = resolveRouteGuard(request.nextUrl.pathname, isAuthenticated);

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
