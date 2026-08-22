import { ResetPasswordRequestSchema } from "@/contracts/auth";
import { authErrorResponse, runAuthRoute } from "@/features/auth/auth-http";
import { UnauthenticatedError } from "@/features/auth/errors";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

export async function POST(request: Request): Promise<Response> {
  return runAuthRoute(request, ResetPasswordRequestSchema, async (input) => {
    const authService = await getServerAuthService();

    try {
      await authService.updatePassword({ newPassword: input.newPassword });
    } catch (error) {
      // A missing recovery session means the link was never exchanged, expired,
      // or was already used. The form renders that as an invalid link.
      if (error instanceof UnauthenticatedError) {
        return authErrorResponse("INVALID_RESET_LINK");
      }

      throw error;
    }

    return new Response(null, { status: 204 });
  });
}
