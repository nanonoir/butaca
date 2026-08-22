"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  ForgotPasswordRequestSchema,
  type ForgotPasswordRequest,
} from "@/contracts";
import { AuthTextLink } from "@/components/shared/auth-text-link";
import { FormAlert } from "@/components/shared/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { AuthSuccessState } from "./auth-success-state";
import { getAuthErrorMapping } from "./auth-error-messages";
import {
  focusFieldById,
  getZodFieldMessage,
} from "./auth-form.helpers";
import {
  AUTH_SERVICE_OPERATION,
  withAuthTimeout,
  type AuthService,
} from "./auth-service";
import { httpAuthService } from "./http-auth-service";
import {
  isUnexpectedAuthError,
  reportUnexpectedAuthError,
} from "./auth-error-reporting";

const FORGOT_PASSWORD_FIELD_ID = "forgot-password-email";
const INITIAL_VALUES: ForgotPasswordRequest = { email: "" };

export interface ForgotPasswordFormProps {
  service?: AuthService;
  className?: string;
}

export function ForgotPasswordForm({
  service = httpAuthService,
  className,
}: ForgotPasswordFormProps) {
  const [values, setValues] = useState<ForgotPasswordRequest>(INITIAL_VALUES);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isEmailTouched, setIsEmailTouched] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleEmailChange(value: string): void {
    const nextValues = { email: value };
    setValues(nextValues);
    setFormError(null);

    if (isEmailTouched || hasSubmitted) {
      const result = ForgotPasswordRequestSchema.safeParse(nextValues);
      setFieldError(
        result.success
          ? undefined
          : getZodFieldMessage(result.error.issues, "email"),
      );
    } else if (fieldError) {
      setFieldError(undefined);
    }
  }

  function handleEmailBlur(): void {
    setIsEmailTouched(true);
    const result = ForgotPasswordRequestSchema.safeParse(values);
    setFieldError(
      result.success
        ? undefined
        : getZodFieldMessage(result.error.issues, "email"),
    );
  }

  function handleRetry(): void {
    setIsSuccessful(false);
    setFormError(null);
    setFieldError(undefined);
    setHasSubmitted(false);
    setIsEmailTouched(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setHasSubmitted(true);
    const result = ForgotPasswordRequestSchema.safeParse(values);

    if (!result.success) {
      setIsEmailTouched(true);
      setFieldError(getZodFieldMessage(result.error.issues, "email"));
      setFormError(
        "Ingresa una dirección de correo válida antes de continuar.",
      );
      focusFieldById(FORGOT_PASSWORD_FIELD_ID);
      return;
    }

    setValues(result.data);
    setFieldError(undefined);
    setFormError(null);
    setIsSubmitting(true);

    try {
      await withAuthTimeout(service.forgotPassword(result.data));
      if (isMounted.current) {
        setIsSuccessful(true);
      }
    } catch (error) {
      if (!isMounted.current) {
        return;
      }

      if (isUnexpectedAuthError(error)) {
        reportUnexpectedAuthError(
          AUTH_SERVICE_OPERATION.FORGOT_PASSWORD,
          error,
        );
      }

      const mappedError = getAuthErrorMapping(
        error,
        AUTH_SERVICE_OPERATION.FORGOT_PASSWORD,
      );

      if (mappedError.field === "email") {
        setFieldError(mappedError.message);
        focusFieldById(FORGOT_PASSWORD_FIELD_ID, { defer: true });
      } else {
        setFormError(mappedError.message);
      }
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  }

  const classes = cn("flex flex-col gap-5", className);

  if (isSuccessful) {
    return (
      <AuthSuccessState
        title="Revisa tu bandeja de entrada"
        message="Si existe una cuenta con este correo, se envió un enlace de recuperación."
        actionHref="/login"
        actionLabel="Volver a iniciar sesión"
        retryLabel="Probar con otro correo"
        onRetry={handleRetry}
      />
    );
  }

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
          id={FORGOT_PASSWORD_FIELD_ID}
          name="email"
          type="email"
          label="Correo electrónico"
          autoComplete="email"
          value={values.email}
          onChange={(event) => handleEmailChange(event.target.value)}
          onBlur={handleEmailBlur}
          invalid={Boolean(fieldError)}
          error={fieldError}
          aria-describedby="forgot-password-email-help"
          disabled={isSubmitting}
        />
        <p
          id="forgot-password-email-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          Usaremos este correo para enviarte instrucciones de recuperación si
          existe una cuenta.
        </p>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting
            ? "Enviando enlace de recuperación…"
            : "Enviar enlace de recuperación"}
        </Button>
        {isSubmitting ? (
          <p className="sr-only" role="status" aria-live="polite">
            Enviando enlace de recuperación…
          </p>
        ) : null}
      </form>
      <div className="mt-6 text-sm">
        <AuthTextLink href="/login">Volver a iniciar sesión</AuthTextLink>
      </div>
    </>
  );
}
