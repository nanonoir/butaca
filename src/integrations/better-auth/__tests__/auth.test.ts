import { describe, expect, it, vi } from "vitest";

import { createDatabaseConnection } from "@/db/client";

import { createAuth, MAX_PASSWORD_LENGTH } from "../auth";
import { trackMailDelivery } from "../mail-outcome";

const config = { secret: "s".repeat(32), baseURL: "https://butaca.lat" };
const user = { id: "u", email: "ana@example.test", name: "Ana" } as never;

function build(
  mailer = { send: vi.fn().mockResolvedValue(undefined) },
  onMailError?: (error: unknown) => void,
) {
  // postgres.js connects lazily, so no database is needed to build the instance.
  const { db } = createDatabaseConnection("postgres://u:p@127.0.0.1:1/none");
  const auth = createAuth({ db, config, mailer, onMailError });

  return { auth, send: mailer.send };
}

describe("createAuth", () => {
  it("keeps verification out of the sign-in path and uses UUID ids", () => {
    const { auth } = build();

    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(false);
    expect(auth.options.emailAndPassword?.autoSignIn).toBe(true);
    expect(auth.options.emailAndPassword?.maxPasswordLength).toBe(
      MAX_PASSWORD_LENGTH,
    );
    expect(auth.options.emailVerification?.sendOnSignUp).toBe(true);
    expect(auth.options.advanced?.database?.generateId).toBe("uuid");
  });

  it("never logs provider messages or arguments, only a fixed category", () => {
    const { auth } = build();
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      for (const level of ["debug", "info", "warn", "error"] as const) {
        auth.options.logger?.log?.(
          level,
          "token=SECRET-TOKEN ana@example.test",
          new Error(
            "insert into session params: SECRET-TOKEN ana@example.test",
          ),
          { token: "SECRET-TOKEN" },
        );
      }

      const output = JSON.stringify(
        [error, warn, info, log].flatMap((spy) => spy.mock.calls),
      );

      expect(error).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledOnce();
      expect(output).not.toContain("SECRET-TOKEN");
      expect(output).not.toContain("ana@example.test");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("leaves CSRF and origin protections enabled", () => {
    const { auth } = build();

    const advanced: Record<string, unknown> = auth.options.advanced ?? {};

    expect(advanced.disableCSRFCheck).toBeUndefined();
    expect(advanced.disableOriginCheck).toBeUndefined();
    expect(auth.options.trustedOrigins).toEqual(["https://butaca.lat"]);
  });

  it("emails a reset link to the requested redirect with the token", async () => {
    const { auth, send } = build();
    const url =
      "https://butaca.lat/api/auth/reset-password/tok?callbackURL=https%3A%2F%2Fbutaca.lat%2Fconfirm";

    await auth.options.emailAndPassword?.sendResetPassword?.({
      user,
      url,
      token: "tok",
    });

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]![0].to).toBe("ana@example.test");
    expect(send.mock.calls[0]![0].text).toContain(
      "https://butaca.lat/confirm?token=tok",
    );
  });

  it.each([
    "https://evil.test/confirm",
    "//evil.test/confirm",
    "https://butaca.lat@evil.test/confirm",
    "https://butaca.lat/other",
    "javascript:alert(1)",
  ])("never sends the reset token to %s", async (callback) => {
    const { auth, send } = build();
    const url = `https://butaca.lat/api/auth/reset-password/tok?callbackURL=${encodeURIComponent(callback)}`;

    await auth.options.emailAndPassword?.sendResetPassword?.({
      user,
      url,
      token: "tok",
    });

    const text = send.mock.calls[0]![0].text as string;

    expect(text).toContain("https://butaca.lat/reset-password?token=tok");
    expect(text).not.toContain("evil.test");
  });

  it("emails the product verification link, not the provider endpoint", async () => {
    const { auth, send } = build();

    await auth.options.emailVerification?.sendVerificationEmail?.({
      user,
      url: "https://butaca.lat/api/auth/verify-email?token=tok",
      token: "tok",
    });

    expect(send.mock.calls[0]![0].text).toContain(
      "https://butaca.lat/verify-email?token=tok",
    );
  });

  it("reports a failed verification email and flags it without breaking the caller", async () => {
    const onMailError = vi.fn();
    const { auth } = build(
      { send: vi.fn().mockRejectedValue(new Error("down")) },
      onMailError,
    );
    const send = () =>
      auth.options.emailVerification!.sendVerificationEmail!({
        user,
        url: "https://x",
        token: "t",
      });

    const lenient = await trackMailDelivery({ strict: false }, send);
    expect(lenient.failed).toBe(true);
    expect(onMailError).toHaveBeenCalledTimes(1);

    // Outside any tracked call the failure is still reported, not hidden.
    await expect(send()).resolves.toBeUndefined();
    expect(onMailError).toHaveBeenCalledTimes(2);
  });

  it("rethrows a failed verification email only for strict callers", async () => {
    const { auth } = build({
      send: vi.fn().mockRejectedValue(new Error("down")),
    });

    await expect(
      trackMailDelivery({ strict: true }, () =>
        auth.options.emailVerification!.sendVerificationEmail!({
          user,
          url: "https://x",
          token: "t",
        }),
      ),
    ).rejects.toThrow("down");
  });

  it("reports a delivered verification email as not failed", async () => {
    const { auth } = build();

    const outcome = await trackMailDelivery({ strict: false }, () =>
      auth.options.emailVerification!.sendVerificationEmail!({
        user,
        url: "https://x",
        token: "t",
      }),
    );

    expect(outcome.failed).toBe(false);
  });

  it("does not make a failed reset email fail the request", async () => {
    const onMailError = vi.fn();
    const { auth } = build(
      { send: vi.fn().mockRejectedValue(new Error("down")) },
      onMailError,
    );

    await expect(
      auth.options.emailAndPassword?.sendResetPassword?.({
        user,
        url: "https://butaca.lat/x",
        token: "t",
      }),
    ).resolves.toBeUndefined();
    await vi.waitFor(() => expect(onMailError).toHaveBeenCalledOnce());
  });
});
