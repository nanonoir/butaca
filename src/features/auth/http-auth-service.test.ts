import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthServiceError } from "./auth-service";
import {
  AUTH_ENDPOINT,
  httpAuthService,
  logoutRequest,
} from "./http-auth-service";

const LOGIN_INPUT = {
  email: "viewer@example.test",
  password: "Test-password1",
};

const AUTH_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "viewer",
  email: "viewer@example.test",
};

function mockFetch(response: Response | Promise<Response>) {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function expectAuthError(
  operation: Promise<unknown>,
  expected: { code: string; field?: string },
) {
  let thrown: unknown;

  try {
    await operation;
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(AuthServiceError);
  expect(thrown).toMatchObject(expected);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpAuthService", () => {
  it("posts the login request as JSON to the login endpoint", async () => {
    const fetchMock = mockFetch(jsonResponse({ data: AUTH_USER }, 200));

    await expect(httpAuthService.login(LOGIN_INPUT)).resolves.toEqual(
      AUTH_USER,
    );
    expect(fetchMock).toHaveBeenCalledWith(AUTH_ENDPOINT.LOGIN, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(LOGIN_INPUT),
    });
  });

  it("returns the registered user from a 201 response", async () => {
    mockFetch(jsonResponse({ data: AUTH_USER }, 201));

    await expect(
      httpAuthService.register({
        username: "viewer",
        email: "viewer@example.test",
        password: "Test-password1",
        confirmPassword: "Test-password1",
      }),
    ).resolves.toEqual(AUTH_USER);
  });

  it("maps a contract error body to the matching service error and field", async () => {
    mockFetch(
      jsonResponse(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            field: "password",
            message: "Invalid email or password",
          },
        },
        401,
      ),
    );

    await expectAuthError(httpAuthService.login(LOGIN_INPUT), {
      code: "INVALID_CREDENTIALS",
      field: "password",
    });
  });

  it("maps an error body that does not match the contract to AUTH_UNAVAILABLE", async () => {
    mockFetch(jsonResponse({ oops: true }, 500));

    await expectAuthError(httpAuthService.login(LOGIN_INPUT), {
      code: "AUTH_UNAVAILABLE",
    });
  });

  it("maps a transport failure to AUTH_UNAVAILABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );

    await expectAuthError(httpAuthService.login(LOGIN_INPUT), {
      code: "AUTH_UNAVAILABLE",
    });
  });

  it("maps a success body that does not match the contract to UNKNOWN_ERROR", async () => {
    mockFetch(jsonResponse({ data: { id: "not-a-uuid" } }, 200));

    await expectAuthError(httpAuthService.login(LOGIN_INPUT), {
      code: "UNKNOWN_ERROR",
    });
  });

  it("treats 204 as success for the operations without a payload", async () => {
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await expect(
      httpAuthService.forgotPassword({ email: "viewer@example.test" }),
    ).resolves.toBeUndefined();
    await expect(
      httpAuthService.resetPassword({
        newPassword: "Test-password1",
        confirmPassword: "Test-password1",
      }),
    ).resolves.toBeUndefined();
    await expect(logoutRequest()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces an expired recovery link from the reset endpoint", async () => {
    mockFetch(
      jsonResponse(
        { error: { code: "INVALID_RESET_LINK", message: "invalid" } },
        400,
      ),
    );

    await expectAuthError(
      httpAuthService.resetPassword({
        newPassword: "Test-password1",
        confirmPassword: "Test-password1",
      }),
      { code: "INVALID_RESET_LINK" },
    );
  });
});
