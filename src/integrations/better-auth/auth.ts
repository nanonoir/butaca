import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { PASSWORD_POLICY } from "../../contracts/password-policy";
import type { Database } from "../../db/client";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "../../db/schema/auth";
import { passwordResetEmail, verificationEmail, type Mailer } from "../email";

import { currentMailContext } from "./mail-outcome";
import {
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  type AuthRuntimeConfig,
} from "./config";

/** The product accepts any password that satisfies its own policy, which has no
 * upper bound; Better Auth's default of 128 would silently reject some of them.
 * The ceiling only guards the hash cost and sits far above real passwords. */
export const MAX_PASSWORD_LENGTH = PASSWORD_POLICY.MAX_LENGTH;
export const MIN_PASSWORD_LENGTH = PASSWORD_POLICY.MIN_LENGTH;

export type CreateAuthOptions = {
  db: Database;
  config: Pick<AuthRuntimeConfig, "secret" | "baseURL">;
  mailer: Mailer;
  /** Receives every mail failure (the production wiring logs it). Reset
   * requests never fail on it, to avoid revealing whether the address exists;
   * verification failures are additionally surfaced through
   * `trackMailDelivery`. */
  onMailError?: (error: unknown) => void;
};

/** Only our own pages may receive the reset token. */
const RESET_LINK_PATHS: ReadonlySet<string> = new Set([
  "/confirm",
  RESET_PASSWORD_PATH,
]);

function resetLink(url: string, token: string, baseURL: string): string {
  const fallback = new URL(RESET_PASSWORD_PATH, baseURL);
  let target = fallback;

  try {
    const callback = new URL(url).searchParams.get("callbackURL");

    if (callback) {
      const candidate = new URL(callback, baseURL);

      if (
        candidate.origin === new URL(baseURL).origin &&
        RESET_LINK_PATHS.has(candidate.pathname)
      ) {
        // Rebuilt from the canonical base: drops userinfo, query and hash.
        target = new URL(candidate.pathname, baseURL);
      }
    }
  } catch {
    target = fallback;
  }

  target.searchParams.set("token", token);

  return target.toString();
}

/** Better Auth hands its logger raw errors (Drizzle errors carry SQL params,
 * session tokens, emails). Only the level is emitted: neither the message nor
 * the arguments ever reach the output. */
export const sanitizedLogger = {
  level: "error",
  // Declared variadic only to match the provider's signature; extras are ignored.
  log: function (
    level: "debug" | "info" | "warn" | "error",
    ...rest: unknown[]
  ) {
    void rest;

    if (level === "error") {
      console.error("[better-auth] internal error (details withheld)");
    } else if (level === "warn") {
      console.warn("[better-auth] warning (details withheld)");
    }
  },
} as const;

export function createAuth(options: CreateAuthOptions) {
  const { db, config, mailer } = options;
  const reportMailError = options.onMailError ?? (() => undefined);

  // Reset email: fire and forget, since awaiting would make response time
  // reveal whether the address exists. The failure is still reported.
  const deliver = (message: Parameters<Mailer["send"]>[0]) => {
    void mailer.send(message).catch(reportMailError);
  };

  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [config.baseURL],
    logger: sanitizedLogger,
    database: drizzleAdapter(db, {
      provider: "pg",
      transaction: true,
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    advanced: {
      database: { generateId: "uuid" },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        deliver(
          passwordResetEmail({
            to: user.email,
            name: user.name,
            link: resetLink(url, token, config.baseURL),
          }),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        const link = new URL(VERIFY_EMAIL_PATH, config.baseURL);
        link.searchParams.set("token", token);

        // Awaited, unlike the reset email, so the caller can tell a delivered
        // message from a failed one. A failure is reported and flagged on the
        // calling context; it only propagates when that caller asked for it,
        // so registration and sign-in never depend on the mail provider.
        try {
          await mailer.send(
            verificationEmail({
              to: user.email,
              name: user.name,
              link: link.toString(),
            }),
          );
        } catch (error) {
          reportMailError(error);

          const context = currentMailContext();

          if (context) {
            context.failed = true;
          }

          if (context?.strict) {
            throw error;
          }
        }
      },
    },
    // Must stay last: it forwards Set-Cookie from `auth.api.*` calls made in
    // Route Handlers and Server Actions into the Next cookie store.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
