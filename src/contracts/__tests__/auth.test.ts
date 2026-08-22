import { describe, expect, it } from "vitest";

import {
  AuthEmailSchema,
  AuthErrorCodeSchema,
  AuthUserSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  PasswordSchema,
  PASSWORD_POLICY,
} from "..";

describe("auth contracts", () => {
  it("normalizes usernames and email addresses", () => {
    const result = RegisterRequestSchema.parse({
      username: "  Movie_Fan  ",
      email: "  USER@EXAMPLE.COM ",
      password: "StrongPass1",
      confirmPassword: "StrongPass1",
    });

    expect(result.username).toBe("Movie_Fan");
    expect(result.email).toBe("user@example.com");
  });

  it("enforces username and registration password rules", () => {
    expect(
      RegisterRequestSchema.safeParse({
        username: "ab-",
        email: "user@example.com",
        password: "weakpass",
        confirmPassword: "different",
      }).success,
    ).toBe(false);
  });

  it("does not apply registration complexity rules to login passwords", () => {
    const result = LoginRequestSchema.safeParse({
      email: " USER@EXAMPLE.COM ",
      password: "short",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("requires matching reset passwords", () => {
    expect(
      ResetPasswordRequestSchema.safeParse({
        newPassword: "StrongPass1",
        confirmPassword: "DifferentPass1",
      }).success,
    ).toBe(false);
  });

  it("normalizes recovery emails without exposing account state", () => {
    const result = ForgotPasswordRequestSchema.safeParse({
      email: "  USER@EXAMPLE.COM ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("requires the reset password policy before matching confirmation", () => {
    const result = ResetPasswordRequestSchema.safeParse({
      newPassword: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "newPassword"))
        .toBe(true);
    }
  });

  it("uses the shared password policy for contracts and UI-facing requirements", () => {
    const validPassword = `${"a".repeat(PASSWORD_POLICY.MIN_LENGTH - 2)}A1`;
    const shortPassword = `${"a".repeat(PASSWORD_POLICY.MIN_LENGTH - 3)}A1`;

    expect(PasswordSchema.safeParse(validPassword).success).toBe(true);
    expect(PasswordSchema.safeParse(shortPassword).success).toBe(false);
    expect(PASSWORD_POLICY.UPPERCASE.test(validPassword)).toBe(true);
    expect(PASSWORD_POLICY.LOWERCASE.test(validPassword)).toBe(true);
    expect(PASSWORD_POLICY.NUMBER.test(validPassword)).toBe(true);
  });

  it("validates the product-facing user and normalized error code contracts", () => {
    expect(
      AuthUserSchema.safeParse({
        id: "00000000-0000-4000-8000-000000000000",
        username: "Movie_Fan",
        email: "USER@EXAMPLE.COM",
      }).success,
    ).toBe(true);
    expect(AuthEmailSchema.parse("USER@EXAMPLE.COM")).toBe("user@example.com");
    expect(AuthErrorCodeSchema.parse("INVALID_CREDENTIALS")).toBe(
      "INVALID_CREDENTIALS",
    );
  });
});
