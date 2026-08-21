import { AuthHeader } from "@/components/shared/auth-header";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Únete a Butaca"
        title="Crear tu cuenta"
        description="Empieza a crear tu perfil de gustos para tu próxima gran película."
      />
      <RegisterForm />
    </div>
  );
}
