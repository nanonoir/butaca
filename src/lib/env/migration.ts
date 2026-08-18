import { z } from "zod";

const MigrationEnvSchema = z.object({
  DATABASE_MIGRATION_URL: z.url(),
});

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parseMigrationEnv(source: Partial<NodeJS.ProcessEnv>) {
  const result = MigrationEnvSchema.safeParse({
    DATABASE_MIGRATION_URL: source.DATABASE_MIGRATION_URL,
  });

  if (!result.success) {
    throw new Error(
      `Invalid migration environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}
