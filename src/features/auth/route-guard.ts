export type RouteGuardDecision =
  { type: "continue" } | { type: "redirect"; to: string };

export const SIGN_IN_PATH = "/login";
export const AUTHENTICATED_HOME_PATH = "/";
export const ONBOARDING_PATH = "/onboarding";

/** Route Handlers authorize themselves and must answer with a status code, so
 * redirecting them here would turn a 401 into an HTML login page. */
const API_PREFIX = "/api";

/** Reachable without a session. `/reset-password` is public because the user
 * arrives from the recovery link before the profile exists in context. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/confirm",
]);

/** Design gallery: no user data, so it stays reachable in either state. */
const PUBLIC_PREFIXES = ["/ui-foundation"];

/** Signing in again makes no sense while a session is live. `/reset-password`
 * is deliberately absent: the recovery link authenticates the user, and
 * redirecting them would make the password change unreachable. */
const GUEST_ONLY_PATHS = new Set(["/login", "/register", "/forgot-password"]);
const AUTHENTICATED_EXEMPT_PATHS = new Set(["/reset-password", "/confirm"]);

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

export function resolveRouteGuard(
  pathname: string,
  isAuthenticated: boolean,
  onboardingCompletedAt: Date | null | undefined = null,
): RouteGuardDecision {
  if (pathname.startsWith(API_PREFIX)) {
    return { type: "continue" };
  }

  if (isAuthenticated) {
    if (
      AUTHENTICATED_EXEMPT_PATHS.has(pathname) ||
      PUBLIC_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
      return { type: "continue" };
    }
    if (GUEST_ONLY_PATHS.has(pathname)) {
      return {
        type: "redirect",
        to:
          onboardingCompletedAt === null || onboardingCompletedAt === undefined
            ? ONBOARDING_PATH
            : AUTHENTICATED_HOME_PATH,
      };
    }

    if (onboardingCompletedAt === null || onboardingCompletedAt === undefined) {
      return pathname === ONBOARDING_PATH
        ? { type: "continue" }
        : { type: "redirect", to: ONBOARDING_PATH };
    }

    return pathname === ONBOARDING_PATH
      ? { type: "redirect", to: AUTHENTICATED_HOME_PATH }
      : { type: "continue" };
  }

  return isPublicPath(pathname)
    ? { type: "continue" }
    : { type: "redirect", to: SIGN_IN_PATH };
}
