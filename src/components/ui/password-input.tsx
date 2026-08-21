"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import { BUTTON_VARIANT, Button, CONTROL_SIZE } from "./button";
import { Input, type InputProps } from "./input";

export type PasswordInputProps = Omit<InputProps, "type">;

function EyeIcon() {
  return (
    <svg
      className="size-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="size-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M3.5 12s3.1-5 8.5-5c1.2 0 2.3.3 3.2.7M20.5 12s-3.1 5-8.5 5c-1.2 0-2.3-.3-3.2-.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m4 4 16 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PasswordInput({
  id: providedId,
  label,
  error,
  invalid = false,
  className,
  autoComplete = "current-password",
  disabled = false,
  "aria-describedby": describedBy,
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const describedByIds = cn(describedBy, error ? errorId : undefined);
  const [isVisible, setIsVisible] = useState(false);

  const inputClassName = cn("pr-14", className);

  return (
    <div className="flex w-full flex-col gap-2">
      {label ? (
        <label className="text-sm font-medium text-foreground" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="relative w-full">
        <Input
          {...props}
          id={id}
          className={inputClassName}
          label={undefined}
          error={undefined}
          invalid={invalid}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={describedByIds || undefined}
        />
        <Button
          type="button"
          variant={BUTTON_VARIANT.ICON}
          size={CONTROL_SIZE.MD}
          className="absolute inset-y-0 right-0 z-10"
          aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={isVisible}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setIsVisible((visible) => !visible)}
          disabled={disabled}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
