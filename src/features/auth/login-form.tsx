"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  LoginRequestSchema,
  type AuthUser,
  type LoginRequest,
} from "@/contracts";
import { AuthFooter } from "@/components/shared/auth-footer";
import { AuthTextLink } from "@/components/shared/auth-text-link";
import { FormAlert, FORM_ALERT_VARIANT } from "@/components/shared/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

import {
  getAuthErrorMapping,
  getAuthFallbackMessage,
} from "./auth-error-messages";
import {
  focusFieldById,
  focusFirstInvalidField,
  getZodFieldMessage,
  getZodFieldMessages,
  isNextRedirectError,
  type AuthFieldErrors,
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

const LOGIN_FIELDS = ["email", "password"] as const;
type LoginField = (typeof LOGIN_FIELDS)[number];
type LoginFieldErrors = AuthFieldErrors<LoginField>;

const LOGIN_FIELD_IDS: Record<LoginField, string> = {
  email: "login-email",
  password: "login-password",
};

const INITIAL_VALUES: LoginRequest = {
  email: "",
  password: "",
};

export interface LoginFormProps {
  service?: AuthService;
  onSuccess?: (user: AuthUser) => void | Promise<void>;
  resetSuccess?: boolean;
  className?: string;
}

export function LoginForm({
  service = authServiceStub,
  onSuccess,
  resetSuccess = false,
  className,
}: LoginFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<LoginRequest>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [touched, setTouched] = useState<Record<LoginField, boolean>>({
    email: false,
    password: false,
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

  function handleFieldChange(field: LoginField, value: string): void {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setFormError(null);

    if (touched[field] || hasSubmitted) {
      const result = LoginRequestSchema.safeParse(nextValues);
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

  function handleFieldBlur(field: LoginField): void {
    setTouched((previous) => ({ ...previous, [field]: true }));
    const result = LoginRequestSchema.safeParse(values);
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
    const result = LoginRequestSchema.safeParse(values);

    if (!result.success) {
      const errors = getZodFieldMessages(result.error.issues, LOGIN_FIELDS);
      setFieldErrors(errors);
      setTouched({ email: true, password: true });
      setFormError("Corrige los campos marcados antes de continuar.");
      focusFirstInvalidField(errors, LOGIN_FIELDS, LOGIN_FIELD_IDS);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    let keepSubmitting = false;

    try {
      let user: AuthUser;

      try {
        user = await withAuthTimeout(service.login(result.data));
      } catch (error) {
        if (!isMounted.current) {
          return;
        }

        if (isUnexpectedAuthError(error)) {
          reportUnexpectedAuthError(AUTH_SERVICE_OPERATION.LOGIN, error);
        }

        const mappedError = getAuthErrorMapping(
          error,
          AUTH_SERVICE_OPERATION.LOGIN,
        );

        if (
          mappedError.field === "email" ||
          mappedError.field === "password"
        ) {
          const field = mappedError.field;
          setFieldErrors({ [field]: mappedError.message });
          setTouched((previous) => ({ ...previous, [field]: true }));
          focusFieldById(LOGIN_FIELD_IDS[field], { defer: true });
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

          reportUnexpectedAuthError(AUTH_SERVICE_OPERATION.LOGIN, error);
          setFormError(getAuthFallbackMessage(AUTH_SERVICE_OPERATION.LOGIN));
        }
      } else {
        router.push("/discover");
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
      {resetSuccess ? (
        <FormAlert variant={FORM_ALERT_VARIANT.SUCCESS}>
          Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.
        </FormAlert>
      ) : null}
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <form
        className={classes}
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <Input
          id={LOGIN_FIELD_IDS.email}
          name="email"
          type="email"
          label="Correo electrónico"
          autoComplete="email"
          value={values.email}
          onChange={(event) => handleFieldChange("email", event.target.value)}
          onBlur={() => handleFieldBlur("email")}
          invalid={Boolean(fieldErrors.email)}
          error={fieldErrors.email}
          aria-describedby="login-email-help"
          disabled={isSubmitting}
        />
        <p
          id="login-email-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          Usa el correo asociado a tu cuenta.
        </p>

        <PasswordInput
          id={LOGIN_FIELD_IDS.password}
          name="password"
          label="Contraseña"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) =>
            handleFieldChange("password", event.target.value)
          }
          onBlur={() => handleFieldBlur("password")}
          invalid={Boolean(fieldErrors.password)}
          error={fieldErrors.password}
          aria-describedby="login-password-help"
          disabled={isSubmitting}
        />
        <p
          id="login-password-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          Ingresa la contraseña de tu cuenta.
        </p>

        <div className="-mt-2 text-right text-sm">
          <AuthTextLink href="/forgot-password">
            ¿Olvidaste tu contraseña?
          </AuthTextLink>
        </div>

        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}
        </Button>
        {isSubmitting ? (
          <p className="sr-only" role="status" aria-live="polite">
            Iniciando sesión…
          </p>
        ) : null}
      </form>
      <AuthFooter>
        <span>¿No tienes una cuenta?</span>
        <AuthTextLink href="/register">Crear una</AuthTextLink>
      </AuthFooter>
    </>
  );
}
