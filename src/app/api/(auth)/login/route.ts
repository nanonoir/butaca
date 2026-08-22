import { LoginRequestSchema } from "@/contracts/auth";
import { runAuthRoute, toAuthUser } from "@/features/auth/auth-http";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

export async function POST(request: Request): Promise<Response> {
  return runAuthRoute(request, LoginRequestSchema, async (input) => {
    const authService = await getServerAuthService();
    const user = await authService.signIn(input);

    return Response.json({ data: toAuthUser(user, input.email) });
  });
}
