import type {
  AuthErrorCode,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from "@/contracts";

export const AUTH_SERVICE_OPERATION = {
  REGISTER: "register",
  LOGIN: "login",
  FORGOT_PASSWORD: "forgotPassword",
  RESET_PASSWORD: "resetPassword",
} as const;

export type AuthServiceOperation =
  (typeof AUTH_SERVICE_OPERATION)[keyof typeof AUTH_SERVICE_OPERATION];

export const AUTH_SERVICE_ERROR_FIELD = {
  USERNAME: "username",
  EMAIL: "email",
  PASSWORD: "password",
  CONFIRM_PASSWORD: "confirmPassword",
  NEW_PASSWORD: "newPassword",
} as const;

export type AuthServiceErrorField =
  (typeof AUTH_SERVICE_ERROR_FIELD)[keyof typeof AUTH_SERVICE_ERROR_FIELD];

export interface AuthServiceErrorDetails {
  code: AuthErrorCode;
  field?: AuthServiceErrorField;
}

export class AuthServiceError extends Error {
  readonly code: AuthErrorCode;
  readonly field?: AuthServiceErrorField;

  constructor({ code, field }: AuthServiceErrorDetails) {
    super(code);
    this.name = "AuthServiceError";
    this.code = code;
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Auth requests fail closed after 15 seconds. AbortSignal support and
 * useActionState/server actions remain deferred at the AuthService boundary.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

export function withAuthTimeout<T>(
  request: Promise<T>,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      settled = true;
      reject(new AuthServiceError({ code: "AUTH_UNAVAILABLE" }));
    }, timeoutMs);

    request.then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function isAuthServiceError(error: unknown): error is AuthServiceError {
  return error instanceof AuthServiceError;
}

export interface AuthService {
  register(input: RegisterRequest): Promise<AuthUser>;
  login(input: LoginRequest): Promise<AuthUser>;
  forgotPassword(input: ForgotPasswordRequest): Promise<void>;
  resetPassword(input: ResetPasswordRequest): Promise<void>;
}
