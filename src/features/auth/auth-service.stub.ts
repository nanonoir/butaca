import {
  AuthEmailSchema,
  AuthUserSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  type AuthUser,
} from "@/contracts";

import {
  AUTH_SERVICE_OPERATION,
  AuthServiceError,
  type AuthService,
  type AuthServiceErrorDetails,
  type AuthServiceOperation,
} from "./auth-service";

export interface AuthServiceStubOptions {
  delayMs?: number;
  errors?: Partial<Record<AuthServiceOperation, AuthServiceErrorDetails>>;
}

const DEFAULT_DELAY_MS = 150;
const STUB_USER_ID = "00000000-0000-4000-8000-000000000001";
const STUB_USERNAME = "movie_fan";

export class AuthServiceStub implements AuthService {
  private readonly delayMs: number;
  private readonly errors: Partial<
    Record<AuthServiceOperation, AuthServiceErrorDetails>
  >;

  constructor(options: AuthServiceStubOptions = {}) {
    this.delayMs = Math.max(0, options.delayMs ?? DEFAULT_DELAY_MS);
    this.errors = options.errors ?? {};
  }

  async register(
    input: Parameters<AuthService["register"]>[0],
  ): Promise<AuthUser> {
    await this.simulateDelay();
    this.throwConfiguredError(AUTH_SERVICE_OPERATION.REGISTER);

    const result = RegisterRequestSchema.safeParse(input);
    if (!result.success) {
      throw new AuthServiceError({
        code: this.getValidationErrorCode(result.error.issues),
      });
    }

    return this.createUser(result.data.username, result.data.email);
  }

  async login(input: Parameters<AuthService["login"]>[0]): Promise<AuthUser> {
    await this.simulateDelay();
    this.throwConfiguredError(AUTH_SERVICE_OPERATION.LOGIN);

    const result = LoginRequestSchema.safeParse(input);
    if (!result.success) {
      throw new AuthServiceError({ code: "VALIDATION_ERROR" });
    }

    return this.createUser(STUB_USERNAME, result.data.email);
  }

  async forgotPassword(
    input: Parameters<AuthService["forgotPassword"]>[0],
  ): Promise<void> {
    await this.simulateDelay();
    this.throwConfiguredError(AUTH_SERVICE_OPERATION.FORGOT_PASSWORD);

    if (!ForgotPasswordRequestSchema.safeParse(input).success) {
      throw new AuthServiceError({ code: "VALIDATION_ERROR" });
    }
  }

  async resetPassword(
    input: Parameters<AuthService["resetPassword"]>[0],
  ): Promise<void> {
    await this.simulateDelay();
    this.throwConfiguredError(AUTH_SERVICE_OPERATION.RESET_PASSWORD);

    const result = ResetPasswordRequestSchema.safeParse(input);
    if (!result.success) {
      throw new AuthServiceError({
        code: this.getValidationErrorCode(result.error.issues),
      });
    }
  }

  private async simulateDelay(): Promise<void> {
    if (this.delayMs === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.delayMs);
    });
  }

  private throwConfiguredError(operation: AuthServiceOperation): void {
    const error = this.errors[operation];

    if (error) {
      throw new AuthServiceError(error);
    }
  }

  private getValidationErrorCode(
    issues: readonly { path: PropertyKey[] }[],
  ): "VALIDATION_ERROR" | "WEAK_PASSWORD" | "PASSWORDS_DO_NOT_MATCH" {
    if (issues.some((issue) => issue.path[0] === "confirmPassword")) {
      return "PASSWORDS_DO_NOT_MATCH";
    }

    if (issues.some((issue) => issue.path[0] === "password")) {
      return "WEAK_PASSWORD";
    }

    return "VALIDATION_ERROR";
  }

  private createUser(username: string, email: string): AuthUser {
    const result = AuthUserSchema.safeParse({
      id: STUB_USER_ID,
      username,
      email: AuthEmailSchema.parse(email),
    });

    if (!result.success) {
      throw new AuthServiceError({ code: "UNKNOWN_ERROR" });
    }

    return result.data;
  }
}

export function createAuthServiceStub(
  options: AuthServiceStubOptions = {},
): AuthServiceStub {
  return new AuthServiceStub(options);
}

export const authServiceStub: AuthService = new AuthServiceStub();
