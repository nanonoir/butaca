import {
  AuthApiError,
  type AuthSession,
  type AuthUser,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { UserRepository } from "@/db/repositories/user-repository";
import type { UserRecord } from "@/db/schema/users";

import { AuthService } from "../auth-service";
import {
  AuthProviderError,
  InvalidCredentialsError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
} from "../errors";

type AuthPort = Pick<
  SupabaseClient["auth"],
  "signUp" | "signInWithPassword" | "signOut" | "getClaims"
>;
type UsersPort = Pick<UserRepository, "findById" | "upsertFromAuthUser">;
type SignUpResult = Awaited<ReturnType<AuthPort["signUp"]>>;
type GetClaimsResult = Awaited<ReturnType<AuthPort["getClaims"]>>;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const CREATED_AT = "2026-08-20T12:00:00.000Z";

function createAuthDouble() {
  return {
    signUp: vi.fn<AuthPort["signUp"]>(),
    signInWithPassword: vi.fn<AuthPort["signInWithPassword"]>(),
    signOut: vi.fn<AuthPort["signOut"]>(),
    getClaims: vi.fn<AuthPort["getClaims"]>(),
  } satisfies AuthPort;
}

function createUsersDouble() {
  return {
    findById: vi.fn<UsersPort["findById"]>(),
    upsertFromAuthUser: vi.fn<UsersPort["upsertFromAuthUser"]>(),
  } satisfies UsersPort;
}

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: USER_ID,
    app_metadata: {},
    user_metadata: { display_name: "Auth display name" },
    aud: "authenticated",
    email: "viewer@example.test",
    created_at: CREATED_AT,
    ...overrides,
  };
}

function createSession(user: AuthUser): AuthSession {
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3_600,
    expires_at: 1_787_229_600,
    token_type: "bearer",
    user,
  };
}

function createUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: USER_ID,
    displayName: "Auth display name",
    avatarUrl: null,
    onboardingCompletedAt: null,
    createdAt: new Date(CREATED_AT),
    updatedAt: new Date(CREATED_AT),
    ...overrides,
  };
}

function createProviderError(message: string, code?: string) {
  return Object.assign(new AuthApiError(message, 400, code), {
    payload: { provider: "private-payload" },
  }) satisfies NonNullable<SignUpResult["error"]>;
}

function createClaimsResult(sub: string): GetClaimsResult {
  return {
    data: {
      claims: {
        iss: "https://example.test/auth/v1",
        sub,
        aud: "authenticated",
        exp: 1_787_229_600,
        iat: 1_787_226_000,
        role: "authenticated",
        aal: "aal1",
        session_id: SESSION_ID,
        email: "viewer@example.test",
      },
      header: {
        alg: "RS256",
        kid: "test-key-id",
        typ: "JWT",
      },
      signature: new Uint8Array([1, 2, 3]),
    },
    error: null,
  };
}

async function expectSafeProviderFailure(operation: Promise<unknown>) {
  let thrown: unknown;

  try {
    await operation;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(AuthProviderError);
  expect(thrown).toMatchObject({
    name: "AuthProviderError",
    message: "Authentication provider operation failed",
  });
  expect(thrown).not.toHaveProperty("cause");
  expect(thrown).not.toHaveProperty("code");
  expect(thrown).not.toHaveProperty("payload");
  expect(thrown).not.toHaveProperty("status");
  expect(String(thrown)).not.toContain("provider-private-message");
}

describe("AuthService", () => {
  it("signUp provisions public.users with the Auth UUID", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const authUser = createAuthUser();
    const profile = createUserRecord({ displayName: "Gonzalo" });
    auth.signUp.mockResolvedValue({
      data: { user: authUser, session: null },
      error: null,
    });
    users.upsertFromAuthUser.mockResolvedValue(profile);

    const result = await new AuthService(auth, users).signUp({
      email: "viewer@example.test",
      password: "test-password",
      displayName: "Gonzalo",
    });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: "viewer@example.test",
      password: "test-password",
      options: { data: { display_name: "Gonzalo" } },
    });
    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: "Gonzalo",
      avatarUrl: null,
    });
    expect(result).toBe(profile);
  });

  it("signUp maps an impossible success without a user to a safe provider error", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const operation = new AuthService(auth, users).signUp({
      email: "viewer@example.test",
      password: "test-password",
      displayName: "Gonzalo",
    });

    await expectSafeProviderFailure(operation);
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("signUp maps returned provider failures to a safe provider error", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: createProviderError("provider-private-message"),
    });

    const operation = new AuthService(auth, users).signUp({
      email: "viewer@example.test",
      password: "test-password",
      displayName: "Gonzalo",
    });

    await expectSafeProviderFailure(operation);
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("signUp lets repository failures bubble unchanged", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const repositoryError = new Error("repository failure");
    auth.signUp.mockResolvedValue({
      data: { user: createAuthUser(), session: null },
      error: null,
    });
    users.upsertFromAuthUser.mockRejectedValue(repositoryError);

    const operation = new AuthService(auth, users).signUp({
      email: "viewer@example.test",
      password: "test-password",
      displayName: "Gonzalo",
    });

    await expect(operation).rejects.toBe(repositoryError);
  });

  it("signIn repairs a missing local profile without overwriting an existing one", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const authUser = createAuthUser({
      user_metadata: { display_name: "  Auth display name  " },
    });
    let storedProfile: UserRecord | null = null;
    auth.signInWithPassword.mockResolvedValue({
      data: { user: authUser, session: createSession(authUser) },
      error: null,
    });
    users.upsertFromAuthUser.mockImplementation(async (input) => {
      storedProfile ??= createUserRecord(input);
      return storedProfile;
    });
    const service = new AuthService(auth, users);

    const repaired = await service.signIn({
      email: "viewer@example.test",
      password: "test-password",
    });
    storedProfile = createUserRecord({
      displayName: "Edited locally",
      avatarUrl: "https://example.test/edited.png",
    });
    const preserved = await service.signIn({
      email: "viewer@example.test",
      password: "test-password",
    });

    expect(users.upsertFromAuthUser).toHaveBeenNthCalledWith(1, {
      id: USER_ID,
      displayName: "Auth display name",
      avatarUrl: null,
    });
    expect(users.upsertFromAuthUser).toHaveBeenNthCalledWith(2, {
      id: USER_ID,
      displayName: "Auth display name",
      avatarUrl: null,
    });
    expect(repaired.displayName).toBe("Auth display name");
    expect(preserved).toBe(storedProfile);
    expect(preserved).toMatchObject({
      displayName: "Edited locally",
      avatarUrl: "https://example.test/edited.png",
    });
  });

  it("signIn derives a bounded display name from the email local part", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const longLocalPart = "viewer".repeat(16);
    const authUser = createAuthUser({
      email: `  ${longLocalPart}  @example.test`,
      user_metadata: { display_name: "   " },
    });
    auth.signInWithPassword.mockResolvedValue({
      data: { user: authUser, session: createSession(authUser) },
      error: null,
    });
    users.upsertFromAuthUser.mockImplementation(async (input) =>
      createUserRecord(input),
    );

    await new AuthService(auth, users).signIn({
      email: "viewer@example.test",
      password: "test-password",
    });

    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: longLocalPart.slice(0, 80),
      avatarUrl: null,
    });
  });

  it("signIn derives a display name from the input email when the provider email is unavailable", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const authUser = createAuthUser({
      email: undefined,
      user_metadata: { display_name: null },
    });
    auth.signInWithPassword.mockResolvedValue({
      data: { user: authUser, session: createSession(authUser) },
      error: null,
    });
    users.upsertFromAuthUser.mockImplementation(async (input) =>
      createUserRecord(input),
    );

    await new AuthService(auth, users).signIn({
      email: "viewer@example.test",
      password: "test-password",
    });

    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: "viewer",
      avatarUrl: null,
    });
  });

  it("signIn uses a fixed non-empty display name when both emails are unusable", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const authUser = createAuthUser({
      email: undefined,
      user_metadata: { display_name: null },
    });
    auth.signInWithPassword.mockResolvedValue({
      data: { user: authUser, session: createSession(authUser) },
      error: null,
    });
    users.upsertFromAuthUser.mockImplementation(async (input) =>
      createUserRecord(input),
    );

    await new AuthService(auth, users).signIn({
      email: "@example.test",
      password: "test-password",
    });

    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: "Film Match user",
      avatarUrl: null,
    });
  });

  it("maps invalid credentials to InvalidCredentialsError", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: createProviderError(
        "provider-private-message",
        "invalid_credentials",
      ),
    });

    const operation = new AuthService(auth, users).signIn({
      email: "viewer@example.test",
      password: "test-password",
    });

    let thrown: unknown;

    try {
      await operation;
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidCredentialsError);
    expect(thrown).toMatchObject({
      name: "InvalidCredentialsError",
      message: "Invalid email or password",
    });
    expect(thrown).not.toHaveProperty("cause");
    expect(thrown).not.toHaveProperty("code");
    expect(thrown).not.toHaveProperty("payload");
    expect(thrown).not.toHaveProperty("status");
    expect(String(thrown)).not.toContain("provider-private-message");
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("maps rejected invalid credentials to InvalidCredentialsError", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signInWithPassword.mockRejectedValue(
      createProviderError("provider-private-message", "invalid_credentials"),
    );

    const operation = new AuthService(auth, users).signIn({
      email: "viewer@example.test",
      password: "test-password",
    });

    let thrown: unknown;

    try {
      await operation;
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidCredentialsError);
    expect(thrown).toMatchObject({
      name: "InvalidCredentialsError",
      message: "Invalid email or password",
    });
    expect(thrown).not.toHaveProperty("cause");
    expect(thrown).not.toHaveProperty("code");
    expect(thrown).not.toHaveProperty("payload");
    expect(thrown).not.toHaveProperty("status");
    expect(String(thrown)).not.toContain("provider-private-message");
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("maps non-credential signIn failures to a safe provider error", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: createProviderError(
        "provider-private-message",
        "provider_internal_error",
      ),
    });

    const operation = new AuthService(auth, users).signIn({
      email: "viewer@example.test",
      password: "test-password",
    });

    await expectSafeProviderFailure(operation);
  });

  it("getCurrentUser returns null when getClaims has no identity", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.getClaims.mockResolvedValue({ data: null, error: null });

    const result = await new AuthService(auth, users).getCurrentUser();

    expect(result).toBeNull();
    expect(users.findById).not.toHaveBeenCalled();
  });

  it("getCurrentUser evaluates provider errors before treating missing data as a guest", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.getClaims.mockResolvedValue({
      data: null,
      error: createProviderError("provider-private-message"),
    });

    const operation = new AuthService(auth, users).getCurrentUser();

    await expectSafeProviderFailure(operation);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it("getCurrentUser validates claims.sub and loads users.id", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    const profile = createUserRecord();
    auth.getClaims
      .mockResolvedValueOnce(createClaimsResult("not-a-uuid"))
      .mockResolvedValueOnce(createClaimsResult(USER_ID));
    users.findById.mockResolvedValue(profile);
    const service = new AuthService(auth, users);

    const malformedOperation = service.getCurrentUser();
    await expectSafeProviderFailure(malformedOperation);
    expect(users.findById).not.toHaveBeenCalled();

    await expect(service.getCurrentUser()).resolves.toBe(profile);
    expect(users.findById).toHaveBeenCalledOnce();
    expect(users.findById).toHaveBeenCalledWith(USER_ID);
  });

  it("getCurrentUser throws UserProfileNotProvisionedError for an Auth-only user", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.getClaims.mockResolvedValue(createClaimsResult(USER_ID));
    users.findById.mockResolvedValue(null);

    const operation = new AuthService(auth, users).getCurrentUser();

    await expect(operation).rejects.toBeInstanceOf(
      UserProfileNotProvisionedError,
    );
    await expect(operation).rejects.toMatchObject({
      name: "UserProfileNotProvisionedError",
      message: "User profile is not provisioned",
    });
  });

  it("requireCurrentUser throws UnauthenticatedError for a guest", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.getClaims.mockResolvedValue({ data: null, error: null });

    const operation = new AuthService(auth, users).requireCurrentUser();

    await expect(operation).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(operation).rejects.toMatchObject({
      name: "UnauthenticatedError",
      message: "Authentication required",
    });
  });

  it("signOut maps returned provider failures without exposing provider payloads", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signOut.mockResolvedValue({
      error: createProviderError("provider-private-message"),
    });

    const operation = new AuthService(auth, users).signOut();

    await expectSafeProviderFailure(operation);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("signOut maps thrown provider failures without exposing provider payloads", async () => {
    const auth = createAuthDouble();
    const users = createUsersDouble();
    auth.signOut.mockRejectedValue(
      createProviderError("provider-private-message"),
    );

    const operation = new AuthService(auth, users).signOut();

    await expectSafeProviderFailure(operation);
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
