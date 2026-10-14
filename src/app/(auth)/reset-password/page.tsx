import type { Metadata } from "next";

import { AuthHeader } from "@/components/shared/auth-header";
import {
  ResetPasswordForm,
  type ResetLinkStatus,
} from "@/features/auth/reset-password-form";

type ResetSearchParams = Record<string, string | string[] | undefined>;

/** The page is opened with a one-time token in its query, so nothing it links
 * to or loads may receive that URL as a referrer. */
export const metadata: Metadata = {
  referrer: "no-referrer",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getLinkStatus(
  status: string | undefined,
  token: string | undefined,
): ResetLinkStatus {
  if (status === "expired") {
    return "expired";
  }

  if (status === "invalid" || !token) {
    return "invalid";
  }

  return "valid";
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<ResetSearchParams>;
}) {
  const params = await searchParams;
  const token = firstValue(params.token);

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Recuperación de cuenta"
        title="Establecer una nueva contraseña"
        description="Elige una nueva contraseña que cumpla con los requisitos de seguridad."
      />
      <ResetPasswordForm
        token={token ?? ""}
        linkStatus={getLinkStatus(firstValue(params.status), token)}
      />
    </div>
  );
}
