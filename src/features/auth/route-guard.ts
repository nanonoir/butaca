export type RouteGuardDecision =
  { type: "continue" } | { type: "redirect"; to: string };

export const SIGN_IN_PATH = "/login";
export const AUTHENTICATED_HOME_PATH = "/";

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
): RouteGuardDecision {
  if (pathname.startsWith(API_PREFIX)) {
    return { type: "continue" };
  }

  if (isAuthenticated) {
    return GUEST_ONLY_PATHS.has(pathname)
      ? { type: "redirect", to: AUTHENTICATED_HOME_PATH }
      : { type: "continue" };
  }

  return isPublicPath(pathname)
    ? { type: "continue" }
    : { type: "redirect", to: SIGN_IN_PATH };
}
