import type { ReactNode } from "react";

import { MainSurface } from "./main-surface";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-dvh bg-background p-2">
      <MainSurface>{children}</MainSurface>
    </div>
  );
}
