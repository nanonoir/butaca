import { AuthHeader } from "@/components/shared/auth-header";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Recuperación de cuenta"
        title="Recuperar tu contraseña"
        description="Ingresa tu correo y te ayudaremos a volver a tu cuenta."
      />
      <ForgotPasswordForm />
    </div>
  );
}
