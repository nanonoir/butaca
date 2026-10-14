"use client";

import { useState } from "react";

import { FORM_ALERT_VARIANT, FormAlert } from "@/components/shared/form-alert";
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import { isAuthServiceError } from "@/features/auth/auth-service";
import { resendVerificationRequest } from "@/features/auth/http-auth-service";

type RequestState = "idle" | "sending" | "accepted" | "failed" | "limited";

const FAILURE_COPY = {
  failed: "No pudimos solicitar el correo. Intenta de nuevo más tarde.",
  limited: "Hiciste muchos intentos. Intenta de nuevo más tarde.",
} as const;

/** Verification never gates the app; this is only the retry for an address
 * whose first email may not have gone out. */
export function ProfileEmailVerification({
  emailVerified,
}: {
  emailVerified: boolean;
}) {
  const [state, setState] = useState<RequestState>("idle");

  if (emailVerified) {
    return <p className="mt-4 text-sm text-muted">Correo verificado.</p>;
  }

  async function handleResend(): Promise<void> {
    if (state === "sending") {
      return;
    }

    setState("sending");

    try {
      await resendVerificationRequest();
      setState("accepted");
    } catch (error) {
      setState(
        isAuthServiceError(error) && error.code === "RATE_LIMITED"
          ? "limited"
          : "failed",
      );
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted">Tu correo aún no está verificado.</p>
      <Button
        disabled={state === "sending"}
        onClick={handleResend}
        type="button"
        variant={BUTTON_VARIANT.OUTLINE}
      >
        {state === "sending" ? "Enviando…" : "Reenviar verificación"}
      </Button>
      {state === "accepted" ? (
        <FormAlert variant={FORM_ALERT_VARIANT.SUCCESS}>
          Solicitamos el envío del correo de verificación. Puede tardar unos
          minutos en llegar.
        </FormAlert>
      ) : null}
      {state === "failed" || state === "limited" ? (
        <FormAlert>{FAILURE_COPY[state]}</FormAlert>
      ) : null}
    </div>
  );
}
