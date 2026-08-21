"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  ResetPasswordRequestSchema,
  type ResetPasswordRequest,
} from "@/contracts";
import { AuthTextLink } from "@/components/shared/auth-text-link";
import { FormAlert } from "@/components/shared/form-alert";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

import { AuthSuccessState } from "./auth-success-state";
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
import { PasswordRequirements } from "./password-requirements";
import {
  INITIAL_RESET_VALUES,
  RESET_FIELDS,
  RESET_FIELD_IDS,
  RESET_LINK_STATUS,
  getInvalidLinkMessage,
  getResetError,
  type ResetField,
  type ResetFieldErrors,
  type ResetLinkStatus,
} from "./reset-password-form.helpers";

export { RESET_LINK_STATUS } from "./reset-password-form.helpers";
export type { ResetLinkStatus } from "./reset-password-form.helpers";

export interface ResetPasswordFormProps {
  service?: AuthService;
  linkStatus?: ResetLinkStatus;
  onSuccess?: () => void | Promise<void>;
  className?: string;
}

export function ResetPasswordForm({
  service = authServiceStub,
  linkStatus = RESET_LINK_STATUS.VALID,
  onSuccess,
  className,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [values, setValues] =
    useState<ResetPasswordRequest>(INITIAL_RESET_VALUES);
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({});
  const [touched, setTouched] = useState<Record<ResetField, boolean>>({
    newPassword: false,
    confirmPassword: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [currentLinkStatus, setCurrentLinkStatus] = useState(linkStatus);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleFieldChange(field: ResetField, value: string): void {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setFormError(null);

    if (touched[field] || hasSubmitted) {
      const result = ResetPasswordRequestSchema.safeParse(nextValues);
      setFieldErrors((previous) => ({
        ...previous,
        [field]: result.success
          ? undefined
          : getZodFieldMessage(result.error.issues, field),
      }));
    } else if (fieldErrors[field]) {
      setFieldErrors((previous) => {
        const nextErrors = { ...previous };
        delete nextErrors[field];
        return nextErrors;
      });
    }
  }

  function handleFieldBlur(field: ResetField): void {
    setTouched((previous) => ({ ...previous, [field]: true }));
    const result = ResetPasswordRequestSchema.safeParse(values);
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
    const result = ResetPasswordRequestSchema.safeParse(values);

    if (!result.success) {
      const errors = getZodFieldMessages(result.error.issues, RESET_FIELDS);
      setFieldErrors(errors);
      setTouched({ newPassword: true, confirmPassword: true });
      setFormError("Corrige los campos marcados antes de continuar.");
      focusFirstInvalidField(errors, RESET_FIELDS, RESET_FIELD_IDS);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);

    let keepSubmitting = false;

    try {
      try {
        await withAuthTimeout(service.resetPassword(result.data));
      } catch (error) {
        if (!isMounted.current) {
          return;
        }

        if (isUnexpectedAuthError(error)) {
          reportUnexpectedAuthError(AUTH_SERVICE_OPERATION.RESET_PASSWORD, error);
        }

        const mappedError = getResetError(error);

        if (mappedError.linkStatus) {
          setCurrentLinkStatus(mappedError.linkStatus);
        } else if (mappedError.field) {
          const field = mappedError.field;
          setFieldErrors({ [field]: mappedError.message });
          setTouched((previous) => ({
            ...previous,
            [field]: true,
          }));
          focusFieldById(RESET_FIELD_IDS[field], { defer: true });
        } else {
          setFormError(mappedError.message ?? "Intenta de nuevo.");
        }

        return;
      }

      if (!isMounted.current) {
        return;
      }

      if (onSuccess) {
        keepSubmitting = true;

        try {
          await onSuccess();
          keepSubmitting = false;

          if (isMounted.current) {
            setIsSuccessful(true);
          }
        } catch (error) {
          if (isNextRedirectError(error)) {
            throw error;
          }

          keepSubmitting = false;

          if (!isMounted.current) {
            return;
          }

          reportUnexpectedAuthError(AUTH_SERVICE_OPERATION.RESET_PASSWORD, error);
          setFormError(
            getAuthFallbackMessage(AUTH_SERVICE_OPERATION.RESET_PASSWORD),
          );
        }
      } else {
        router.push("/login?reset=success");
        keepSubmitting = true;
      }
    } finally {
      if (isMounted.current && !keepSubmitting) {
        setIsSubmitting(false);
      }
    }
  }

  const classes = cn("flex flex-col gap-5", className);

  if (currentLinkStatus !== RESET_LINK_STATUS.VALID) {
    return (
      <section
        aria-labelledby="reset-link-error-title"
        className="flex flex-col gap-5"
      >
        <h2
          id="reset-link-error-title"
          className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground"
        >
          Enlace de recuperación no disponible
        </h2>
        <FormAlert>{getInvalidLinkMessage(currentLinkStatus)}</FormAlert>
        <AuthTextLink href="/forgot-password">
          Solicitar un nuevo enlace de recuperación
        </AuthTextLink>
      </section>
    );
  }

  if (isSuccessful) {
    return (
      <AuthSuccessState
        title="Contraseña actualizada"
        message="Tu contraseña fue actualizada. Ahora puedes iniciar sesión con la nueva contraseña."
        actionHref="/login?reset=success"
        actionLabel="Continuar para iniciar sesión"
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
        <PasswordInput
          id={RESET_FIELD_IDS.newPassword}
          name="newPassword"
          label="Nueva contraseña"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(event) =>
            handleFieldChange("newPassword", event.target.value)
          }
          onBlur={() => handleFieldBlur("newPassword")}
          invalid={Boolean(fieldErrors.newPassword)}
          error={fieldErrors.newPassword}
          aria-describedby="reset-password-requirements"
          disabled={isSubmitting}
        />
        <PasswordRequirements
          id="reset-password-requirements"
          password={values.newPassword}
          className="-mt-3"
        />
        <PasswordInput
          id={RESET_FIELD_IDS.confirmPassword}
          name="confirmPassword"
          label="Confirmar nueva contraseña"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) =>
            handleFieldChange("confirmPassword", event.target.value)
          }
          onBlur={() => handleFieldBlur("confirmPassword")}
          invalid={Boolean(fieldErrors.confirmPassword)}
          error={fieldErrors.confirmPassword}
          aria-describedby="reset-confirm-password-help"
          disabled={isSubmitting}
        />
        <p
          id="reset-confirm-password-help"
          className="-mt-3 text-sm text-muted-foreground"
        >
          Ingresa la misma contraseña de nuevo.
        </p>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Actualizando contraseña…" : "Actualizar contraseña"}
        </Button>
        {isSubmitting ? (
          <p className="sr-only" role="status" aria-live="polite">
            Actualizando contraseña…
          </p>
        ) : null}
      </form>
      <div className="mt-6 text-sm">
        <AuthTextLink href="/forgot-password">
          Solicitar un nuevo enlace de recuperación
        </AuthTextLink>
      </div>
    </>
  );
}
