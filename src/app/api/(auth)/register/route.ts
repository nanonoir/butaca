import { RegisterRequestSchema } from "@/contracts/auth";
import { runAuthRoute, toAuthUser } from "@/features/auth/auth-http";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

export async function POST(request: Request): Promise<Response> {
  return runAuthRoute(request, RegisterRequestSchema, async (input) => {
    const authService = await getServerAuthService();
    const user = await authService.signUp({
      email: input.email,
      password: input.password,
      displayName: input.username,
    });

    return Response.json(
      { data: toAuthUser(user, input.email) },
      { status: 201 },
    );
  });
}
