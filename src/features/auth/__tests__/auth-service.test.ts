import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";

import type { UserRepository } from "@/db/repositories/user-repository";
import type { UserRecord } from "@/db/schema/users";
import type { AuthApiPort } from "@/integrations/better-auth/api-port";
import { createRateLimiter } from "@/integrations/better-auth/rate-limit";

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
} from "../errors";
import { EmailDeliveryError } from "@/integrations/email";
import { ServerAuthService } from "../server-auth-service";

type UsersPort = Pick<UserRepository, "findById" | "upsertFromAuthUser">;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = "2026-08-20T12:00:00.000Z";
const REQUEST_HEADERS = new Headers({ "x-forwarded-for": "203.0.113.7" });

function createApiDouble() {
  return {
    signUpEmail: vi.fn<AuthApiPort["signUpEmail"]>(),
    signInEmail: vi.fn<AuthApiPort["signInEmail"]>(),
    signOut: vi.fn<AuthApiPort["signOut"]>(),
    getSession: vi.fn<AuthApiPort["getSession"]>(),
    requestPasswordReset: vi.fn<AuthApiPort["requestPasswordReset"]>(),
    resetPassword: vi.fn<AuthApiPort["resetPassword"]>(),
    verifyEmail: vi.fn<AuthApiPort["verifyEmail"]>(),
    sendVerificationEmail: vi.fn<AuthApiPort["sendVerificationEmail"]>(),
  } satisfies AuthApiPort;
}

function createUsersDouble() {
  return {
    findById: vi.fn<UsersPort["findById"]>(),
    upsertFromAuthUser: vi.fn<UsersPort["upsertFromAuthUser"]>(),
  } satisfies UsersPort;
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

function providerError(code: string, status: "BAD_REQUEST" | "UNPROCESSABLE_ENTITY" | "UNAUTHORIZED" = "BAD_REQUEST") {
  return new APIError(status, { code, message: "provider-private-message" });
}

function setup() {
  const api = createApiDouble();
  const users = createUsersDouble();
  const service = new ServerAuthService(api, users, {
    headers: REQUEST_HEADERS,
    limiter: createRateLimiter(),
  });

  return { api, users, service };
}

async function rejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }

  throw new Error("Expected the operation to reject");
}

async function expectSafeProviderFailure(operation: Promise<unknown>) {
  const thrown = await rejection(operation);

  expect(thrown).toBeInstanceOf(AuthProviderError);
  expect(thrown).toMatchObject({
    name: "AuthProviderError",
    message: "Authentication provider operation failed",
  });
  expect(thrown).not.toHaveProperty("cause");
  expect(thrown).not.toHaveProperty("body");
  expect(thrown).not.toHaveProperty("status");
  expect(String(thrown)).not.toContain("provider-private-message");
}

describe("ServerAuthService sign-up and sign-in", () => {
  it("signUp registers with the display name and returns the profile for the Auth UUID", async () => {
    const { api, users, service } = setup();
    const profile = createUserRecord({ displayName: "Gonzalo" });
    api.signUpEmail.mockResolvedValue({ user: { id: USER_ID }, verificationEmailFailed: false });
    users.upsertFromAuthUser.mockResolvedValue(profile);

    const result = await service.signUp({
      email: "viewer@example.test",
      password: "test-password",
      displayName: "Gonzalo",
    });

    expect(api.signUpEmail).toHaveBeenCalledWith({
      name: "Gonzalo",
      email: "viewer@example.test",
      password: "test-password",
      headers: REQUEST_HEADERS,
    });
    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: "Gonzalo",
      avatarUrl: null,
    });
    expect(result).toBe(profile);
  });

  it("signUp maps an existing email to EmailAlreadyRegisteredError", async () => {
    const { api, users, service } = setup();
    api.signUpEmail.mockRejectedValue(
      providerError("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "UNPROCESSABLE_ENTITY"),
    );

    await expect(
      service.signUp({
        email: "viewer@example.test",
        password: "test-password",
        displayName: "Gonzalo",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("signUp maps provider length rejections to WeakPasswordError", async () => {
    const { api, service } = setup();
    api.signUpEmail.mockRejectedValue(providerError("PASSWORD_TOO_LONG"));

    await expect(
      service.signUp({
        email: "viewer@example.test",
        password: "test-password",
        displayName: "Gonzalo",
      }),
    ).rejects.toBeInstanceOf(WeakPasswordError);
  });

  it("signUp hides unexpected provider failures behind a safe error", async () => {
    const { api, users, service } = setup();
    api.signUpEmail.mockRejectedValue(providerError("SOMETHING_ELSE"));

    await expectSafeProviderFailure(
      service.signUp({
        email: "viewer@example.test",
        password: "test-password",
        displayName: "Gonzalo",
      }),
    );
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("signUp lets non-operational repository failures bubble unchanged", async () => {
    const { api, users, service } = setup();
    const repositoryError = new Error("repository failure");
    api.signUpEmail.mockResolvedValue({ user: { id: USER_ID }, verificationEmailFailed: false });
    users.upsertFromAuthUser.mockRejectedValue(repositoryError);

    await expect(
      service.signUp({
        email: "viewer@example.test",
        password: "test-password",
        displayName: "Gonzalo",
      }),
    ).rejects.toBe(repositoryError);
  });

  it("signUp maps an unreachable database to ServiceUnavailableError", async () => {
    const { api, users, service } = setup();
    api.signUpEmail.mockRejectedValue(
      Object.assign(new Error("connect"), { code: "ECONNREFUSED" }),
    );

    await expect(
      service.signUp({
        email: "viewer@example.test",
        password: "test-password",
        displayName: "Gonzalo",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("signIn repairs a missing profile without overwriting an existing one", async () => {
    const { api, users, service } = setup();
    let storedProfile: UserRecord | null = null;
    api.signInEmail.mockResolvedValue({
      user: { id: USER_ID, name: "  Auth display name  ", email: "viewer@example.test" },
    });
    users.upsertFromAuthUser.mockImplementation(async (input) => {
      storedProfile ??= createUserRecord(input);
      return storedProfile;
    });

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
    expect(repaired.displayName).toBe("Auth display name");
    expect(preserved).toMatchObject({
      displayName: "Edited locally",
      avatarUrl: "https://example.test/edited.png",
    });
  });

  it("signIn derives a bounded display name from the email when the name is blank", async () => {
    const { api, users, service } = setup();
    const longLocalPart = "viewer".repeat(16);
    api.signInEmail.mockResolvedValue({
      user: { id: USER_ID, name: "   ", email: `${longLocalPart}@example.test` },
    });
    users.upsertFromAuthUser.mockImplementation(async (input) =>
      createUserRecord(input),
    );

    await service.signIn({ email: "viewer@example.test", password: "x" });

    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: longLocalPart.slice(0, 80),
      avatarUrl: null,
    });
  });

  it("signIn falls back to a fixed non-empty display name", async () => {
    const { api, users, service } = setup();
    api.signInEmail.mockResolvedValue({
      user: { id: USER_ID, name: "", email: "@example.test" },
    });
    users.upsertFromAuthUser.mockImplementation(async (input) =>
      createUserRecord(input),
    );

    await service.signIn({ email: "viewer@example.test", password: "x" });

    expect(users.upsertFromAuthUser).toHaveBeenCalledWith({
      id: USER_ID,
      displayName: "Film Match user",
      avatarUrl: null,
    });
  });

  it("maps invalid credentials without leaking provider detail", async () => {
    const { api, users, service } = setup();
    api.signInEmail.mockRejectedValue(
      providerError("INVALID_EMAIL_OR_PASSWORD", "UNAUTHORIZED"),
    );

    const thrown = await rejection(
      service.signIn({ email: "viewer@example.test", password: "x" }),
    );

    expect(thrown).toBeInstanceOf(InvalidCredentialsError);
    expect(thrown).toMatchObject({
      name: "InvalidCredentialsError",
      message: "Invalid email or password",
    });
    expect(String(thrown)).not.toContain("provider-private-message");
    expect(users.upsertFromAuthUser).not.toHaveBeenCalled();
  });

  it("maps other signIn failures to a safe provider error", async () => {
    const { api, service } = setup();
    api.signInEmail.mockRejectedValue(providerError("INTERNAL"));

    await expectSafeProviderFailure(
      service.signIn({ email: "viewer@example.test", password: "x" }),
    );
  });

  it("signOut forwards the request headers and hides provider failures", async () => {
    const { api, service } = setup();
    api.signOut.mockResolvedValueOnce();

    await service.signOut();
    expect(api.signOut).toHaveBeenCalledWith({ headers: REQUEST_HEADERS });

    api.signOut.mockRejectedValueOnce(providerError("INTERNAL"));
    await expectSafeProviderFailure(service.signOut());
  });
});

describe("ServerAuthService current session", () => {
  it("returns null for a guest without querying the profile", async () => {
    const { api, users, service } = setup();
    api.getSession.mockResolvedValue(null);

    await expect(service.getCurrentSession()).resolves.toBeNull();
    await expect(service.getCurrentUser()).resolves.toBeNull();
    expect(users.findById).not.toHaveBeenCalled();
  });

  it("returns the profile with the account email and verification state", async () => {
    const { api, users, service } = setup();
    const profile = createUserRecord();
    api.getSession.mockResolvedValue({
      user: { id: USER_ID, email: "viewer@example.test", emailVerified: false },
    });
    users.findById.mockResolvedValue(profile);

    await expect(service.getCurrentSession()).resolves.toEqual({
      user: profile,
      email: "viewer@example.test",
      emailVerified: false,
    });
    expect(api.getSession).toHaveBeenCalledWith({ headers: REQUEST_HEADERS });
    expect(users.findById).toHaveBeenCalledWith(USER_ID);
  });

  it("rejects a malformed identity id as a provider failure", async () => {
    const { api, users, service } = setup();
    api.getSession.mockResolvedValue({
      user: { id: "not-a-uuid", email: "viewer@example.test", emailVerified: true },
    });

    await expect(service.getCurrentUser()).rejects.toBeInstanceOf(
      AuthProviderError,
    );
    expect(users.findById).not.toHaveBeenCalled();
  });

  it("throws UserProfileNotProvisionedError for an identity without profile", async () => {
    const { api, users, service } = setup();
    api.getSession.mockResolvedValue({
      user: { id: USER_ID, email: "viewer@example.test", emailVerified: true },
    });
    users.findById.mockResolvedValue(null);

    await expect(service.getCurrentUser()).rejects.toBeInstanceOf(
      UserProfileNotProvisionedError,
    );
  });

  it("maps database outages on the session lookup to ServiceUnavailableError", async () => {
    const { api, users, service } = setup();
    api.getSession.mockResolvedValueOnce({
      user: { id: USER_ID, email: "viewer@example.test", emailVerified: true },
    });
    users.findById.mockRejectedValueOnce(
      new Error("query failed", { cause: { code: "57P01" } }),
    );

    await expect(service.getCurrentUser()).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );

    api.getSession.mockRejectedValueOnce(
      Object.assign(new Error("down"), { code: "CONNECT_TIMEOUT" }),
    );
    await expect(service.getCurrentUser()).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("maps the provider's wrapped session failure (500) to ServiceUnavailableError, not the 401 variant", async () => {
    const { api, service } = setup();
    api.getSession.mockRejectedValueOnce(
      new APIError("INTERNAL_SERVER_ERROR", {
        code: "FAILED_TO_GET_SESSION",
        message: "Failed to get session",
      }),
    );

    await expect(service.getCurrentSession()).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );

    api.getSession.mockRejectedValueOnce(
      providerError("FAILED_TO_GET_SESSION", "UNAUTHORIZED"),
    );
    await expect(service.getCurrentSession()).rejects.not.toBeInstanceOf(
      ServiceUnavailableError,
    );

    api.getSession.mockRejectedValueOnce(
      new APIError("INTERNAL_SERVER_ERROR", {
        code: "SOMETHING_ELSE",
        message: "x",
      }),
    );
    await expect(service.getCurrentSession()).rejects.not.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("requireCurrentUser throws UnauthenticatedError for a guest", async () => {
    const { api, service } = setup();
    api.getSession.mockResolvedValue(null);

    const thrown = await rejection(service.requireCurrentUser());

    expect(thrown).toBeInstanceOf(UnauthenticatedError);
    expect(thrown).toMatchObject({
      name: "UnauthenticatedError",
      message: "Authentication required",
    });
  });
});

describe("ServerAuthService password reset and email verification", () => {
  it("requests a reset link with the canonical redirect", async () => {
    const { api, service } = setup();
    api.requestPasswordReset.mockResolvedValue();

    await service.requestPasswordReset({
      email: "viewer@example.test",
      redirectTo: "https://butaca.lat/reset-password",
    });

    expect(api.requestPasswordReset).toHaveBeenCalledWith({
      email: "viewer@example.test",
      redirectTo: "https://butaca.lat/reset-password",
      headers: REQUEST_HEADERS,
    });
  });

  it("limits reset requests per email without revealing account existence", async () => {
    const { api, service } = setup();
    api.requestPasswordReset.mockResolvedValue();
    const request = () =>
      service.requestPasswordReset({
        email: "viewer@example.test",
        redirectTo: "https://butaca.lat/reset-password",
      });

    await request();
    await request();
    await request();

    await expect(request()).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(api.requestPasswordReset).toHaveBeenCalledTimes(3);
  });

  it("updates the password with the explicit token", async () => {
    const { api, service } = setup();
    api.resetPassword.mockResolvedValue();

    await service.updatePassword({ newPassword: "NewPassword1", token: "tok" });

    expect(api.resetPassword).toHaveBeenCalledWith({
      newPassword: "NewPassword1",
      token: "tok",
      headers: REQUEST_HEADERS,
    });
  });

  it("maps an invalid or expired reset token to InvalidAuthTokenError", async () => {
    const { api, service } = setup();
    api.resetPassword.mockRejectedValue(providerError("INVALID_TOKEN"));

    await expect(
      service.updatePassword({ newPassword: "NewPassword1", token: "bad" }),
    ).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("verifies the email token and maps invalid ones", async () => {
    const { api, service } = setup();
    api.verifyEmail.mockResolvedValueOnce();

    await service.verifyEmail("tok");
    expect(api.verifyEmail).toHaveBeenCalledWith({
      token: "tok",
      headers: REQUEST_HEADERS,
    });

    api.verifyEmail.mockRejectedValueOnce(
      providerError("TOKEN_EXPIRED", "UNAUTHORIZED"),
    );
    await expect(service.verifyEmail("old")).rejects.toBeInstanceOf(
      InvalidAuthTokenError,
    );
  });
});

describe("ServerAuthService verification email delivery", () => {
  const input = {
    email: "viewer@example.test",
    password: "test-password",
    displayName: "Gonzalo",
  };

  it("keeps the account and profile when the verification email fails, and says so", async () => {
    const { api, users, service } = setup();
    const profile = createUserRecord({ displayName: "Gonzalo" });
    api.signUpEmail.mockResolvedValue({
      user: { id: USER_ID },
      verificationEmailFailed: true,
    });
    users.upsertFromAuthUser.mockResolvedValue(profile);

    await expect(service.registerAccount(input)).resolves.toEqual({
      user: profile,
      verificationEmail: "failed",
    });
    await expect(service.signUp(input)).resolves.toBe(profile);
  });

  it("reports a delivered verification email as sent", async () => {
    const { api, users, service } = setup();
    api.signUpEmail.mockResolvedValue({
      user: { id: USER_ID },
      verificationEmailFailed: false,
    });
    users.upsertFromAuthUser.mockResolvedValue(createUserRecord());

    await expect(service.registerAccount(input)).resolves.toMatchObject({
      verificationEmail: "sent",
    });
  });

  it("retries the verification email for the signed-in user", async () => {
    const { api, users, service } = setup();
    api.getSession.mockResolvedValue({
      user: { id: USER_ID, email: "viewer@example.test", emailVerified: false },
    });
    users.findById.mockResolvedValue(createUserRecord());
    api.sendVerificationEmail.mockResolvedValue();

    await service.requestEmailVerification();

    expect(api.sendVerificationEmail).toHaveBeenCalledWith({
      email: "viewer@example.test",
      headers: REQUEST_HEADERS,
    });
  });

  it("never claims a send that failed during the retry", async () => {
    const { api, users, service } = setup();
    api.getSession.mockResolvedValue({
      user: { id: USER_ID, email: "viewer@example.test", emailVerified: false },
    });
    users.findById.mockResolvedValue(createUserRecord());
    api.sendVerificationEmail.mockRejectedValue(
      new EmailDeliveryError("status 403"),
    );

    await expect(service.requestEmailVerification()).rejects.toBeInstanceOf(
      VerificationEmailNotSentError,
    );
  });

  it("skips the retry for a verified address and rejects guests", async () => {
    const { api, users, service } = setup();
    users.findById.mockResolvedValue(createUserRecord());
    api.getSession.mockResolvedValueOnce({
      user: { id: USER_ID, email: "viewer@example.test", emailVerified: true },
    });

    await service.requestEmailVerification();
    expect(api.sendVerificationEmail).not.toHaveBeenCalled();

    api.getSession.mockResolvedValueOnce(null);
    await expect(service.requestEmailVerification()).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });
});

describe("ServerAuthService rate limiting", () => {
  it("limits sign-in attempts per email before reaching the provider", async () => {
    const { api, service } = setup();
    api.signInEmail.mockRejectedValue(
      providerError("INVALID_EMAIL_OR_PASSWORD", "UNAUTHORIZED"),
    );
    const attempt = () =>
      service.signIn({ email: "viewer@example.test", password: "x" });

    for (let index = 0; index < 10; index += 1) {
      await expect(attempt()).rejects.toBeInstanceOf(InvalidCredentialsError);
    }

    await expect(attempt()).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(api.signInEmail).toHaveBeenCalledTimes(10);
  });

  it("buckets by the first forwarded address", async () => {
    const api = createApiDouble();
    const users = createUsersDouble();
    const limiter = createRateLimiter();
    api.resetPassword.mockResolvedValue();
    const service = (address: string) =>
      new ServerAuthService(api, users, {
        headers: new Headers({ "x-forwarded-for": `${address}, 10.0.0.1` }),
        limiter,
      });

    for (let index = 0; index < 20; index += 1) {
      await service("198.51.100.1").updatePassword({ newPassword: "a", token: "t" });
    }

    await expect(
      service("198.51.100.1").updatePassword({ newPassword: "a", token: "t" }),
    ).rejects.toBeInstanceOf(AuthRateLimitedError);
    await expect(
      service("198.51.100.2").updatePassword({ newPassword: "a", token: "t" }),
    ).resolves.toBeUndefined();
  });
});
