import { describe, expect, it } from "vitest";

import { resolveRouteGuard } from "./route-guard";

const GUEST = false;
const AUTHENTICATED = true;

describe("resolveRouteGuard for a guest", () => {
  it("sends every product route to the sign-in page", () => {
    for (const pathname of [
      "/",
      "/liked",
      "/ai",
      "/profile",
      "/profile/preferences",
    ]) {
      expect(resolveRouteGuard(pathname, GUEST)).toEqual({
        type: "redirect",
        to: "/login",
      });
    }
  });

  it("lets every auth route through", () => {
    for (const pathname of [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/confirm",
    ]) {
      expect(resolveRouteGuard(pathname, GUEST)).toEqual({ type: "continue" });
    }
  });

  it("keeps the design gallery reachable", () => {
    expect(resolveRouteGuard("/ui-foundation", GUEST)).toEqual({
      type: "continue",
    });
  });
});

describe("resolveRouteGuard for an authenticated user", () => {
  it("keeps every product route reachable", () => {
    for (const pathname of ["/", "/liked", "/ai", "/profile"]) {
      expect(resolveRouteGuard(pathname, AUTHENTICATED)).toEqual({
        type: "continue",
      });
    }
  });

  it("redirects away from the routes that only make sense as a guest", () => {
    for (const pathname of ["/login", "/register", "/forgot-password"]) {
      expect(resolveRouteGuard(pathname, AUTHENTICATED)).toEqual({
        type: "redirect",
        to: "/",
      });
    }
  });

  it("keeps reset-password reachable because the recovery link authenticates", () => {
    expect(resolveRouteGuard("/reset-password", AUTHENTICATED)).toEqual({
      type: "continue",
    });
  });
});

describe("resolveRouteGuard for API routes", () => {
  it("never redirects an API request in either session state", () => {
    for (const pathname of ["/api/login", "/api/logout", "/api/movies/1"]) {
      expect(resolveRouteGuard(pathname, GUEST)).toEqual({ type: "continue" });
      expect(resolveRouteGuard(pathname, AUTHENTICATED)).toEqual({
        type: "continue",
      });
    }
  });
});
