import type { ReactNode } from "react";

import { FloatingNavigation } from "./floating-navigation";

interface MainSurfaceProps {
  children: ReactNode;
}

export function MainSurface({ children }: MainSurfaceProps) {
  return (
    <div className="relative flex min-h-[calc(100dvh-1rem)] flex-col overflow-visible rounded-shell border border-border bg-surface">
      <FloatingNavigation />
      <main className="flex min-h-0 flex-1 flex-col px-4 pb-24 pt-5 md:px-8 md:py-8 md:pl-48">
        {children}
      </main>
    </div>
  );
}
