import "server-only";

import type { z } from "zod";

import type {
  AuthErrorCode,
  AuthErrorField,
  AuthErrorResponse,
  AuthUser,
} from "@/contracts";
import { AuthUserSchema } from "@/contracts/auth";

import type { UserRecord } from "../../db/schema/users";
import { getAuthBaseUrl } from "../../integrations/better-auth";

import { rejectUntrustedAuthRequest } from "./auth-request";

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

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const USERNAME_PADDING_CHARACTER = "_";

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  USERNAME_TAKEN: 409,
  EMAIL_ALREADY_REGISTERED: 409,
  WEAK_PASSWORD: 400,
  PASSWORDS_DO_NOT_MATCH: 400,
  INVALID_RESET_LINK: 400,
  RESET_LINK_EXPIRED: 410,
  RATE_LIMITED: 429,
  AUTH_UNAVAILABLE: 503,
  UNKNOWN_ERROR: 500,
};

/** Messages stay generic on purpose: the forms own the user-facing copy and
 * map it from the code, so nothing here can leak provider detail. */
const AUTH_ERROR_MESSAGE: Record<AuthErrorCode, string> = {
  VALIDATION_ERROR: "The submitted values are not valid",
  INVALID_CREDENTIALS: "Invalid email or password",
  USERNAME_TAKEN: "That username is already taken",
  EMAIL_ALREADY_REGISTERED: "That email is already registered",
  WEAK_PASSWORD: "The password does not meet the policy",
  PASSWORDS_DO_NOT_MATCH: "The passwords do not match",
  INVALID_RESET_LINK: "The recovery link is not valid",
  RESET_LINK_EXPIRED: "The recovery link has expired",
  RATE_LIMITED: "Too many attempts, try again later",
  AUTH_UNAVAILABLE: "Authentication is unavailable",
  UNKNOWN_ERROR: "Unexpected authentication error",
};

/** `public.users.display_name` allows 1..80 characters of any kind, while the
 * client `UsernameSchema` allows 3..30 of `[A-Za-z0-9_]`. Registration writes a
 * conforming value, but a profile provisioned from an email local part may not
 * conform, so the mapping is made total instead of throwing at the boundary. */
export function toAuthUsername(displayName: string): string {
  const sanitized = [...displayName.trim()]
    .map((character) => (/[A-Za-z0-9_]/.test(character) ? character : "_"))
    .join("")
    .slice(0, USERNAME_MAX_LENGTH);

  return sanitized.padEnd(USERNAME_MIN_LENGTH, USERNAME_PADDING_CHARACTER);
}

export function toAuthUser(user: UserRecord, email: string): AuthUser {
  return AuthUserSchema.parse({
    id: user.id,
    username: toAuthUsername(user.displayName),
    email,
  });
}

export function authErrorBody(
  code: AuthErrorCode,
  field?: AuthErrorField,
): AuthErrorResponse {
  return {
    error: { code, message: AUTH_ERROR_MESSAGE[code], ...(field && { field }) },
  };
}

export function authErrorStatus(code: AuthErrorCode): number {
  return AUTH_ERROR_STATUS[code];
}

export function authErrorResponse(
  code: AuthErrorCode,
  field?: AuthErrorField,
): Response {
  return Response.json(authErrorBody(code, field), {
    status: authErrorStatus(code),
  });
}

const AUTH_ERROR_FIELDS = new Set<string>([
  "username",
  "email",
  "password",
  "confirmPassword",
  "newPassword",
]);

function firstInvalidField(error: z.ZodError): AuthErrorField | undefined {
  for (const issue of error.issues) {
    const [path] = issue.path;

    if (typeof path === "string" && AUTH_ERROR_FIELDS.has(path)) {
      return path as AuthErrorField;
    }
  }

  return undefined;
}

/** Canonical shape of every auth route: validate the request with the shared
 * contract, run the application service, and map any failure to a code the
 * client already renders. Handlers never build responses by hand. */
export async function runAuthRoute<T>(
  request: Request,
  schema: z.ZodType<T>,
  action: (input: T) => Promise<Response>,
): Promise<Response> {
  if (isUntrusted(request, true)) {
    return authErrorResponse("VALIDATION_ERROR");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return authErrorResponse("VALIDATION_ERROR");
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return authErrorResponse(
      "VALIDATION_ERROR",
      firstInvalidField(parsed.error),
    );
  }

  return runAuthAction(request, () => action(parsed.data), { json: true });
}

function isUntrusted(request: Request, json: boolean): boolean {
  try {
    return (
      rejectUntrustedAuthRequest(request, getAuthBaseUrl(), { json }) !== null
    );
  } catch {
    // Unusable canonical origin: fail closed.
    return true;
  }
}

/** Every auth POST goes through here, so the origin gate cannot be skipped.
 * `json` is false for the routes that take no body (logout, resend). */
export async function runAuthAction(
  request: Request,
  action: () => Promise<Response>,
  options: { json: boolean } = { json: false },
): Promise<Response> {
  if (isUntrusted(request, options.json)) {
    return authErrorResponse("VALIDATION_ERROR");
  }

  try {
    return await action();
  } catch (error) {
    return authErrorResponse(toAuthErrorCode(error));
  }
}

/** Domain errors never cross the HTTP boundary as-is; every one of them maps to
 * a code the forms already know how to render. */
export function toAuthErrorCode(error: unknown): AuthErrorCode {
  if (error instanceof InvalidCredentialsError) {
    return "INVALID_CREDENTIALS";
  }

  if (error instanceof AuthRateLimitedError) {
    return "RATE_LIMITED";
  }

  if (
    error instanceof UnauthenticatedError ||
    error instanceof UserProfileNotProvisionedError
  ) {
    return "AUTH_UNAVAILABLE";
  }

  if (
    error instanceof AuthProviderError ||
    error instanceof ServiceUnavailableError ||
    error instanceof VerificationEmailNotSentError
  ) {
    return "AUTH_UNAVAILABLE";
  }

  if (error instanceof EmailAlreadyRegisteredError) {
    return "EMAIL_ALREADY_REGISTERED";
  }

  if (error instanceof WeakPasswordError) {
    return "WEAK_PASSWORD";
  }

  if (error instanceof InvalidAuthTokenError) {
    return "INVALID_RESET_LINK";
  }

  return "UNKNOWN_ERROR";
}
