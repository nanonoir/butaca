import { describe, expect, it } from "vitest";

import {
  getAuthErrorMapping,
  getAuthFallbackMessage,
} from "./auth-error-messages";
import {
  AUTH_SERVICE_OPERATION,
  AuthServiceError,
} from "./auth-service";

describe("auth error messages", () => {
  it("keeps Spanish operation-specific copy and field mappings typed", () => {
    expect(
      getAuthErrorMapping(
        new AuthServiceError({ code: "INVALID_CREDENTIALS" }),
        AUTH_SERVICE_OPERATION.LOGIN,
      ),
    ).toEqual({ message: "Correo o contraseña incorrectos." });

    expect(
      getAuthErrorMapping(
        new AuthServiceError({ code: "AUTH_UNAVAILABLE" }),
        AUTH_SERVICE_OPERATION.REGISTER,
      ),
    ).toEqual({
      message:
        "La creación de cuentas no está disponible temporalmente. Intenta de nuevo más tarde.",
    });

    expect(
      getAuthErrorMapping(
        new AuthServiceError({ code: "VALIDATION_ERROR", field: "email" }),
        AUTH_SERVICE_OPERATION.FORGOT_PASSWORD,
      ),
    ).toEqual({
      field: "email",
      message: "Revisa esta dirección de correo e intenta de nuevo.",
    });
  });

  it("preserves generic privacy-safe copy for unknown caller errors", () => {
    expect(
      getAuthErrorMapping(
        new Error("provider email=user@example.com password=SecretPass1"),
        AUTH_SERVICE_OPERATION.RESET_PASSWORD,
      ),
    ).toEqual({ message: getAuthFallbackMessage(AUTH_SERVICE_OPERATION.RESET_PASSWORD) });
  });

  it("does not leak another operation's code copy", () => {
    expect(
      getAuthErrorMapping(
        new AuthServiceError({ code: "INVALID_RESET_LINK" }),
        AUTH_SERVICE_OPERATION.REGISTER,
      ),
    ).toEqual({ message: getAuthFallbackMessage(AUTH_SERVICE_OPERATION.REGISTER) });
  });

  it("ignores service fields that do not belong to the active operation", () => {
    expect(
      getAuthErrorMapping(
        new AuthServiceError({ code: "VALIDATION_ERROR", field: "password" }),
        AUTH_SERVICE_OPERATION.FORGOT_PASSWORD,
      ),
    ).toEqual({
      message:
        "No pudimos iniciar la recuperación de contraseña. Intenta de nuevo.",
    });
  });
});
