import { describe, expect, it, vi } from "vitest";

vi.mock("../../integrations/better-auth", () => ({
  getAuthBaseUrl: () => "https://butaca.test",
}));

import { z } from "zod";

import { AuthErrorResponseSchema, AuthUserSchema } from "@/contracts/auth";

import type { UserRecord } from "../../db/schema/users";

import {
  authErrorBody,
  authErrorStatus,
  runAuthAction,
  runAuthRoute,
  toAuthErrorCode,
  toAuthUser,
  toAuthUsername,
} from "./auth-http";
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

describe("auth POST origin guard", () => {
  const schema = z.object({ email: z.string() });
  const sameOrigin = {
    origin: "https://butaca.test",
    "sec-fetch-site": "same-origin",
  };

  function post(headers: Record<string, string>, body?: string): Request {
    return new Request("https://butaca.test/api/login", {
      method: "POST",
      headers,
      body,
    });
  }

  function jsonPost(headers: Record<string, string>): Request {
    return post(
      { "content-type": "application/json", ...headers },
      JSON.stringify({ email: "a@b.test" }),
    );
  }

  async function expectRejected(
    response: Response,
    provider: ReturnType<typeof vi.fn>,
  ): Promise<void> {
    expect(response.status).toBe(400);
    expect(
      AuthErrorResponseSchema.parse(await response.json()).error.code,
    ).toBe("VALIDATION_ERROR");
    expect(provider).not.toHaveBeenCalled();
  }

  it.each([
    [
      "login CSRF with no cookie from a foreign origin",
      { origin: "https://evil.test" },
    ],
    ["a null origin", { origin: "null" }],
    ["a malformed origin", { origin: "not a url" }],
    ["a missing origin", {}],
    ["an origin with another port", { origin: "https://butaca.test:8443" }],
    ["a forged referer without origin", { referer: "https://butaca.test/" }],
    [
      "cross-site fetch metadata despite a matching origin",
      { origin: "https://butaca.test", "sec-fetch-site": "cross-site" },
    ],
    [
      "same-site fetch metadata",
      { origin: "https://butaca.test", "sec-fetch-site": "same-site" },
    ],
  ])(
    "rejects %s on body routes without calling the provider",
    async (_n, h) => {
      const provider = vi.fn(async () => new Response(null, { status: 204 }));

      await expectRejected(
        await runAuthRoute(jsonPost(h), schema, provider),
        provider,
      );
    },
  );

  it.each([
    [
      "logout with a foreign origin and cookie",
      { origin: "https://evil.test", cookie: "session=1" },
    ],
    ["a missing origin", {}],
    [
      "cross-site fetch metadata",
      { origin: "https://butaca.test", "sec-fetch-site": "cross-site" },
    ],
  ])(
    "rejects %s on bodiless routes without calling the provider",
    async (_n, h) => {
      const provider = vi.fn(async () => new Response(null, { status: 204 }));

      await expectRejected(await runAuthAction(post(h), provider), provider);
    },
  );

  it("rejects simple (form) content types on body routes", async () => {
    const provider = vi.fn(async () => new Response(null, { status: 204 }));
    const request = post(
      { ...sameOrigin, "content-type": "text/plain" },
      JSON.stringify({ email: "a@b.test" }),
    );

    await expectRejected(
      await runAuthRoute(request, schema, provider),
      provider,
    );
  });

  it("runs a same-origin JSON request", async () => {
    const provider = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await runAuthRoute(jsonPost(sameOrigin), schema, provider);

    expect(response.status).toBe(204);
    expect(provider).toHaveBeenCalledWith({ email: "a@b.test" });
  });

  it("accepts a same-origin client that sends no fetch metadata", async () => {
    const provider = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await runAuthRoute(
      jsonPost({ origin: "https://butaca.test" }),
      schema,
      provider,
    );

    expect(response.status).toBe(204);
  });

  it("runs a same-origin bodiless request", async () => {
    const provider = vi.fn(async () => new Response(null, { status: 204 }));
    const response = await runAuthAction(post(sameOrigin), provider);

    expect(response.status).toBe(204);
    expect(provider).toHaveBeenCalledOnce();
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
  });

  it("maps the Better Auth era errors to existing contract codes", () => {
    expect(toAuthErrorCode(new ServiceUnavailableError())).toBe(
      "AUTH_UNAVAILABLE",
    );
    expect(toAuthErrorCode(new EmailAlreadyRegisteredError())).toBe(
      "EMAIL_ALREADY_REGISTERED",
    );
    expect(toAuthErrorCode(new WeakPasswordError())).toBe("WEAK_PASSWORD");
    expect(toAuthErrorCode(new InvalidAuthTokenError())).toBe(
      "INVALID_RESET_LINK",
    );
    expect(toAuthErrorCode(new AuthRateLimitedError())).toBe("RATE_LIMITED");
    expect(toAuthErrorCode(new VerificationEmailNotSentError())).toBe(
      "AUTH_UNAVAILABLE",
    );
    expect(toAuthErrorCode("not an error")).toBe("UNKNOWN_ERROR");
  });
});
