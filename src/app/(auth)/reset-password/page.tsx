import { AuthHeader } from "@/components/shared/auth-header";
import {
  ResetPasswordForm,
  type ResetLinkStatus,
} from "@/features/auth/reset-password-form";

type ResetSearchParams = Record<string, string | string[] | undefined>;

function getLinkStatus(value: string | string[] | undefined): ResetLinkStatus {
  const status = Array.isArray(value) ? value[0] : value;

  if (status === "expired") {
    return "expired";
  }

  if (status === "invalid") {
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

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Recuperación de cuenta"
        title="Establecer una nueva contraseña"
        description="Elige una nueva contraseña que cumpla con los requisitos de seguridad."
      />
      <ResetPasswordForm linkStatus={getLinkStatus(params.status)} />
    </div>
  );
}
