import { runAuthAction } from "@/features/auth/auth-http";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

export async function POST(request: Request): Promise<Response> {
  return runAuthAction(request, async () => {
    const authService = await getServerAuthService();
    await authService.signOut();

    return new Response(null, { status: 204 });
  });
}
