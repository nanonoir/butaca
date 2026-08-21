import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

const productRoutes = [
  "ai",
  "about",
  "liked",
  "profile",
  "profile/preferences",
  "ui-foundation",
];

const authRoutes = ["forgot-password", "login", "register", "reset-password"];

describe("App Router route groups", () => {
  it("renders / through the product layout", () => {
    expect(existsSync(`${appDirectory}/(app)/page.tsx`)).toBe(true);
    expect(existsSync(`${appDirectory}/page.tsx`)).toBe(false);
  });

  it.each(productRoutes)("renders /%s through the product layout", (route) => {
    expect(existsSync(`${appDirectory}/(app)/${route}/page.tsx`)).toBe(true);
    expect(existsSync(`${appDirectory}/${route}/page.tsx`)).toBe(false);
  });

  it.each(authRoutes)("keeps /%s outside the product layout", (route) => {
    expect(existsSync(`${appDirectory}/(auth)/${route}/page.tsx`)).toBe(true);
    expect(existsSync(`${appDirectory}/(app)/${route}/page.tsx`)).toBe(false);
  });
});
