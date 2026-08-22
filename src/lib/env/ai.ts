import "server-only";

import { z } from "zod";

const AiEnvSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
});

type AiEnv = z.infer<typeof AiEnvSchema>;

let cachedAiEnv: AiEnv | undefined;

const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parseAiEnv(source: Partial<NodeJS.ProcessEnv>) {
  const result = AiEnvSchema.safeParse({
    GOOGLE_GENERATIVE_AI_API_KEY: source.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  if (!result.success) {
    throw new Error(
      `Invalid AI environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}

/** Kept out of the server environment on purpose. The assistant is one feature,
 * so a missing key must fail the chat rather than take down Discover, Auth and
 * everything else that shares `getServerEnv()`. */
export function getAiEnv() {
  if (typeof window !== "undefined") {
    throw new Error("AI environment is not available in the browser");
  }

  cachedAiEnv ??= parseAiEnv(process.env);
  return cachedAiEnv;
}
