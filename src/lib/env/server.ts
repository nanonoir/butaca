import { z } from "zod";

import { PublicEnvSchema } from "./public";

const ServerEnvSchema = PublicEnvSchema.extend({
  DATABASE_URL: z.url(),
  TMDB_ACCESS_TOKEN: z.string().min(1),
});

type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parseServerEnv(source: Partial<NodeJS.ProcessEnv>) {
  const result = ServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DATABASE_URL: source.DATABASE_URL,
    TMDB_ACCESS_TOKEN: source.TMDB_ACCESS_TOKEN,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment is not available in the browser");
  }

  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}
