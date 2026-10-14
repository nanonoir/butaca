import { ForgotPasswordRequestSchema } from "@/contracts/auth";
import { runAuthRoute } from "@/features/auth/auth-http";
import { getServerAuthService } from "@/features/auth/server-auth-factory";
import { getAuthBaseUrl } from "@/integrations/better-auth";

export async function POST(request: Request): Promise<Response> {
  return runAuthRoute(request, ForgotPasswordRequestSchema, async (input) => {
    const authService = await getServerAuthService();

    await authService.requestPasswordReset({
      email: input.email,
      redirectTo: new URL("/confirm", getAuthBaseUrl()).toString(),
    });

    // Always 204: revealing whether the address exists would turn this route
    // into an account enumeration oracle.
    return new Response(null, { status: 204 });
  });
}
