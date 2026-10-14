import { ResetPasswordRequestSchema } from "@/contracts/auth";
import { authErrorResponse, runAuthRoute } from "@/features/auth/auth-http";
import {
  InvalidAuthTokenError,
  UnauthenticatedError,
} from "@/features/auth/errors";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

export async function POST(request: Request): Promise<Response> {
  return runAuthRoute(request, ResetPasswordRequestSchema, async (input) => {
    const authService = await getServerAuthService();

    try {
      await authService.updatePassword({
        newPassword: input.newPassword,
        token: input.token,
      });
    } catch (error) {
      // An unknown, expired or already used token is the same answer to the
      // client; the form renders it as an invalid link.
      if (
        error instanceof InvalidAuthTokenError ||
        error instanceof UnauthenticatedError
      ) {
        return authErrorResponse("INVALID_RESET_LINK");
      }

      throw error;
    }

    return new Response(null, { status: 204 });
  });
}
