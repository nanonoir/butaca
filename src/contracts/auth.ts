import { z } from "zod";

import { apiDataResponseSchema } from "./common";
import { PASSWORD_POLICY } from "./password-policy";

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, { error: "El nombre de usuario debe tener al menos 3 caracteres" })
  .max(30, {
    error: "El nombre de usuario debe tener como máximo 30 caracteres",
  })
  .regex(/^[A-Za-z0-9_]+$/, {
    error:
      "El nombre de usuario solo puede contener letras, números y guiones bajos",
  });

export const AuthEmailSchema = z
  // Keep trim -> validate -> lowercase explicit; the order is part of the
  // public auth contract and is intentionally not simplified in this pass.
  .string()
  .trim()
  .pipe(z.email({ error: "Ingresa una dirección de correo válida" }))
  .transform((value) => value.toLowerCase());

export const PasswordSchema = z
  .string()
  .min(PASSWORD_POLICY.MIN_LENGTH, {
    error: "La contraseña debe tener al menos 8 caracteres",
  })
  .regex(PASSWORD_POLICY.UPPERCASE, {
    error: "La contraseña debe contener una letra mayúscula",
  })
  .regex(PASSWORD_POLICY.LOWERCASE, {
    error: "La contraseña debe contener una letra minúscula",
  })
  .regex(PASSWORD_POLICY.NUMBER, {
    error: "La contraseña debe contener un número",
  });

export const RegisterRequestSchema = z
  .object({
    username: UsernameSchema,
    email: AuthEmailSchema,
    password: PasswordSchema,
    confirmPassword: z
      .string()
      .min(1, { error: "La confirmación de contraseña es obligatoria" }),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden",
      });
    }
  });

export const LoginRequestSchema = z.object({
  email: AuthEmailSchema,
  password: z.string().min(1, { error: "La contraseña es obligatoria" }),
});

export const ForgotPasswordRequestSchema = z.object({
  email: AuthEmailSchema,
});

export const ResetPasswordRequestSchema = z
  .object({
    newPassword: PasswordSchema,
    confirmPassword: z
      .string()
      .min(1, { error: "La confirmación de contraseña es obligatoria" }),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden",
      });
    }
  });

export const AuthUserSchema = z.object({
  id: z.uuid(),
  username: UsernameSchema,
  email: AuthEmailSchema,
});

export const AuthErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INVALID_CREDENTIALS",
  "USERNAME_TAKEN",
  "EMAIL_ALREADY_REGISTERED",
  "WEAK_PASSWORD",
  "PASSWORDS_DO_NOT_MATCH",
  "INVALID_RESET_LINK",
  "RESET_LINK_EXPIRED",
  "RATE_LIMITED",
  "AUTH_UNAVAILABLE",
  "UNKNOWN_ERROR",
]);

export const AuthErrorFieldSchema = z.enum([
  "username",
  "email",
  "password",
  "confirmPassword",
  "newPassword",
]);

export const AuthErrorResponseSchema = z.object({
  error: z.object({
    code: AuthErrorCodeSchema,
    field: AuthErrorFieldSchema.optional(),
    message: z.string().min(1),
  }),
});

export const AuthUserResponseSchema = apiDataResponseSchema(AuthUserSchema);

export type Username = z.infer<typeof UsernameSchema>;
export type AuthEmail = z.infer<typeof AuthEmailSchema>;
export type Password = z.infer<typeof PasswordSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;
export type AuthErrorField = z.infer<typeof AuthErrorFieldSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
