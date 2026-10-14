import { z } from "zod";

const AuthRuntimeEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).optional(),
});

export type AuthRuntimeConfig = {
  secret: string;
  /** Canonical origin used for cookies, trusted origins and email links. */
  baseURL: string;
  resend: { apiKey: string | undefined; from: string | undefined };
};

const emptyToUndefined = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value;

/** Reads the runtime-only auth variables. Values are never logged and nothing
 * here runs at build time; the error names the invalid keys, not the values. */
export function parseAuthRuntimeConfig(
  source: Partial<NodeJS.ProcessEnv>,
): AuthRuntimeConfig {
  const result = AuthRuntimeEnvSchema.safeParse({
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    RESEND_API_KEY: emptyToUndefined(source.RESEND_API_KEY),
    RESEND_FROM_EMAIL: emptyToUndefined(source.RESEND_FROM_EMAIL),
  });

  if (!result.success) {
    const keys = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");

    throw new Error(`Invalid auth environment: ${keys}`);
  }

  return {
    secret: result.data.BETTER_AUTH_SECRET,
    baseURL: new URL(result.data.BETTER_AUTH_URL).origin,
    resend: {
      apiKey: result.data.RESEND_API_KEY,
      from: result.data.RESEND_FROM_EMAIL,
    },
  };
}

/** Path the verification email points at. The page behind it calls
 * `verifyEmail(token)`; Better Auth's own `/api/auth/verify-email` link is not
 * used so the product keeps ownership of the URL. */
export const VERIFY_EMAIL_PATH = "/verify-email";

/** Fallback when a reset request carries no redirect (the application always
 * supplies one). */
export const RESET_PASSWORD_PATH = "/reset-password";
