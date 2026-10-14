import "server-only";

import { getDatabase } from "../../db";
import { createResendMailer } from "../email";

import { createAuth, type Auth } from "./auth";
import { parseAuthRuntimeConfig, type AuthRuntimeConfig } from "./config";
import { createRateLimiter, type RateLimiter } from "./rate-limit";

export type { Auth } from "./auth";
export type { AuthApiPort } from "./api-port";
export { createAuthApiPort } from "./api-port";
export type { AuthRuntimeConfig } from "./config";
export { VERIFY_EMAIL_PATH, RESET_PASSWORD_PATH } from "./config";
export type { RateLimiter } from "./rate-limit";

let runtimeConfig: AuthRuntimeConfig | undefined;
let auth: Auth | undefined;
let limiter: RateLimiter | undefined;

/** Lazy and runtime-only: nothing here runs at build time, so the build needs
 * no auth secrets. */
export function getAuthRuntimeConfig(): AuthRuntimeConfig {
  runtimeConfig ??= parseAuthRuntimeConfig(process.env);

  return runtimeConfig;
}

/** Canonical origin of the application (no trailing slash). Use it to build
 * every absolute auth URL instead of trusting the request. */
export function getAuthBaseUrl(): string {
  return getAuthRuntimeConfig().baseURL;
}

export function getAuth(): Auth {
  if (!auth) {
    const config = getAuthRuntimeConfig();

    auth = createAuth({
      db: getDatabase(),
      config,
      mailer: createResendMailer(config.resend),
      onMailError: (error) => {
        // EmailDeliveryError messages carry a status or fixed reason only.
        console.error(
          error instanceof Error ? error.message : "Email delivery failed",
        );
      },
    });
  }

  return auth;
}

/** Shared across requests on purpose: the limits only work if the counters
 * outlive the per-request service. */
export function getAuthRateLimiter(): RateLimiter {
  limiter ??= createRateLimiter();

  return limiter;
}

export type HeaderSession = {
  userId: string;
  email: string;
  emailVerified: boolean;
  /** Headers the provider wants to send back (a refreshed session cookie).
   * Forward their `Set-Cookie` entries onto the outgoing response. */
  responseHeaders: Headers;
};

/** Session lookup that needs no Next request context, for the proxy: it takes
 * the incoming headers and returns the refresh cookies instead of writing them,
 * so the caller decides where they go. */
export async function getSessionWithHeaders(
  headers: Headers,
): Promise<HeaderSession | null> {
  const result = await getAuth().api.getSession({
    headers,
    returnHeaders: true,
  });

  if (!result.response) {
    return null;
  }

  return {
    userId: result.response.user.id,
    email: result.response.user.email,
    emailVerified: result.response.user.emailVerified,
    responseHeaders: result.headers,
  };
}
