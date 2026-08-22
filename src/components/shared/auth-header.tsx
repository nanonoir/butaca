import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AuthHeaderProps extends Omit<
  ComponentPropsWithoutRef<"header">,
  "children"
> {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
}

export function AuthHeader({
  eyebrow,
  title,
  description,
  className,
  ...props
}: AuthHeaderProps) {
  const headerClasses = cn("flex flex-col gap-3", className);

  return (
    <header {...props} className={headerClasses}>
      {eyebrow ? (
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="text-base leading-7 text-muted">{description}</p>
      ) : null}
    </header>
  );
}
