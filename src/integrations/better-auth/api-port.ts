import { isAPIError } from "better-auth/api";

import { EmailDeliveryError } from "../email";

import type { Auth } from "./auth";
import { trackMailDelivery } from "./mail-outcome";

function isAlreadyVerified(error: { body?: unknown }): boolean {
  return (
    (error.body as { code?: unknown } | undefined)?.code ===
    "EMAIL_ALREADY_VERIFIED"
  );
}

/**
 * The slice of Better Auth that the application service depends on. Every
 * method forwards the incoming request headers (cookies, IP, user agent) so the
 * provider can record the session context and read the session cookie.
 *
 * Cookie propagation: `createAuth` installs the `nextCookies()` plugin, so any
 * `Set-Cookie` produced by these calls is written to the Next cookie store when
 * they run in a Route Handler or Server Action. In a Server Component the store
 * is read-only and the write is skipped silently.
 */
export type AuthApiPort = {
  signUpEmail(input: {
    name: string;
    email: string;
    password: string;
    headers: Headers;
  }): Promise<{
    user: { id: string };
    /** The account and session exist either way; this only reports whether the
     * verification email could not be sent. */
    verificationEmailFailed: boolean;
  }>;
  /** Sends the verification email to the signed-in user and rejects with
   * `EmailDeliveryError` when it cannot be sent. Resolves quietly if the
   * address is already verified. */
  sendVerificationEmail(input: {
    email: string;
    headers: Headers;
  }): Promise<void>;
  signInEmail(input: {
    email: string;
    password: string;
    headers: Headers;
  }): Promise<{ user: { id: string; name: string; email: string } }>;
  signOut(input: { headers: Headers }): Promise<void>;
  getSession(input: { headers: Headers }): Promise<{
    user: { id: string; email: string; emailVerified: boolean };
  } | null>;
  requestPasswordReset(input: {
    email: string;
    redirectTo: string;
    headers: Headers;
  }): Promise<void>;
  resetPassword(input: {
    newPassword: string;
    token: string;
    headers: Headers;
  }): Promise<void>;
  verifyEmail(input: { token: string; headers: Headers }): Promise<void>;
};

export function createAuthApiPort(auth: Auth): AuthApiPort {
  const { api } = auth;

  return {
    async signUpEmail({ headers, ...body }) {
      const { result, failed } = await trackMailDelivery(
        { strict: false },
        () => api.signUpEmail({ body, headers }),
      );

      return {
        user: { id: result.user.id },
        verificationEmailFailed: failed,
      };
    },
    async sendVerificationEmail({ email, headers }) {
      try {
        const { failed } = await trackMailDelivery({ strict: true }, () =>
          api.sendVerificationEmail({ body: { email }, headers }),
        );

        if (failed) {
          throw new EmailDeliveryError("verification email not sent");
        }
      } catch (error) {
        if (isAPIError(error) && isAlreadyVerified(error)) {
          return;
        }

        throw error;
      }
    },
    async signInEmail({ headers, ...body }) {
      const result = await api.signInEmail({ body, headers });

      return {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      };
    },
    async signOut({ headers }) {
      await api.signOut({ headers });
    },
    async getSession({ headers }) {
      const result = await api.getSession({ headers });

      if (!result) {
        return null;
      }

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
        },
      };
    },
    async requestPasswordReset({ headers, ...body }) {
      await api.requestPasswordReset({ body, headers });
    },
    async resetPassword({ headers, ...body }) {
      await api.resetPassword({ body, headers });
    },
    async verifyEmail({ headers, token }) {
      await api.verifyEmail({ query: { token }, headers });
    },
  };
}
