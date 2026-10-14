import { defineConfig } from "@playwright/test";

import {
  assertLocalOrigin,
  getIntegrationEnv,
  loadTestEnvironmentFile,
} from "./tests/integration/support/env";

// E2E registers real accounts and cleans them up through the database, so it
// only ever runs against an explicitly selected, isolated test target. There is
// no `.env`/`.env.local` fallback: BUTACA_TEST_ENV_FILE (or exported variables)
// must provide BUTACA_TEST_DATABASE=1 and a local butaca_*test* database.
loadTestEnvironmentFile();

const env = getIntegrationEnv();

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? env.BETTER_AUTH_URL;

assertLocalOrigin(baseURL, "PLAYWRIGHT_BASE_URL");

// Cookies and trusted origins are bound to BETTER_AUTH_URL, so a browser on any
// other origin would fail in confusing ways. Fail fast instead.
if (new URL(baseURL).origin !== new URL(env.BETTER_AUTH_URL).origin) {
  throw new Error("PLAYWRIGHT_BASE_URL must match the BETTER_AUTH_URL origin");
}

const testClientAddress = `198.51.100.${1 + Math.floor(Math.random() * 253)}`;

// Starting (or reusing) a server from here is opt-in. By default the suite
// expects the caller to have started an isolated production build already and
// verifies it through /api/health in the global setup.
const startServer = process.env.PLAYWRIGHT_START_SERVER === "1";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  // Without this, the default testMatch also collects the Vitest integration
  // suite that lives under tests/integration and runs on its own runner.
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e-global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    // The auth rate limiter keys on the proxy-reported address and lives in the
    // server's memory, so repeated runs against one server would otherwise
    // share a single bucket and trip RATE_LIMITED. Each worker presents its own
    // documentation-range address (RFC 5737); production traffic is unaffected.
    extraHTTPHeaders: {
      "x-forwarded-for": testClientAddress,
      // APIRequestContext is not a browser and does not supply Origin itself.
      origin: new URL(baseURL).origin,
    },
    trace: "on-first-retry",
  },
  // A production build, not `pnpm dev`: these specs exercise hydrated forms,
  // and the dev server is the wrong target for that.
  webServer: startServer
    ? {
        command: `pnpm build && pnpm start --port ${new URL(baseURL).port || "3100"}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer,
        timeout: 300_000,
      }
    : undefined,
});
