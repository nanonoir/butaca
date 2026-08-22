import type { ReactNode } from "react";

import { AppShell } from "@/components/shared/app-shell";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
