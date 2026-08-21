import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  // Without this, the default testMatch also collects the Vitest integration
  // suite that lives under tests/integration and runs on its own runner.
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // A production build, not `pnpm dev`: these specs exercise hydrated forms,
  // and the dev server is the wrong target for that. Point
  // PLAYWRIGHT_BASE_URL at an already running server to skip the build.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
