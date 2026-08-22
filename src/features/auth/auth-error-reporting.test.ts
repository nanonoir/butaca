import { describe, expect, it, vi } from "vitest";

import {
  isUnexpectedAuthError,
  reportUnexpectedAuthError,
  setAuthErrorReporter,
  type AuthErrorReporter,
} from "./auth-error-reporting";
import { AuthServiceError } from "./auth-service";

describe("auth error reporting", () => {
  it("reports sanitized metadata instead of raw error details", () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);

    try {
      reportUnexpectedAuthError(
        "login",
        new Error("email=user@example.com password=SecretPass1"),
      );

      expect(reporter).toHaveBeenCalledWith({
        operation: "login",
        metadata: { kind: "error", name: "Error" },
      });
      expect(JSON.stringify(reporter.mock.calls[0]?.[0])).not.toContain(
        "user@example.com",
      );
      expect(JSON.stringify(reporter.mock.calls[0]?.[0])).not.toContain(
        "SecretPass1",
      );
    } finally {
      restoreReporter();
    }
  });

  it("distinguishes normalized unknown errors from expected service errors", () => {
    expect(isUnexpectedAuthError(new Error("provider failure"))).toBe(true);
    expect(
      isUnexpectedAuthError(
        new AuthServiceError({ code: "INVALID_CREDENTIALS" }),
      ),
    ).toBe(false);
    expect(
      isUnexpectedAuthError(new AuthServiceError({ code: "UNKNOWN_ERROR" })),
    ).toBe(true);
  });
});
