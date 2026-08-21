import type { AuthErrorCode } from "@/contracts";

import {
  AUTH_SERVICE_OPERATION,
  isAuthServiceError,
  type AuthServiceErrorField,
  type AuthServiceOperation,
} from "./auth-service";

export const AUTH_LINK_STATUS = {
  INVALID: "invalid",
  EXPIRED: "expired",
} as const;

export type AuthLinkStatus =
  (typeof AUTH_LINK_STATUS)[keyof typeof AUTH_LINK_STATUS];

export interface AuthErrorMapping {
  message: string;
  field?: AuthServiceErrorField;
  linkStatus?: AuthLinkStatus;
}

interface AuthOperationMessages {
  fallback: string;
  validationField: string;
  overrides: Partial<Record<AuthErrorCode, string>>;
}

export const AUTH_ERROR_MESSAGES = {
  VALIDATION_ERROR: "Revisa los campos marcados e intenta de nuevo.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  USERNAME_TAKEN: "Este nombre de usuario ya está en uso.",
  EMAIL_ALREADY_REGISTERED: "Ya existe una cuenta con este correo.",
  WEAK_PASSWORD: "Elige una contraseña que cumpla con todos los requisitos.",
  PASSWORDS_DO_NOT_MATCH: "Las contraseñas no coinciden.",
  INVALID_RESET_LINK: "Este enlace de recuperación ya no es válido.",
  RESET_LINK_EXPIRED: "Este enlace de recuperación ha expirado.",
  RATE_LIMITED: "Demasiados intentos. Espera un momento e intenta de nuevo.",
  AUTH_UNAVAILABLE:
    "La autenticación no está disponible temporalmente. Intenta de nuevo más tarde.",
  UNKNOWN_ERROR: "No pudimos completar la operación. Intenta de nuevo.",
} satisfies Record<AuthErrorCode, string>;

const AUTH_OPERATION_MESSAGES: Record<
  AuthServiceOperation,
  AuthOperationMessages
> = {
  [AUTH_SERVICE_OPERATION.LOGIN]: {
    fallback: "No pudimos iniciar sesión. Intenta de nuevo.",
    validationField: "No pudimos iniciar sesión. Intenta de nuevo.",
    overrides: {
      INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
      AUTH_UNAVAILABLE:
        "El inicio de sesión no está disponible temporalmente. Intenta de nuevo más tarde.",
      VALIDATION_ERROR: "No pudimos iniciar sesión. Intenta de nuevo.",
      UNKNOWN_ERROR: "No pudimos iniciar sesión. Intenta de nuevo.",
    },
  },
  [AUTH_SERVICE_OPERATION.REGISTER]: {
    fallback: "No pudimos crear tu cuenta. Intenta de nuevo.",
    validationField: "Revisa este campo e intenta de nuevo.",
    overrides: {
      AUTH_UNAVAILABLE:
        "La creación de cuentas no está disponible temporalmente. Intenta de nuevo más tarde.",
      UNKNOWN_ERROR: "No pudimos crear tu cuenta. Intenta de nuevo.",
    },
  },
  [AUTH_SERVICE_OPERATION.FORGOT_PASSWORD]: {
    fallback:
      "No pudimos iniciar la recuperación de contraseña. Intenta de nuevo.",
    validationField: "Revisa esta dirección de correo e intenta de nuevo.",
    overrides: {
      RATE_LIMITED:
        "Demasiados intentos. Espera un momento e intenta de nuevo.",
      AUTH_UNAVAILABLE:
        "La recuperación de contraseña no está disponible temporalmente. Intenta de nuevo más tarde.",
      VALIDATION_ERROR:
        "No pudimos iniciar la recuperación de contraseña. Intenta de nuevo.",
      UNKNOWN_ERROR:
        "No pudimos iniciar la recuperación de contraseña. Intenta de nuevo.",
    },
  },
  [AUTH_SERVICE_OPERATION.RESET_PASSWORD]: {
    fallback: "No pudimos actualizar tu contraseña. Intenta de nuevo.",
    validationField: "Revisa este campo e intenta de nuevo.",
    overrides: {
      AUTH_UNAVAILABLE:
        "El restablecimiento de contraseña no está disponible temporalmente. Intenta de nuevo más tarde.",
      VALIDATION_ERROR: "Revisa los campos marcados e intenta de nuevo.",
      UNKNOWN_ERROR: "No pudimos actualizar tu contraseña. Intenta de nuevo.",
    },
  },
};

const FIXED_FIELD_MAPPINGS: Partial<
  Record<AuthErrorCode, { field: AuthServiceErrorField }>
> = {
  USERNAME_TAKEN: { field: "username" },
  EMAIL_ALREADY_REGISTERED: { field: "email" },
  WEAK_PASSWORD: { field: "password" },
  PASSWORDS_DO_NOT_MATCH: { field: "confirmPassword" },
};

const LINK_STATUS_BY_CODE: Partial<Record<AuthErrorCode, AuthLinkStatus>> = {
  INVALID_RESET_LINK: AUTH_LINK_STATUS.INVALID,
  RESET_LINK_EXPIRED: AUTH_LINK_STATUS.EXPIRED,
};

const AUTH_OPERATION_HANDLED_CODES: Record<
  AuthServiceOperation,
  readonly AuthErrorCode[]
> = {
  [AUTH_SERVICE_OPERATION.LOGIN]: [
    "INVALID_CREDENTIALS",
    "RATE_LIMITED",
    "AUTH_UNAVAILABLE",
    "VALIDATION_ERROR",
    "UNKNOWN_ERROR",
  ],
  [AUTH_SERVICE_OPERATION.REGISTER]: [
    "USERNAME_TAKEN",
    "EMAIL_ALREADY_REGISTERED",
    "WEAK_PASSWORD",
    "PASSWORDS_DO_NOT_MATCH",
    "VALIDATION_ERROR",
    "RATE_LIMITED",
    "AUTH_UNAVAILABLE",
    "UNKNOWN_ERROR",
  ],
  [AUTH_SERVICE_OPERATION.FORGOT_PASSWORD]: [
    "RATE_LIMITED",
    "AUTH_UNAVAILABLE",
    "VALIDATION_ERROR",
    "UNKNOWN_ERROR",
  ],
  [AUTH_SERVICE_OPERATION.RESET_PASSWORD]: [
    "INVALID_RESET_LINK",
    "RESET_LINK_EXPIRED",
    "WEAK_PASSWORD",
    "PASSWORDS_DO_NOT_MATCH",
    "VALIDATION_ERROR",
    "AUTH_UNAVAILABLE",
    "UNKNOWN_ERROR",
  ],
};

const AUTH_OPERATION_FIELDS: Record<
  AuthServiceOperation,
  readonly AuthServiceErrorField[]
> = {
  [AUTH_SERVICE_OPERATION.LOGIN]: ["email", "password"],
  [AUTH_SERVICE_OPERATION.REGISTER]: [
    "username",
    "email",
    "password",
    "confirmPassword",
  ],
  [AUTH_SERVICE_OPERATION.FORGOT_PASSWORD]: ["email"],
  [AUTH_SERVICE_OPERATION.RESET_PASSWORD]: [
    "newPassword",
    "confirmPassword",
  ],
};

export function getAuthFallbackMessage(
  operation: AuthServiceOperation,
): string {
  return AUTH_OPERATION_MESSAGES[operation].fallback;
}

export function getAuthErrorMapping(
  error: unknown,
  operation: AuthServiceOperation,
): AuthErrorMapping {
  const operationMessages = AUTH_OPERATION_MESSAGES[operation];

  if (!isAuthServiceError(error)) {
    return { message: operationMessages.fallback };
  }

  if (!AUTH_OPERATION_HANDLED_CODES[operation].includes(error.code)) {
    return { message: operationMessages.fallback };
  }

  const message =
    operationMessages.overrides[error.code] ?? AUTH_ERROR_MESSAGES[error.code];
  const linkStatus = LINK_STATUS_BY_CODE[error.code];
  const operationFields = AUTH_OPERATION_FIELDS[operation];

  if (linkStatus) {
    return { message, linkStatus };
  }

  if (
    error.code === "VALIDATION_ERROR" &&
    error.field &&
    operationFields.includes(error.field)
  ) {
    return { field: error.field, message: operationMessages.validationField };
  }

  if (error.field && operationFields.includes(error.field)) {
    return { field: error.field, message };
  }

  const fixedField = FIXED_FIELD_MAPPINGS[error.code];

  if (fixedField && operationFields.includes(fixedField.field)) {
    return { field: fixedField.field, message };
  }

  return { message };
}

export function getAuthErrorMessage(
  error: unknown,
  operation: AuthServiceOperation,
): string {
  return getAuthErrorMapping(error, operation).message;
}
