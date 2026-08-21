import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";

const RESET_PASSWORD_PATH = "/reset-password";
const EXPIRED_LINK_ERROR_CODE = "otp_expired";

/** Landing point of the recovery email. It exchanges the one-time code for the
 * session that `PATCH`-ing the password requires, then hands the user to the
 * form. The link status travels as a query param the reset page already reads. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const target = new URL(RESET_PASSWORD_PATH, request.nextUrl.origin);
  const code = params.get("code");
  const errorCode = params.get("error_code");

  if (errorCode || params.get("error")) {
    target.searchParams.set(
      "status",
      errorCode === EXPIRED_LINK_ERROR_CODE ? "expired" : "invalid",
    );

    return NextResponse.redirect(target);
  }

  if (!code) {
    target.searchParams.set("status", "invalid");

    return NextResponse.redirect(target);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    target.searchParams.set("status", "invalid");
  }

  return NextResponse.redirect(target);
}
