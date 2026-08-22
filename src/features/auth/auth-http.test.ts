import { describe, expect, it } from "vitest";

import { AuthErrorResponseSchema, AuthUserSchema } from "@/contracts/auth";

import type { UserRecord } from "../../db/schema/users";

import {
  authErrorBody,
  authErrorStatus,
  toAuthErrorCode,
  toAuthUser,
  toAuthUsername,
} from "./auth-http";
import {
  AuthProviderError,
  InvalidCredentialsError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
} from "./errors";

function createUserRecord(displayName: string): UserRecord {
  return {
    id: "6f1d6f2c-4a6f-4a1e-9f0e-1d2c3b4a5e6f",
    displayName,
    avatarUrl: null,
    onboardingCompletedAt: null,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z"),
  };
}

describe("toAuthUsername", () => {
  it("keeps an already conforming display name untouched", () => {
    expect(toAuthUsername("sofia_ramirez")).toBe("sofia_ramirez");
  });

  it("replaces characters the username contract rejects", () => {
    expect(toAuthUsername("Sofía Ramírez")).toBe("Sof_a_Ram_rez");
  });

  it("pads a display name shorter than the username minimum", () => {
    expect(toAuthUsername("ab")).toBe("ab_");
  });

  it("truncates a display name longer than the username maximum", () => {
    expect(toAuthUsername("a".repeat(80))).toBe("a".repeat(30));
  });

  it("always produces a value the username contract accepts", () => {
    for (const displayName of [
      "Sofía Ramírez",
      "ab",
      "a".repeat(80),
      "Film Match user",
      "___",
    ]) {
      expect(
        AuthUserSchema.safeParse({
          id: "6f1d6f2c-4a6f-4a1e-9f0e-1d2c3b4a5e6f",
          username: toAuthUsername(displayName),
          email: "person@example.test",
        }).success,
      ).toBe(true);
    }
  });
});

describe("toAuthUser", () => {
  it("combines the stored profile with the authenticated email", () => {
    expect(
      toAuthUser(createUserRecord("sofia_ramirez"), "sofia@example.test"),
    ).toEqual({
      id: "6f1d6f2c-4a6f-4a1e-9f0e-1d2c3b4a5e6f",
      username: "sofia_ramirez",
      email: "sofia@example.test",
    });
  });

  it("never exposes stored profile fields beyond the auth contract", () => {
    expect(
      Object.keys(toAuthUser(createUserRecord("viewer"), "v@example.test")),
    ).toEqual(["id", "username", "email"]);
  });
});

describe("auth error responses", () => {
  it("builds a body the shared contract accepts", () => {
    expect(
      AuthErrorResponseSchema.safeParse(
        authErrorBody("INVALID_CREDENTIALS", "password"),
      ).success,
    ).toBe(true);
  });

  it("omits the field when the error is not attached to one", () => {
    expect(authErrorBody("AUTH_UNAVAILABLE")).toEqual({
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication is unavailable",
      },
    });
  });

  it("maps each code to its transport status", () => {
    expect(authErrorStatus("INVALID_CREDENTIALS")).toBe(401);
    expect(authErrorStatus("EMAIL_ALREADY_REGISTERED")).toBe(409);
    expect(authErrorStatus("RATE_LIMITED")).toBe(429);
    expect(authErrorStatus("AUTH_UNAVAILABLE")).toBe(503);
    expect(authErrorStatus("UNKNOWN_ERROR")).toBe(500);
  });
});

describe("toAuthErrorCode", () => {
  it("maps invalid credentials to the credential code", () => {
    expect(toAuthErrorCode(new InvalidCredentialsError())).toBe(
      "INVALID_CREDENTIALS",
    );
  });

  it("maps every provider and session failure to AUTH_UNAVAILABLE", () => {
    expect(toAuthErrorCode(new AuthProviderError())).toBe("AUTH_UNAVAILABLE");
    expect(toAuthErrorCode(new UnauthenticatedError())).toBe(
      "AUTH_UNAVAILABLE",
    );
    expect(toAuthErrorCode(new UserProfileNotProvisionedError())).toBe(
      "AUTH_UNAVAILABLE",
    );
  });

  it("maps anything unrecognized to UNKNOWN_ERROR", () => {
    expect(toAuthErrorCode(new Error("boom"))).toBe("UNKNOWN_ERROR");
    expect(toAuthErrorCode("not an error")).toBe("UNKNOWN_ERROR");
  });
});
