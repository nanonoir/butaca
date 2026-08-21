import { AuthHeader } from "@/components/shared/auth-header";
import { LoginForm } from "@/features/auth/login-form";

type LoginSearchParams = Record<string, string | string[] | undefined>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const resetSuccess = params.reset === "success";

  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        eyebrow="Bienvenido de nuevo"
        title="Iniciar sesión"
        description="Usa tu cuenta para seguir descubriendo películas hechas para ti."
      />
      <LoginForm resetSuccess={resetSuccess} />
    </div>
  );
}
