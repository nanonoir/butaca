import type { FullConfig } from "@playwright/test";

/** Fails before any spec runs when nothing healthy answers on the target, so a
 * missing or wrong server never looks like a wall of unrelated failures. The
 * isolation of the database itself is enforced by the config and the support
 * helpers; this only proves the app is up. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;

  if (!baseURL) {
    throw new Error("Playwright baseURL is not configured");
  }

  let status: number | undefined;

  try {
    status = (await fetch(new URL("/api/health", baseURL))).status;
  } catch {
    // Reported below with a single, actionable message.
  }

  if (status !== 200) {
    throw new Error(
      "No healthy Butaca server answered on the configured local origin. " +
        "Start an isolated production build first, or set PLAYWRIGHT_START_SERVER=1.",
    );
  }
}
