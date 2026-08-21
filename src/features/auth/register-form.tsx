"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  RegisterRequestSchema,
  type AuthUser,
  type RegisterRequest,
} from "@/contracts";
import { AuthFooter } from "@/components/shared/auth-footer";
import { AuthTextLink } from "@/components/shared/auth-text-link";
import { FormAlert } from "@/components/shared/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

import { PasswordRequirements } from "./password-requirements";
import { getAuthFallbackMessage } from "./auth-error-messages";
import {
  focusFieldById,
  focusFirstInvalidField,
  getZodFieldMessage,
  getZodFieldMessages,
  isNextRedirectError,
} from "./auth-form.helpers";
import {
  AUTH_SERVICE_OPERATION,
  withAuthTimeout,
  type AuthService,
} from "./auth-service";
import { authServiceStub } from "./auth-service.stub";
import {
  isUnexpectedAuthError,
  reportUnexpectedAuthError,
} from "./auth-error-reporting";
import {
  getRegisterError,
  INITIAL_REGISTER_VALUES,
  REGISTER_FIELDS,
  REGISTER_FIELD_IDS,
  type RegisterField,
  type RegisterFieldErrors,
} from "./register-form.helpers";

export interface RegisterFormProps {
  service?: AuthService;
  onSuccess?: (user: AuthUser) => void | Promise<void>;
  className?: string;
}

export function RegisterForm({
  service = authServiceStub,
  onSuccess,
  className,
}: RegisterFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<RegisterRequest>(
    INITIAL_REGISTER_VALUES,
  );
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [touched, setTouched] = useState<Record<RegisterField, boolean>>({
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleFieldChange(field: RegisterField, value: string): void {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setFormError(null);

    if (touched[field] || hasSubmitted) {
      const result = RegisterRequestSchema.safeParse(nextValues);
      const message = result.success
        ? undefined
        : getZodFieldMessage(result.error.issues, field);
      setFieldErrors((previous) => ({ ...previous, [field]: message }));
    } else {
      setFieldErrors((previous) => {
        if (!previous[field]) {
          return previous;
        }

        const nextErrors = { ...previous };
        delete nextErrors[field];
        return nextErrors;
      });
    }
  }

  function handleFieldBlur(field: RegisterField): void {
    setTouched((previous) => ({ ...previous, [field]: true }));
    const result = RegisterRequestSchema.safeParse(values);
    setFieldErrors((previous) => ({
      ...previous,
      [field]: result.success
        ? undefined
        : getZodFieldMessage(result.error.issues, field),
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setHasSubmitted(true);
    const result = RegisterRequestSchema.safeParse(values);

    if (!result.success) {
      const errors = getZodFieldMessages(result.error.issues, REGISTER_FIELDS);
      setFieldErrors(errors);
      setTouched({
        username: true,
        email: true,
        password: true,
        confirmPassword: true,
      });
      setFormError("Corrige los campos marcados antes de continuar.");
      focusFirstInvalidField(errors, REGISTER_FIELDS, REGISTER_FIELD_IDS);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    let keepSubmitting = false;

    try {
      let user: AuthUser;

      try {
        user = await withAuthTimeout(service.register(result.data));
      } catch (error) {
        if (!isMounted.current) {
          return;
        }

        if (isUnexpectedAuthError(error)) {
          reportUnexpectedAuthError(AUTH_SERVICE_OPERATION.REGISTER, error);
        }

        const mappedError = getRegisterError(error);

        if (mappedError.field) {
          const field = mappedError.field;
          setFieldErrors({ [field]: mappedError.message });
          setTouched((previous) => ({ ...previous, [field]: true }));
          focusFieldById(REGISTER_FIELD_IDS[field], { defer: true });
        } else {
          setFormError(mappedError.message);
        }

        return;
      }

      if (!isMounted.current) {
        return;
      }

      if (onSuccess) {
        keepSubmitting = true;

        try {
          await onSuccess(user);
          keepSubmitting = false;
        } catch (error) {
          if (isNextRedirectError(error)) {
            throw error;
          }

          keepSubmitting = false;

          if (!isMounted.current) {
            return;
          }

          reportUnexpectedAuthError(AUTH_SERVICE_OPERATION.REGISTER, error);
          setFormError(
            getAuthFallbackMessage(AUTH_SERVICE_OPERATION.REGISTER),
          );
        }
      } else {
        router.push("/onboarding");
        keepSubmitting = true;
      }
    } finally {
      if (isMounted.current && !keepSubmitting) {
        setIsSubmitting(false);
      }
    }
  }

  const classes = cn("flex flex-col gap-5", className);

  return (
    <>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <form
        className={classes}
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <Input
          id={REGISTER_FIELD_IDS.username}
          name="username"
          type="text"
          label="Nombre de usuario"
          autoComplete="username"
          value={values.username}
          onChange={(event) =>
            handleFieldChange("username", event.target.value)
          }
          onBlur={() => handleFieldBlur("username")}
          invalid={Boolean(fieldErrors.username)}
          error={fieldErrors.username}
          aria-describedby="register-username-help"
          disabled={isSubmitting}
        />
        <p
          id="register-username-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          De 3 a 30 caracteres usando letras, números y guiones bajos.
        </p>

        <Input
          id={REGISTER_FIELD_IDS.email}
          name="email"
          type="email"
          label="Correo electrónico"
          autoComplete="email"
          value={values.email}
          onChange={(event) => handleFieldChange("email", event.target.value)}
          onBlur={() => handleFieldBlur("email")}
          invalid={Boolean(fieldErrors.email)}
          error={fieldErrors.email}
          aria-describedby="register-email-help"
          disabled={isSubmitting}
        />
        <p
          id="register-email-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          Usa una dirección de correo a la que tengas acceso para recuperarla.
        </p>

        <PasswordInput
          id={REGISTER_FIELD_IDS.password}
          name="password"
          label="Contraseña"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) =>
            handleFieldChange("password", event.target.value)
          }
          onBlur={() => handleFieldBlur("password")}
          invalid={Boolean(fieldErrors.password)}
          error={fieldErrors.password}
          aria-describedby="register-password-requirements"
          disabled={isSubmitting}
        />
        <PasswordRequirements
          id="register-password-requirements"
          password={values.password}
          className="-mt-3"
        />

        <PasswordInput
          id={REGISTER_FIELD_IDS.confirmPassword}
          name="confirmPassword"
          label="Confirmar contraseña"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) =>
            handleFieldChange("confirmPassword", event.target.value)
          }
          onBlur={() => handleFieldBlur("confirmPassword")}
          invalid={Boolean(fieldErrors.confirmPassword)}
          error={fieldErrors.confirmPassword}
          aria-describedby="register-confirm-password-help"
          disabled={isSubmitting}
        />
        <p
          id="register-confirm-password-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          Ingresa la misma contraseña de nuevo.
        </p>

        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
        {isSubmitting ? (
          <p className="sr-only" role="status" aria-live="polite">
            Creando cuenta…
          </p>
        ) : null}
      </form>
      <AuthFooter>
        <span>¿Ya tienes una cuenta?</span>
        <AuthTextLink href="/login">Iniciar sesión</AuthTextLink>
      </AuthFooter>
    </>
  );
}
