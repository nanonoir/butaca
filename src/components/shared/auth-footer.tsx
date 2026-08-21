import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AuthFooterProps extends Omit<
  ComponentPropsWithoutRef<"footer">,
  "children"
> {
  children: ReactNode;
}

export function AuthFooter({ children, className, ...props }: AuthFooterProps) {
  const footerClasses = cn(
    "mt-6 border-t border-border pt-5 text-center text-sm text-muted",
    className,
  );

  return (
    <footer {...props} className={footerClasses}>
      <nav
        aria-label="Navegación de autenticación"
        className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3"
      >
        {children}
      </nav>
    </footer>
  );
}
