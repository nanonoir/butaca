import { describe, expect, it } from "vitest";

import { config } from "./proxy";

/** The matcher is a string Next compiles itself, and nothing here had ever
 * exercised it. A path that slips through the negative lookahead reaches the
 * guard, and the guard answers an unauthenticated request with a redirect to
 * the sign-in page -- which is the wrong answer for a browser asking for an
 * icon or a manifest. */
function isGuarded(pathname: string): boolean {
  return new RegExp(`^${config.matcher[0]}$`).test(pathname);
}

describe("proxy matcher", () => {
  it("guards the pages a session is meant to gate", () => {
    for (const pathname of ["/", "/liked", "/ai", "/profile", "/onboarding"]) {
      expect(isGuarded(pathname)).toBe(true);
    }
  });

  it("lets a browser fetch the icons and the manifest without a session", () => {
    for (const pathname of [
      "/favicon.ico",
      "/manifest.webmanifest",
      "/favicon/favicon-16x16.png",
      "/favicon/favicon-32x32.png",
      "/favicon/apple-touch-icon.png",
      "/favicon/android-chrome-192x192.png",
      "/favicon/android-chrome-512x512.png",
    ]) {
      expect(isGuarded(pathname)).toBe(false);
    }
  });

  it("stays out of the way of build output", () => {
    expect(isGuarded("/_next/static/chunks/main.js")).toBe(false);
    expect(isGuarded("/_next/image")).toBe(false);
  });

  it("leaves the other public artwork alone", () => {
    for (const pathname of ["/tmdb-logo.svg", "/globe.svg", "/next.svg"]) {
      expect(isGuarded(pathname)).toBe(false);
    }
  });
});
