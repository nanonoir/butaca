import { NextResponse, type NextRequest } from "next/server";

import { ResetTokenSchema } from "@/contracts/auth";
import { getServerAuthService } from "@/features/auth/server-auth-factory";

const HOME_PATH = "/";

/** Landing point of the verification email. Verification never gates login or
 * onboarding, so every outcome hands the user to the app; the route guard
 * decides where they actually land. The token is not logged or echoed. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = ResetTokenSchema.safeParse(
    request.nextUrl.searchParams.get("token"),
  );

  if (token.success) {
    try {
      const authService = await getServerAuthService();

      await authService.verifyEmail(token.data);
    } catch {
      // An invalid, expired or unreachable verification must not block the user.
    }
  }

  return NextResponse.redirect(new URL(HOME_PATH, request.nextUrl.origin), {
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
