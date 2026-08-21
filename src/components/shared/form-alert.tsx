import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const FORM_ALERT_VARIANT = {
  ERROR: "error",
  SUCCESS: "success",
} as const;

export type FormAlertVariant =
  (typeof FORM_ALERT_VARIANT)[keyof typeof FORM_ALERT_VARIANT];

export interface FormAlertProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "role" | "aria-live" | "aria-atomic"
> {
  variant?: FormAlertVariant;
  children?: ReactNode;
  message?: ReactNode;
}

function ErrorIcon() {
  return (
    <svg className="size-5" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg className="size-5" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.5 12.2 2.3 2.3 4.8-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FormAlert({
  variant = FORM_ALERT_VARIANT.ERROR,
  children,
  message,
  className,
  ...props
}: FormAlertProps) {
  const content = children ?? message;

  if (content === undefined || content === null) {
    return null;
  }

  const isError = variant === FORM_ALERT_VARIANT.ERROR;
  const classes = cn(
    "flex items-start gap-3 rounded-lg border p-4 text-foreground",
    isError ? "border-primary/60 bg-primary/10" : "border-border bg-secondary",
    className,
  );

  return (
    <div
      {...props}
      className={classes}
      data-variant={variant}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="mt-0.5 size-5 shrink-0 text-primary">
        {isError ? <ErrorIcon /> : <SuccessIcon />}
      </span>
      <p className="text-sm leading-6">
        <span className="sr-only">{isError ? "Error: " : "Éxito: "}</span>
        {content}
      </p>
    </div>
  );
}
