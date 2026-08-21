import { isAuthServiceError, type AuthServiceOperation } from "./auth-service";

/**
 * This UI-only MVP intentionally keeps production telemetry as a no-op. A
 * production provider is a follow-up once the service boundary exists.
 * AbortSignal support and React useActionState/server actions are also
 * deferred so this pass does not change the current AuthService stub boundary.
 */
const AUTH_ERROR_KIND = {
  ERROR: "error",
  NON_ERROR: "non-error",
} as const;

type AuthErrorKind = (typeof AUTH_ERROR_KIND)[keyof typeof AUTH_ERROR_KIND];

export interface AuthErrorMetadata {
  kind: AuthErrorKind;
  name?: string;
  code?: "UNKNOWN_ERROR";
}

export interface AuthErrorReport {
  operation: AuthServiceOperation;
  metadata: AuthErrorMetadata;
}

export type AuthErrorReporter = (report: AuthErrorReport) => void;

const defaultAuthErrorReporter: AuthErrorReporter = (report) => {
  if (process.env.NODE_ENV === "development") {
    console.warn("[auth] Unexpected authentication error", report);
  }
};

let authErrorReporter = defaultAuthErrorReporter;

export function setAuthErrorReporter(reporter: AuthErrorReporter): () => void {
  const previousReporter = authErrorReporter;
  authErrorReporter = reporter;

  return () => {
    authErrorReporter = previousReporter;
  };
}

export function isUnexpectedAuthError(error: unknown): boolean {
  return !isAuthServiceError(error) || error.code === "UNKNOWN_ERROR";
}

export function reportUnexpectedAuthError(
  operation: AuthServiceOperation,
  error: unknown,
): void {
  const report: AuthErrorReport = {
    operation,
    metadata: getAuthErrorMetadata(error),
  };

  try {
    authErrorReporter(report);
  } catch {
    // Reporting must never change the form's user-facing error behavior.
  }
}

function getAuthErrorMetadata(error: unknown): AuthErrorMetadata {
  if (isAuthServiceError(error)) {
    return {
      kind: AUTH_ERROR_KIND.ERROR,
      name: "AuthServiceError",
      code: "UNKNOWN_ERROR",
    };
  }

  if (error instanceof Error) {
    return {
      kind: AUTH_ERROR_KIND.ERROR,
      name: sanitizeErrorName(error.name),
    };
  }

  return { kind: AUTH_ERROR_KIND.NON_ERROR };
}

function sanitizeErrorName(name: string): string {
  return /^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(name) ? name : "Error";
}
