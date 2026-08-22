import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env/public";

export type SessionUpdate = {
  response: NextResponse;
  isAuthenticated: boolean;
  userId: string | null;
};

export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdate> {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const claims = await supabase.auth.getClaims();

  const userId =
    !claims?.error && typeof claims?.data?.claims.sub === "string"
      ? claims.data.claims.sub
      : null;

  return {
    response,
    // Defensive optional access: the only contract this function relies on is
    // that the call settles, so a provider shape change degrades to "guest"
    // instead of throwing inside the proxy.
    isAuthenticated: userId !== null,
    userId,
  };
}
