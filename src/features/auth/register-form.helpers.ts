import type { RegisterRequest } from "@/contracts";

import type { AuthFieldErrors } from "./auth-form.helpers";
import { getAuthErrorMapping } from "./auth-error-messages";
import { AUTH_SERVICE_OPERATION } from "./auth-service";

export const REGISTER_FIELDS = [
  "username",
  "email",
  "password",
  "confirmPassword",
] as const;

export type RegisterField = (typeof REGISTER_FIELDS)[number];
export type RegisterFieldErrors = AuthFieldErrors<RegisterField>;

export const REGISTER_FIELD_IDS: Record<RegisterField, string> = {
  username: "register-username",
  email: "register-email",
  password: "register-password",
  confirmPassword: "register-confirm-password",
};

export const INITIAL_REGISTER_VALUES: RegisterRequest = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function isRegisterField(field: string): field is RegisterField {
  return REGISTER_FIELDS.includes(field as RegisterField);
}

export interface RegisterErrorMapping {
  field?: RegisterField;
  message: string;
}

export function getRegisterError(error: unknown): RegisterErrorMapping {
  const mapping = getAuthErrorMapping(error, AUTH_SERVICE_OPERATION.REGISTER);

  if (mapping.field && isRegisterField(mapping.field)) {
    return { field: mapping.field, message: mapping.message };
  }

  return { message: mapping.message };
}
