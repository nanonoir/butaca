import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const AUTH_TEXT_LINK_VARIANT = {
  DEFAULT: "default",
  MUTED: "muted",
} as const;

export type AuthTextLinkVariant =
  (typeof AUTH_TEXT_LINK_VARIANT)[keyof typeof AUTH_TEXT_LINK_VARIANT];

export interface AuthTextLinkProps extends Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "children" | "className"
> {
  children: ReactNode;
  variant?: AuthTextLinkVariant;
  className?: string;
}

export function AuthTextLink({
  children,
  variant = AUTH_TEXT_LINK_VARIANT.DEFAULT,
  className,
  ...props
}: AuthTextLinkProps) {
  const classes = cn(
    "font-medium underline decoration-primary/50 underline-offset-4 transition-[color,background-color] duration-fast ease-ui focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    variant === AUTH_TEXT_LINK_VARIANT.MUTED
      ? "text-muted-foreground hover:text-foreground"
      : "text-primary hover:text-primary-hover",
    className,
  );

  return (
    <Link {...props} className={classes}>
      {children}
    </Link>
  );
}
