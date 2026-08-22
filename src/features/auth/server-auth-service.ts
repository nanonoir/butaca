import "server-only";

import {
  isAuthError,
  type AuthUser,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { UuidSchema } from "../../contracts/common";
import type { UserRepository } from "../../db/repositories/user-repository";
import type { UserRecord } from "../../db/schema/users";

import {
  AuthProviderError,
  AuthRateLimitedError,
  InvalidCredentialsError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
} from "./errors";

export type AuthClientPort = Pick<
  SupabaseClient["auth"],
  | "signUp"
  | "signInWithPassword"
  | "signOut"
  | "getClaims"
  | "resetPasswordForEmail"
  | "updateUser"
>;

/** Supabase reports send-rate limits with a dedicated code; everything else is
 * an opaque provider failure. */
const RATE_LIMIT_ERROR_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

function isRateLimitError(code: string | undefined): boolean {
  return code !== undefined && RATE_LIMIT_ERROR_CODES.has(code);
}

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

function deriveDisplayName(user: AuthUser, inputEmail: string): string {
  const metadataDisplayName = normalizeDisplayName(
    user.user_metadata.display_name,
  );

  if (metadataDisplayName) {
    return metadataDisplayName;
  }

  const providerEmailLocalPart = user.email?.split("@", 1)[0];
  const inputEmailLocalPart = inputEmail.split("@", 1)[0];

  return (
    normalizeDisplayName(providerEmailLocalPart) ??
    normalizeDisplayName(inputEmailLocalPart) ??
    FALLBACK_DISPLAY_NAME
  );
}

export class ServerAuthService {
  constructor(
    private readonly auth: AuthClientPort,
    private readonly users: Pick<
      UserRepository,
      "findById" | "upsertFromAuthUser"
    >,
  ) {}

  async signUp(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<UserRecord> {
    let response: Awaited<ReturnType<AuthClientPort["signUp"]>>;

    try {
      response = await this.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { display_name: input.displayName } },
      });
    } catch {
      throw new AuthProviderError();
    }

    if (response.error || !response.data.user) {
      throw new AuthProviderError();
    }

    return this.users.upsertFromAuthUser({
      id: response.data.user.id,
      displayName: input.displayName,
      avatarUrl: null,
    });
  }

  async signIn(input: {
    email: string;
    password: string;
  }): Promise<UserRecord> {
    let response: Awaited<ReturnType<AuthClientPort["signInWithPassword"]>>;

    try {
      response = await this.auth.signInWithPassword(input);
    } catch (error) {
      if (isAuthError(error) && error.code === "invalid_credentials") {
        throw new InvalidCredentialsError();
      }

      throw new AuthProviderError();
    }

    if (response.error) {
      if (response.error.code === "invalid_credentials") {
        throw new InvalidCredentialsError();
      }

      throw new AuthProviderError();
    }

    const authUser = response.data.user;

    if (!authUser) {
      throw new AuthProviderError();
    }

    return this.users.upsertFromAuthUser({
      id: authUser.id,
      displayName: deriveDisplayName(authUser, input.email),
      avatarUrl: null,
    });
  }

  async signOut(): Promise<void> {
    let response: Awaited<ReturnType<AuthClientPort["signOut"]>>;

    try {
      response = await this.auth.signOut();
    } catch {
      throw new AuthProviderError();
    }

    if (response.error) {
      throw new AuthProviderError();
    }
  }

  /** Supabase deliberately does not reveal whether the address exists, so a
   * successful call proves nothing about the account and the caller must not
   * branch on it. */
  async requestPasswordReset(input: {
    email: string;
    redirectTo: string;
  }): Promise<void> {
    let response: Awaited<ReturnType<AuthClientPort["resetPasswordForEmail"]>>;

    try {
      response = await this.auth.resetPasswordForEmail(input.email, {
        redirectTo: input.redirectTo,
      });
    } catch (error) {
      if (isAuthError(error) && isRateLimitError(error.code)) {
        throw new AuthRateLimitedError();
      }

      throw new AuthProviderError();
    }

    if (response.error) {
      if (isRateLimitError(response.error.code)) {
        throw new AuthRateLimitedError();
      }

      throw new AuthProviderError();
    }
  }

  /** Requires the recovery session established by the callback route; without
   * it the update is rejected as unauthenticated. */
  async updatePassword(input: { newPassword: string }): Promise<void> {
    let response: Awaited<ReturnType<AuthClientPort["updateUser"]>>;

    try {
      response = await this.auth.updateUser({ password: input.newPassword });
    } catch {
      throw new AuthProviderError();
    }

    if (response.error) {
      if (isRateLimitError(response.error.code)) {
        throw new AuthRateLimitedError();
      }

      throw new UnauthenticatedError();
    }
  }

  /** Resolves the profile together with the verified email from the claims, so
   * callers that need to display the account do not have to query Auth twice. */
  async getCurrentSession(): Promise<{
    user: UserRecord;
    email: string | null;
  } | null> {
    let response: Awaited<ReturnType<AuthClientPort["getClaims"]>>;

    try {
      response = await this.auth.getClaims();
    } catch {
      throw new AuthProviderError();
    }

    if (response.error) {
      throw new AuthProviderError();
    }

    if (!response.data) {
      return null;
    }

    const userId = UuidSchema.safeParse(response.data.claims.sub);

    if (!userId.success) {
      throw new AuthProviderError();
    }

    const user = await this.users.findById(userId.data);

    if (!user) {
      throw new UserProfileNotProvisionedError();
    }

    const email = response.data.claims.email;

    return { user, email: typeof email === "string" ? email : null };
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
}
