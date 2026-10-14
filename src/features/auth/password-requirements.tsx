import type { ComponentPropsWithoutRef } from "react";

import { PasswordSchema } from "@/contracts/auth";
import { PASSWORD_POLICY } from "@/contracts/password-policy";
import { cn } from "@/lib/utils";

export const PASSWORD_REQUIREMENT = {
  MIN_LENGTH: "min-length",
  UPPERCASE: "uppercase",
  LOWERCASE: "lowercase",
  NUMBER: "number",
} as const;

export type PasswordRequirement =
  (typeof PASSWORD_REQUIREMENT)[keyof typeof PASSWORD_REQUIREMENT];

export interface PasswordRequirementsProps extends Omit<
  ComponentPropsWithoutRef<"ul">,
  "children"
> {
  password: string;
  unmetOnly?: boolean;
}

export function PasswordRequirements({
  password,
  unmetOnly = false,
  className,
  ...props
}: PasswordRequirementsProps) {
  const requirements = [
    {
      key: PASSWORD_REQUIREMENT.MIN_LENGTH,
      label: "Al menos 8 caracteres",
      isMet: password.length >= PASSWORD_POLICY.MIN_LENGTH,
    },
    {
      key: PASSWORD_REQUIREMENT.UPPERCASE,
      label: "Una letra mayúscula",
      isMet: PASSWORD_POLICY.UPPERCASE.test(password),
    },
    {
      key: PASSWORD_REQUIREMENT.LOWERCASE,
      label: "Una letra minúscula",
      isMet: PASSWORD_POLICY.LOWERCASE.test(password),
    },
    {
      key: PASSWORD_REQUIREMENT.NUMBER,
      label: "Un número",
      isMet: PASSWORD_POLICY.NUMBER.test(password),
    },
  ];

  const validation = unmetOnly ? PasswordSchema.safeParse(password) : undefined;
  const visibleRequirements = validation
    ? validation.success
      ? []
      : validation.error.issues.map((issue, index) => ({
          key: `unmet-${index}`,
          label: issue.message,
          isMet: false,
        }))
    : requirements;

  if (visibleRequirements.length === 0) {
    return null;
  }

  const classes = cn("flex flex-col gap-2 text-sm", className);

  return (
    <ul
      {...props}
      className={classes}
      aria-label="Requisitos de la contraseña"
      aria-live="polite"
    >
      {visibleRequirements.map((requirement) => (
        <li
          key={requirement.key}
          className={cn(
            "flex items-center gap-2",
            unmetOnly ? "text-primary" : "text-muted-foreground",
          )}
          data-valid={requirement.isMet}
        >
          <span
            aria-hidden="true"
            className={
              unmetOnly || requirement.isMet ? "text-primary" : "text-muted"
            }
          >
            {requirement.isMet ? "✓" : "○"}
          </span>
          <span>
            {requirement.label}
            {unmetOnly
              ? ""
              : `: ${requirement.isMet ? "cumplido" : "no cumplido"}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
