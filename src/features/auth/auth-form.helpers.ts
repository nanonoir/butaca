import type { ZodIssue } from "zod";

/**
 * DEDUP-03 and DEDUP-08 remain intentionally deferred: submission orchestration
 * and generic field state stay screen-specific. Auth shared components also
 * remain under `components/shared` in this UI-only MVP.
 */
export type AuthFieldErrors<Field extends string> = Partial<
  Record<Field, string>
>;

type FieldValidationIssue = Pick<ZodIssue, "path" | "message">;

export function getZodFieldMessage<Field extends string>(
  issues: readonly FieldValidationIssue[],
  field: Field,
): string | undefined {
  return issues.find((issue) => issue.path[0] === field)?.message;
}

export function getZodFieldMessages<Field extends string>(
  issues: readonly FieldValidationIssue[],
  fields: readonly Field[],
): AuthFieldErrors<Field> {
  return issues.reduce<AuthFieldErrors<Field>>((errors, issue) => {
    const field = issue.path[0];

    if (typeof field === "string" && fields.includes(field as Field)) {
      errors[field as Field] ??= issue.message;
    }

    return errors;
  }, {});
}

export function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = error.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export interface FocusFieldOptions {
  defer?: boolean;
}

export function focusFieldById(
  fieldId: string,
  options: FocusFieldOptions = {},
): void {
  const focus = () => {
    if (typeof document === "undefined") {
      return;
    }

    const element = document.getElementById(fieldId);
    element?.scrollIntoView?.({ block: "center" });
    element?.focus();
  };

  if (options.defer) {
    setTimeout(focus, 0);
    return;
  }

  focus();
}

export function focusFirstInvalidField<Field extends string>(
  errors: AuthFieldErrors<Field>,
  fields: readonly Field[],
  fieldIds: Readonly<Record<Field, string>>,
): Field | undefined {
  const field = fields.find((candidate) => Boolean(errors[candidate]));

  if (field) {
    focusFieldById(fieldIds[field]);
  }

  return field;
}
