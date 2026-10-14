import { runAuthAction } from "@/features/auth/auth-http";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

/** Takes no body: the account and its address are resolved from the session on
 * the server, never from the client. Answers 204 once the request was handed to
 * the mail provider, which says nothing about final delivery. */
export async function POST(request: Request): Promise<Response> {
  return runAuthAction(request, async () => {
    const authService = await getServerAuthService();
    await authService.requestEmailVerification();

    return new Response(null, { status: 204 });
  });
}
