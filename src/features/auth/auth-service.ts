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
  InvalidCredentialsError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
} from "./errors";

type AuthClientPort = Pick<
  SupabaseClient["auth"],
  "signUp" | "signInWithPassword" | "signOut" | "getClaims"
>;

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

export class AuthService {
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

  async getCurrentUser(): Promise<UserRecord | null> {
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

    return user;
  }

  async requireCurrentUser(): Promise<UserRecord> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new UnauthenticatedError();
    }

    return user;
  }
}
