import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthRateLimitedError,
  UnauthenticatedError,
  VerificationEmailNotSentError,
} from "@/features/auth/errors";

const requestEmailVerification = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/server-auth-factory", () => ({
  getServerAuthService: async () => ({ requestEmailVerification }),
}));

vi.mock("@/integrations/better-auth", () => ({
  getAuthBaseUrl: () => "https://butaca.test",
}));

const { POST: handler } = await import("./route");

const sameOriginRequest = () =>
  new Request("https://butaca.test/api/resend-verification", {
    method: "POST",
    headers: { origin: "https://butaca.test" },
  });
const POST = () => handler(sameOriginRequest());

describe("POST /api/resend-verification", () => {
  beforeEach(() => {
    requestEmailVerification.mockReset();
  });

  it("asks the service for the signed-in user and answers 204 without a body", async () => {
    requestEmailVerification.mockResolvedValue(undefined);

    const response = await POST();

    expect(response.status).toBe(204);
    expect(requestEmailVerification).toHaveBeenCalledWith();
    expect(await response.text()).toBe("");
  });

  it("surfaces a mail provider failure as a retryable 503", async () => {
    requestEmailVerification.mockRejectedValue(
      new VerificationEmailNotSentError(),
    );

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it("maps rate limiting to 429", async () => {
    requestEmailVerification.mockImplementation(async () => {
      throw new AuthRateLimitedError();
    });

    expect((await POST()).status).toBe(429);
  });

  it("never succeeds without a session", async () => {
    requestEmailVerification.mockImplementation(async () => {
      throw new UnauthenticatedError();
    });

    expect((await POST()).status).not.toBe(204);
  });
});
