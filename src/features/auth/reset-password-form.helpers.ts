import {
  type ResetPasswordRequest,
} from "@/contracts";

import type { AuthFieldErrors } from "./auth-form.helpers";
import { getAuthErrorMapping } from "./auth-error-messages";
import { AUTH_SERVICE_OPERATION } from "./auth-service";

export const RESET_LINK_STATUS = {
  VALID: "valid",
  INVALID: "invalid",
  EXPIRED: "expired",
} as const;

export type ResetLinkStatus =
  (typeof RESET_LINK_STATUS)[keyof typeof RESET_LINK_STATUS];

export const RESET_FIELDS = ["newPassword", "confirmPassword"] as const;
export type ResetField = (typeof RESET_FIELDS)[number];
export type ResetFieldErrors = AuthFieldErrors<ResetField>;

export const RESET_FIELD_IDS: Record<ResetField, string> = {
  newPassword: "reset-new-password",
  confirmPassword: "reset-confirm-password",
};

export const INITIAL_RESET_VALUES: ResetPasswordRequest = {
  newPassword: "",
  confirmPassword: "",
};

export interface ResetErrorMapping {
  field?: ResetField;
  message?: string;
  linkStatus?: Exclude<ResetLinkStatus, "valid">;
}

export function isResetField(field: string): field is ResetField {
  return RESET_FIELDS.includes(field as ResetField);
}

export function getResetError(error: unknown): ResetErrorMapping {
  const mapping = getAuthErrorMapping(error, AUTH_SERVICE_OPERATION.RESET_PASSWORD);

  if (mapping.linkStatus) {
    return { linkStatus: mapping.linkStatus, message: mapping.message };
  }

  if (mapping.field && isResetField(mapping.field)) {
    return { field: mapping.field, message: mapping.message };
  }

  return { message: mapping.message };
}

export function getInvalidLinkMessage(
  status: Exclude<ResetLinkStatus, "valid">,
): string {
  return status === RESET_LINK_STATUS.EXPIRED
    ? "Este enlace de recuperación ha expirado. Solicita un nuevo enlace para continuar."
    : "Este enlace de recuperación ya no es válido. Solicita un nuevo enlace para continuar.";
}
