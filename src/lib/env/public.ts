import { z } from "zod";

export const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parsePublicEnv(source: Partial<NodeJS.ProcessEnv>) {
  const result = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new Error(
      `Invalid public environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}

export function getPublicEnv() {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
