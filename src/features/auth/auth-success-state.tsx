import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { AuthTextLink } from "@/components/shared/auth-text-link";
import { FormAlert, FORM_ALERT_VARIANT } from "@/components/shared/form-alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AuthSuccessStateProps extends Omit<
  ComponentPropsWithoutRef<"section">,
  "children"
> {
  title: string;
  message: ReactNode;
  actionHref: string;
  actionLabel: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function AuthSuccessState({
  title,
  message,
  actionHref,
  actionLabel,
  retryLabel,
  onRetry,
  className,
  ...props
}: AuthSuccessStateProps) {
  const titleId = useId();
  const classes = cn("flex flex-col gap-5", className);

  return (
    <section {...props} aria-labelledby={titleId} className={classes}>
      <h2
        id={titleId}
        className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground"
      >
        {title}
      </h2>
      <FormAlert variant={FORM_ALERT_VARIANT.SUCCESS}>{message}</FormAlert>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <AuthTextLink href={actionHref}>{actionLabel}</AuthTextLink>
        {onRetry && retryLabel ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
