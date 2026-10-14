import "server-only";

import { isAPIError } from "better-auth/api";

import { UuidSchema } from "../../contracts/common";
import {
  isOperationalDatabaseError,
  withDatabaseAvailability,
} from "../../db/errors";
import type { UserRepository } from "../../db/repositories/user-repository";
import type { UserRecord } from "../../db/schema/users";
import type { AuthApiPort } from "../../integrations/better-auth/api-port";
import { EmailDeliveryError } from "../../integrations/email";
import {
  clientAddress,
  type RateLimiter,
  type RateLimitRule,
} from "../../integrations/better-auth/rate-limit";

import {
  AuthProviderError,
  AuthRateLimitedError,
  EmailAlreadyRegisteredError,
  InvalidAuthTokenError,
  InvalidCredentialsError,
  ServiceUnavailableError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
  VerificationEmailNotSentError,
  WeakPasswordError,
} from "./errors";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Generous enough for shared addresses, tight enough to make guessing and mail
 * abuse impractical. Per-email rules protect an account; per-address rules
 * protect the service. */
export const AUTH_RATE_LIMITS = {
  signInAddress: { limit: 30, windowMs: FIFTEEN_MINUTES_MS },
  signInEmail: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
  signUpAddress: { limit: 10, windowMs: ONE_HOUR_MS },
  resetRequestAddress: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
  resetRequestEmail: { limit: 3, windowMs: FIFTEEN_MINUTES_MS },
  tokenAddress: { limit: 20, windowMs: FIFTEEN_MINUTES_MS },
} as const satisfies Record<string, RateLimitRule>;

type UsersPort = Pick<UserRepository, "findById" | "upsertFromAuthUser">;

export type ServerAuthServiceOptions = {
  /** Headers of the request being served; forwarded to the provider. */
  headers: Headers;
  limiter: RateLimiter;
};

const MAX_DISPLAY_NAME_LENGTH = 80;
const FALLBACK_DISPLAY_NAME = "Film Match user";

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const displayName = [...value.trim()]
    .slice(0, MAX_DISPLAY_NAME_LENGTH)
    .join("")
    .trim();

  return displayName || null;
}

/** Only used to repair a missing profile; an existing one is never touched. */
function deriveDisplayName(identity: { name: string; email: string }): string {
  return (
    normalizeDisplayName(identity.name) ??
    normalizeDisplayName(identity.email.split("@", 1)[0]) ??
    FALLBACK_DISPLAY_NAME
  );
}

function providerCode(error: unknown): string | undefined {
  if (!isAPIError(error)) {
    return undefined;
  }

  const code = (error.body as { code?: unknown } | undefined)?.code;

  return typeof code === "string" ? code : undefined;
}

/** Everything unexpected collapses into a safe error: provider payloads,
 * causes and SQL never cross this boundary. */
function toUnavailable(error: unknown): Error {
  if (error instanceof ServiceUnavailableError) {
    return error;
  }

  if (isOperationalDatabaseError(error)) {
    return new ServiceUnavailableError();
  }

  return new AuthProviderError();
}

export class ServerAuthService {
  constructor(
    private readonly api: AuthApiPort,
    private readonly users: UsersPort,
    private readonly options: ServerAuthServiceOptions,
  ) {}

  private enforce(scope: string, key: string, rule: RateLimitRule) {
    if (!this.options.limiter.consume(`${scope}:${key}`, rule)) {
      throw new AuthRateLimitedError();
    }
  }

  private get address(): string {
    return clientAddress(this.options.headers);
  }

  async signUp(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<UserRecord> {
    const { user } = await this.registerAccount(input);

    return user;
  }

  /** Creates the account, its profile and the session. The verification email
   * is best effort: when it cannot be sent the account stays valid and
   * `verificationEmail` is `"failed"`, so the caller must not claim delivery.
   * `requestEmailVerification` is the retry. */
  async registerAccount(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: UserRecord; verificationEmail: "sent" | "failed" }> {
    this.enforce("signup", this.address, AUTH_RATE_LIMITS.signUpAddress);

    let userId: string;
    let verificationEmailFailed: boolean;

    try {
      const result = await this.api.signUpEmail({
        name: input.displayName,
        email: input.email,
        password: input.password,
        headers: this.options.headers,
      });
      userId = result.user.id;
      verificationEmailFailed = result.verificationEmailFailed;
    } catch (error) {
      const code = providerCode(error);

      if (code?.startsWith("USER_ALREADY_EXISTS")) {
        throw new EmailAlreadyRegisteredError();
      }

      if (code === "PASSWORD_TOO_LONG" || code === "PASSWORD_TOO_SHORT") {
        throw new WeakPasswordError();
      }

      throw toUnavailable(error);
    }

    // The database trigger creates the profile in the identity transaction;
    // this only returns it (and repairs it if it was removed out of band).
    const user = await this.provisionProfile(userId, {
      name: input.displayName,
      email: input.email,
    });

    return {
      user,
      verificationEmail: verificationEmailFailed ? "failed" : "sent",
    };
  }

  /** Sends the verification email again to the signed-in user. Throws
   * `VerificationEmailNotSentError` when delivery fails, so the caller never
   * reports a send that did not happen. Does nothing for a verified address. */
  async requestEmailVerification(): Promise<void> {
    this.enforce("verify-request", this.address, AUTH_RATE_LIMITS.tokenAddress);

    const session = await this.getCurrentSession();

    if (!session) {
      throw new UnauthenticatedError();
    }

    if (!session.email || session.emailVerified) {
      return;
    }

    try {
      await this.api.sendVerificationEmail({
        email: session.email,
        headers: this.options.headers,
      });
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        throw new VerificationEmailNotSentError();
      }

      throw toUnavailable(error);
    }
  }

  async signIn(input: {
    email: string;
    password: string;
  }): Promise<UserRecord> {
    this.enforce("signin-address", this.address, AUTH_RATE_LIMITS.signInAddress);
    this.enforce("signin-email", input.email, AUTH_RATE_LIMITS.signInEmail);

    let identity: { id: string; name: string; email: string };

    try {
      const result = await this.api.signInEmail({
        email: input.email,
        password: input.password,
        headers: this.options.headers,
      });
      identity = result.user;
    } catch (error) {
      const code = providerCode(error);

      if (
        code === "INVALID_EMAIL_OR_PASSWORD" ||
        code === "INVALID_PASSWORD" ||
        code === "USER_NOT_FOUND"
      ) {
        throw new InvalidCredentialsError();
      }

      throw toUnavailable(error);
    }

    return this.provisionProfile(identity.id, identity);
  }

  async signOut(): Promise<void> {
    try {
      await this.api.signOut({ headers: this.options.headers });
    } catch (error) {
      throw toUnavailable(error);
    }
  }

  /** The provider does not reveal whether the address exists, so a successful
   * call proves nothing about the account and the caller must not branch on it.
   * `redirectTo` is the canonical page that will receive `?token=`. */
  async requestPasswordReset(input: {
    email: string;
    redirectTo: string;
  }): Promise<void> {
    this.enforce(
      "reset-request-address",
      this.address,
      AUTH_RATE_LIMITS.resetRequestAddress,
    );
    this.enforce(
      "reset-request-email",
      input.email,
      AUTH_RATE_LIMITS.resetRequestEmail,
    );

    try {
      await this.api.requestPasswordReset({
        email: input.email,
        redirectTo: input.redirectTo,
        headers: this.options.headers,
      });
    } catch (error) {
      throw toUnavailable(error);
    }
  }

  /** Consumes the emailed reset token. An unknown, expired or already used
   * token is an `InvalidAuthTokenError`; the provider revokes other sessions. */
  async updatePassword(input: {
    newPassword: string;
    token: string;
  }): Promise<void> {
    this.enforce("token", this.address, AUTH_RATE_LIMITS.tokenAddress);

    try {
      await this.api.resetPassword({
        newPassword: input.newPassword,
        token: input.token,
        headers: this.options.headers,
      });
    } catch (error) {
      const code = providerCode(error);

      if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") {
        throw new InvalidAuthTokenError();
      }

      if (code === "PASSWORD_TOO_LONG" || code === "PASSWORD_TOO_SHORT") {
        throw new WeakPasswordError();
      }

      throw toUnavailable(error);
    }
  }

  /** Marks the address as verified. Failing here never affects the session:
   * verification is informative and does not gate any flow. The caller owns the
   * redirect, so no callback URL is handed to the provider. */
  async verifyEmail(token: string): Promise<void> {
    this.enforce("token", this.address, AUTH_RATE_LIMITS.tokenAddress);

    try {
      await this.api.verifyEmail({ token, headers: this.options.headers });
    } catch (error) {
      const code = providerCode(error);

      if (
        code === "INVALID_TOKEN" ||
        code === "TOKEN_EXPIRED" ||
        code === "USER_NOT_FOUND"
      ) {
        throw new InvalidAuthTokenError();
      }

      throw toUnavailable(error);
    }
  }

  /** Resolves the profile together with the account email, so callers that need
   * to display the account do not have to query Auth twice. */
  async getCurrentSession(): Promise<{
    user: UserRecord;
    email: string | null;
    emailVerified: boolean;
  } | null> {
    let session: Awaited<ReturnType<AuthApiPort["getSession"]>>;

    try {
      session = await this.api.getSession({ headers: this.options.headers });
    } catch (error) {
      // The provider swallows any lookup failure (the database cause included)
      // into a 500 with this code; the 401 variant is a plain lost session.
      if (
        isAPIError(error) &&
        error.statusCode === 500 &&
        providerCode(error) === "FAILED_TO_GET_SESSION"
      ) {
        throw new ServiceUnavailableError();
      }

      throw toUnavailable(error);
    }

    if (!session) {
      return null;
    }

    const userId = UuidSchema.safeParse(session.user.id);

    if (!userId.success) {
      throw new AuthProviderError();
    }

    const user = await withDatabaseAvailability(() =>
      this.users.findById(userId.data),
    );

    if (!user) {
      throw new UserProfileNotProvisionedError();
    }

    return {
      user,
      email: session.user.email || null,
      emailVerified: session.user.emailVerified,
    };
  }

  async getCurrentUser(): Promise<UserRecord | null> {
    const session = await this.getCurrentSession();

    return session?.user ?? null;
  }

  async requireCurrentUser(): Promise<UserRecord> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new UnauthenticatedError();
    }

    return user;
  }

  private provisionProfile(
    userId: string,
    identity: { name: string; email: string },
  ): Promise<UserRecord> {
    return withDatabaseAvailability(() =>
      this.users.upsertFromAuthUser({
        id: userId,
        displayName: deriveDisplayName(identity),
        avatarUrl: null,
      }),
    );
  }
}
