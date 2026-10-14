import "server-only";

import { z } from "zod";

// Read lazily, at runtime only. Nothing here is available to `next build`, and
// nothing here may be passed as a build argument.
const ServerEnvSchema = z.object({
  DATABASE_URL: z.url(),
  TMDB_ACCESS_TOKEN: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),
});

type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parseServerEnv(source: Partial<NodeJS.ProcessEnv>) {
  const result = ServerEnvSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    TMDB_ACCESS_TOKEN: source.TMDB_ACCESS_TOKEN,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    RESEND_API_KEY: source.RESEND_API_KEY,
    RESEND_FROM_EMAIL: source.RESEND_FROM_EMAIL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}

const DatabaseEnvSchema = ServerEnvSchema.pick({ DATABASE_URL: true });

/** Validates only DATABASE_URL, so database readiness does not depend on the
 * mail, TMDB or auth configuration. */
export function parseDatabaseUrl(source: Partial<NodeJS.ProcessEnv>) {
  const result = DatabaseEnvSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data.DATABASE_URL;
}

export function getDatabaseUrl() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment is not available in the browser");
  }

  return parseDatabaseUrl(process.env);
}

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment is not available in the browser");
  }

  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}
