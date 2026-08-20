import { z } from "zod";

const IntegrationEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  DATABASE_MIGRATION_URL: z.url(),
  TMDB_ACCESS_TOKEN: z.string().min(1),
  SUPABASE_TEST_SECRET_KEY: z.string().min(1),
});

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parseIntegrationEnv(source: Partial<NodeJS.ProcessEnv>) {
  const result = IntegrationEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DATABASE_URL: source.DATABASE_URL,
    DATABASE_MIGRATION_URL: source.DATABASE_MIGRATION_URL,
    TMDB_ACCESS_TOKEN: source.TMDB_ACCESS_TOKEN,
    SUPABASE_TEST_SECRET_KEY: source.SUPABASE_TEST_SECRET_KEY,
  });

  if (!result.success) {
    throw new Error(
      `Invalid integration environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}

export function getIntegrationEnv() {
  return parseIntegrationEnv(process.env);
}
