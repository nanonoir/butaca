import { runAuthAction } from "@/features/auth/auth-http";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

export async function POST(): Promise<Response> {
  return runAuthAction(async () => {
    const authService = await getServerAuthService();
    await authService.signOut();

    return new Response(null, { status: 204 });
  });
}
