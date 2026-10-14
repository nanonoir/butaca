import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/db";
import { UserRepository } from "@/db/repositories";
import { resolveRouteGuard } from "@/features/auth/route-guard";
import { getSessionWithHeaders } from "@/integrations/better-auth";

const API_PREFIX = "/api";
const SERVICE_UNAVAILABLE_RETRY_SECONDS = "5";

/** Route Handlers authorize themselves and `/api/health` must answer without
 * touching the database, so none of them pays for a session lookup here. */
function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/** A database outage must neither unlock product routes nor pose as a signed-out
 * visitor: redirecting to the sign-in page would loop for a signed-in user. */
function serviceUnavailable(): NextResponse {
  return new NextResponse("Service temporarily unavailable", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": SERVICE_UNAVAILABLE_RETRY_SECONDS,
    },
  });
}

/** The session may have been renewed while it was resolved. Dropping the
 * refreshed cookie would let the browser copy expire before the stored session
 * does. */
function forwardSetCookies(from: Headers | undefined, to: NextResponse): void {
  for (const cookie of from?.getSetCookie() ?? []) {
    to.headers.append("set-cookie", cookie);
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isApiPath(pathname)) {
    return NextResponse.next();
  }

  let isAuthenticated = false;
  let onboardingCompletedAt: Date | null | undefined = null;
  let sessionHeaders: Headers | undefined;

  try {
    const session = await getSessionWithHeaders(request.headers);

    if (session) {
      isAuthenticated = true;
      sessionHeaders = session.responseHeaders;

      const user = await new UserRepository(getDatabase()).findById(
        session.userId,
      );

      // A valid session without a profile is not a pending onboarding.
      if (!user) {
        return serviceUnavailable();
      }

      onboardingCompletedAt = user.onboardingCompletedAt;
    }
  } catch {
    return serviceUnavailable();
  }

  const decision = resolveRouteGuard(
    pathname,
    isAuthenticated,
    onboardingCompletedAt,
  );

  if (decision.type === "continue") {
    const response = NextResponse.next();
    forwardSetCookies(sessionHeaders, response);

    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = decision.to;
  redirectUrl.search = "";

  const redirectResponse = NextResponse.redirect(redirectUrl);
  forwardSetCookies(sessionHeaders, redirectResponse);

  return redirectResponse;
}

/** `manifest.webmanifest` is named here for the same reason `favicon.ico` is:
 * the guard would answer a browser asking for it with a redirect to the sign-in
 * page, and a manifest has to be readable before anyone signs in. The icons it
 * points at are already covered by the image extensions. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
