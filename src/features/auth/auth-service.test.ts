import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_REQUEST_TIMEOUT_MS, withAuthTimeout } from "./auth-service";
import { AuthServiceStub } from "./auth-service.stub";

afterEach(() => {
  vi.useRealTimers();
});

describe("AuthServiceStub", () => {
  it("returns normalized users through the AuthService boundary", async () => {
    const service = new AuthServiceStub({ delayMs: 0 });

    const user = await service.register({
      username: "  Movie_Fan  ",
      email: "  USER@EXAMPLE.COM ",
      password: "StrongPass1",
      confirmPassword: "StrongPass1",
    });

    expect(user.username).toBe("Movie_Fan");
    expect(user.email).toBe("user@example.com");
  });

  it("exposes configured failures as normalized AuthServiceErrors", async () => {
    const service = new AuthServiceStub({
      delayMs: 0,
      errors: { login: { code: "INVALID_CREDENTIALS" } },
    });

    await expect(
      service.login({ email: "user@example.com", password: "short" }),
    ).rejects.toMatchObject({
      name: "AuthServiceError",
      code: "INVALID_CREDENTIALS",
    });
  });

  it("validates recovery and reset inputs without introducing provider behavior", async () => {
    const service = new AuthServiceStub({ delayMs: 0 });

    await expect(
      service.forgotPassword({ email: "USER@EXAMPLE.COM" }),
    ).resolves.toBeUndefined();
    await expect(
      service.resetPassword({
        newPassword: "StrongPass1",
        confirmPassword: "StrongPass1",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects hung requests with AUTH_UNAVAILABLE after the finite timeout", async () => {
    vi.useFakeTimers();
    const request = new Promise<void>(() => undefined);
    const guardedRequest = withAuthTimeout(request, AUTH_REQUEST_TIMEOUT_MS);

    const rejection = expect(guardedRequest).rejects.toMatchObject({
      name: "AuthServiceError",
      code: "AUTH_UNAVAILABLE",
    });

    await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await rejection;
  });

  it("clears the timeout when a request settles", async () => {
    vi.useFakeTimers();

    await expect(withAuthTimeout(Promise.resolve("ok"), 1000)).resolves.toBe(
      "ok",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
