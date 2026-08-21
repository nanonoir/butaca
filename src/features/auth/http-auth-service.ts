import {
  AuthErrorResponseSchema,
  AuthUserResponseSchema,
  type AuthUser,
} from "@/contracts/auth";

import { AuthServiceError, type AuthService } from "./auth-service";

export const AUTH_ENDPOINT = {
  REGISTER: "/api/register",
  LOGIN: "/api/login",
  LOGOUT: "/api/logout",
  FORGOT_PASSWORD: "/api/forgot-password",
  RESET_PASSWORD: "/api/reset-password",
} as const;

const NO_CONTENT_STATUS = 204;

/** Transport failures are indistinguishable from an unreachable provider from
 * the browser's point of view, so both surface as AUTH_UNAVAILABLE and the
 * forms render their generic retry copy. */
async function postAuth(path: string, body: unknown): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthServiceError({ code: "AUTH_UNAVAILABLE" });
  }

  if (response.status === NO_CONTENT_STATUS) {
    return null;
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new AuthServiceError({
      code: response.ok ? "UNKNOWN_ERROR" : "AUTH_UNAVAILABLE",
    });
  }

  if (!response.ok) {
    const parsed = AuthErrorResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AuthServiceError({ code: "AUTH_UNAVAILABLE" });
    }

    throw new AuthServiceError({
      code: parsed.data.error.code,
      field: parsed.data.error.field,
    });
  }

  return payload;
}

function parseAuthUser(payload: unknown): AuthUser {
  const parsed = AuthUserResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AuthServiceError({ code: "UNKNOWN_ERROR" });
  }

  return parsed.data.data;
}

export const httpAuthService: AuthService = {
  async register(input) {
    return parseAuthUser(await postAuth(AUTH_ENDPOINT.REGISTER, input));
  },
  async login(input) {
    return parseAuthUser(await postAuth(AUTH_ENDPOINT.LOGIN, input));
  },
  async forgotPassword(input) {
    await postAuth(AUTH_ENDPOINT.FORGOT_PASSWORD, input);
  },
  async resetPassword(input) {
    await postAuth(AUTH_ENDPOINT.RESET_PASSWORD, input);
  },
};

export async function logoutRequest(): Promise<void> {
  await postAuth(AUTH_ENDPOINT.LOGOUT, {});
}
