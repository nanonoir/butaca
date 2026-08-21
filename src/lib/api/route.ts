import "server-only";

import { z } from "zod";

import type { ApiErrorCode } from "@/contracts";
import {
  AuthProviderError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
} from "@/features/auth/errors";
import { getServerAuthService } from "@/features/auth/server-auth-factory";
import { TmdbError } from "@/integrations/tmdb";

import type { UserRecord } from "../../db/schema/users";

const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  ONBOARDING_REQUIRED: 403,
  MOVIE_NOT_FOUND: 404,
  REACTION_NOT_FOUND: 404,
  REACTION_REQUIRED: 409,
  REVIEW_NOT_FOUND: 404,
  TMDB_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const API_ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: "The request payload is not valid",
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "You cannot access this resource",
  NOT_FOUND: "Resource not found",
  CONFLICT: "The resource is in a conflicting state",
  RATE_LIMITED: "Too many requests, try again later",
  ONBOARDING_REQUIRED: "Complete onboarding first",
  MOVIE_NOT_FOUND: "Movie not found",
  REACTION_NOT_FOUND: "There is no reaction for this movie",
  REACTION_REQUIRED: "A reaction is required first",
  REVIEW_NOT_FOUND: "Review not found",
  TMDB_UNAVAILABLE: "The movie catalog is unavailable",
  INTERNAL_ERROR: "Unexpected error",
};

/** Thrown by services to pick an exact contract code. Anything else that
 * escapes a handler is mapped defensively and never leaks its message. */
export class ApiRouteError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = "ApiRouteError";
  }
}

export function apiData(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

export function apiError(code: ApiErrorCode, details?: unknown): Response {
  return Response.json(
    {
      error: {
        code,
        message: API_ERROR_MESSAGE[code],
        ...(details !== undefined && { details }),
      },
    },
    { status: API_ERROR_STATUS[code] },
  );
}

/** TMDB failures are the one provider detail worth distinguishing: a missing
 * movie is a client error, everything else is an upstream outage. */
function tmdbErrorCode(error: TmdbError): ApiErrorCode {
  return error.code === "NOT_FOUND" ? "MOVIE_NOT_FOUND" : "TMDB_UNAVAILABLE";
}

export function toApiErrorCode(error: unknown): ApiErrorCode {
  if (error instanceof ApiRouteError) {
    return error.code;
  }

  if (error instanceof z.ZodError) {
    return "VALIDATION_ERROR";
  }

  if (
    error instanceof UnauthenticatedError ||
    error instanceof UserProfileNotProvisionedError
  ) {
    return "UNAUTHORIZED";
  }

  if (error instanceof TmdbError) {
    return tmdbErrorCode(error);
  }

  if (error instanceof AuthProviderError) {
    return "INTERNAL_ERROR";
  }

  return "INTERNAL_ERROR";
}

/** Canonical shape of every product Route Handler: run the handler, and turn
 * any failure into a contract error. Handlers never build error responses. */
export async function runApiRoute(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    const code = toApiErrorCode(error);

    return apiError(
      code,
      error instanceof ApiRouteError ? error.details : undefined,
    );
  }
}

/** Route Handlers are public endpoints: the proxy guard protects navigation,
 * not data, so every private route has to authorize on its own. */
export async function requireViewer(): Promise<UserRecord> {
  const authService = await getServerAuthService();

  return authService.requireCurrentUser();
}

/** For endpoints that are readable by anyone: a guest resolves to null instead
 * of failing, while a broken session still surfaces as an error. */
export async function getOptionalViewer(): Promise<UserRecord | null> {
  const authService = await getServerAuthService();

  return authService.getCurrentUser();
}

export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiRouteError("VALIDATION_ERROR");
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiRouteError("VALIDATION_ERROR");
  }

  return parsed.data;
}
