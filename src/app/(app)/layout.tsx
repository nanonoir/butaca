import type { ReactNode } from "react";

import { AppShell } from "@/components/shared/app-shell";

export default function ProductLayout({
  children,
  modal,
}: {
  children: ReactNode;
  /** Where an intercepted detail lands. It sits beside the page rather than
   * replacing it, which is the whole reason the list underneath survives. */
  modal: ReactNode;
}) {
  return (
    <AppShell>
      {children}
      {modal}
    </AppShell>
  );
}
