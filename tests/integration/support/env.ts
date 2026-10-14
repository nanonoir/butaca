import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import { z } from "zod";

/**
 * Every integration/E2E run must be pointed at an isolated, throwaway
 * PostgreSQL explicitly. Nothing here falls back to `.env`, `.env.local` or the
 * application's private environment: the only file that is ever read is the one
 * named by BUTACA_TEST_ENV_FILE, and values are never printed.
 */
export const TEST_ENV_FILE_VARIABLE = "BUTACA_TEST_ENV_FILE";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Database names must say what they are: `butaca_<anything>test<anything>`. */
const TEST_DATABASE_NAME = /^butaca_[a-z0-9_]*test[a-z0-9_]*$/;

const IntegrationEnvSchema = z.object({
  BUTACA_TEST_DATABASE: z.literal("1"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_MIGRATION_URL: z.url().optional(),
  TMDB_ACCESS_TOKEN: z.string().min(1).optional(),
  BUTACA_TEST_TMDB_LIVE: z.string().optional(),
  BUTACA_TEST_DATABASE_HOSTS: z.string().optional(),
});

export type IntegrationEnv = z.infer<typeof IntegrationEnvSchema>;

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

/** Hosts other than loopback (for example a Compose service name) must be
 * listed explicitly; this is the only way to widen the guard. */
function allowedHosts(extra: string | undefined): Set<string> {
  const hosts = new Set(LOCAL_DATABASE_HOSTS);

  for (const host of (extra ?? "").split(",")) {
    const trimmed = host.trim().toLowerCase();

    if (trimmed) {
      hosts.add(trimmed);
    }
  }

  return hosts;
}

/** Throws when the URL does not point at an isolated test database. The error
 * names the failed rule, never the URL or its credentials. */
export function assertIsolatedDatabaseUrl(
  rawUrl: string,
  extraHosts?: string,
): void {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Test database URL is not a valid URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Test database URL must use the postgres protocol");
  }

  if (!allowedHosts(extraHosts).has(url.hostname.toLowerCase())) {
    throw new Error("Test database host is not an isolated local host");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error("Test database name must match butaca_*test*");
  }
}

/** Origins the E2E browser and the auth baseURL may use. */
export function assertLocalOrigin(rawUrl: string, label: string): void {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }

  if (!LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`${label} must be a local origin`);
  }
}

export function parseIntegrationEnv(
  source: Partial<NodeJS.ProcessEnv>,
): IntegrationEnv {
  const result = IntegrationEnvSchema.safeParse({
    BUTACA_TEST_DATABASE: source.BUTACA_TEST_DATABASE,
    DATABASE_URL: source.DATABASE_URL,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    DATABASE_MIGRATION_URL: source.DATABASE_MIGRATION_URL || undefined,
    TMDB_ACCESS_TOKEN: source.TMDB_ACCESS_TOKEN || undefined,
    BUTACA_TEST_TMDB_LIVE: source.BUTACA_TEST_TMDB_LIVE,
    BUTACA_TEST_DATABASE_HOSTS: source.BUTACA_TEST_DATABASE_HOSTS,
  });

  if (!result.success) {
    throw new Error(
      `Invalid integration environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  const env = result.data;

  assertIsolatedDatabaseUrl(env.DATABASE_URL, env.BUTACA_TEST_DATABASE_HOSTS);

  if (env.DATABASE_MIGRATION_URL) {
    assertIsolatedDatabaseUrl(
      env.DATABASE_MIGRATION_URL,
      env.BUTACA_TEST_DATABASE_HOSTS,
    );
  }

  assertLocalOrigin(env.BETTER_AUTH_URL, "BETTER_AUTH_URL");

  return env;
}

/** Loads ONLY the file named by BUTACA_TEST_ENV_FILE (never overriding what the
 * caller already exported). No file means the caller must have exported every
 * variable itself. */
export function loadTestEnvironmentFile(): void {
  const file = process.env[TEST_ENV_FILE_VARIABLE];

  if (!file) {
    return;
  }

  const path = resolve(file);

  if (!existsSync(path)) {
    throw new Error(`${TEST_ENV_FILE_VARIABLE} does not point at a file`);
  }

  config({ path, override: false, quiet: true });
}

export function getIntegrationEnv(): IntegrationEnv {
  return parseIntegrationEnv(process.env);
}

/** Live TMDB checks hit the real network and need a real token, so they only
 * run when explicitly requested. */
export function isLiveTmdbEnabled(): boolean {
  const env = getIntegrationEnv();

  return env.BUTACA_TEST_TMDB_LIVE === "1" && Boolean(env.TMDB_ACCESS_TOKEN);
}
