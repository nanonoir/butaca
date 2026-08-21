import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AuthLayoutProps extends Omit<
  ComponentPropsWithoutRef<"main">,
  "children"
> {
  children: ReactNode;
}

export function AuthLayout({ children, className, ...props }: AuthLayoutProps) {
  const mainClasses = cn(
    "min-h-dvh overflow-y-auto bg-background px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:flex sm:items-center sm:justify-center sm:px-6 md:px-8",
    className,
  );

  return (
    <main {...props} className={mainClasses}>
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-floating md:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
