import { NextResponse, type NextRequest } from "next/server";

const RESET_PASSWORD_PATH = "/reset-password";

/** The callback carries a one-time secret: it must never be cached nor sent on
 * as a referrer. */
const SENSITIVE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

/** Landing point of the recovery email. The provider redirects here with the
 * one-time token (or an error) in the query; this hands it to the reset form,
 * which sends it back with the new password. Nothing is stored and the token is
 * never validated or logged here: the provider owns its lifecycle. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const target = new URL(RESET_PASSWORD_PATH, request.nextUrl.origin);
  const token = params.get("token");
  const error = params.get("error");

  if (token && !error) {
    target.searchParams.set("token", token);
  } else {
    target.searchParams.set(
      "status",
      error?.toLowerCase().includes("expired") ? "expired" : "invalid",
    );
  }

  return NextResponse.redirect(target, { headers: SENSITIVE_HEADERS });
}
