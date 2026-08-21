import type { ReactNode } from "react";

import { AuthLayout } from "@/components/shared/auth-layout";

export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
