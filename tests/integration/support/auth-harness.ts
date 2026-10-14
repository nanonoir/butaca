import type { Database } from "../../../src/db/client";
import { UserRepository } from "../../../src/db/repositories/user-repository";
import { ServerAuthService } from "../../../src/features/auth/server-auth-service";
import { createAuthApiPort } from "../../../src/integrations/better-auth/api-port";
import { createAuth } from "../../../src/integrations/better-auth/auth";
import { createRateLimiter } from "../../../src/integrations/better-auth/rate-limit";
import { createResendMailer } from "../../../src/integrations/email";

import { getIntegrationEnv } from "./env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const STUB_RESEND_KEY = "re_stub_not_a_real_key";
export const STUB_MAIL_FROM = "Butaca <no-reply@butaca.lat>";

export type CapturedMail = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  from: string;
  authorization: string | null;
};

/**
 * Real Better Auth on the isolated database, with mail delivered through the
 * real Resend client against an in-process HTTP stub: the request that would
 * leave the process is captured instead, so no network is ever used.
 */
export function createAuthHarness(
  db: Database,
  options: { baseURL?: string } = {},
) {
  const env = getIntegrationEnv();
  const baseURL = new URL(options.baseURL ?? env.BETTER_AUTH_URL).origin;
  const outbox: CapturedMail[] = [];
  const mailErrors: unknown[] = [];
  let resendStatus = 200;

  const stubFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url !== RESEND_ENDPOINT) {
      throw new Error("Unexpected outbound request from the mail client");
    }

    const body = JSON.parse(String(init?.body)) as Omit<
      CapturedMail,
      "authorization"
    >;
    const headers = new Headers(init?.headers);

    outbox.push({ ...body, authorization: headers.get("authorization") });

    return new Response(JSON.stringify({ id: "stub" }), {
      status: resendStatus,
      headers: { "content-type": "application/json" },
    });
  };

  const mailer = createResendMailer(
    { apiKey: STUB_RESEND_KEY, from: STUB_MAIL_FROM },
    stubFetch,
  );
  const auth = createAuth({
    db,
    config: { secret: env.BETTER_AUTH_SECRET, baseURL },
    mailer,
    onMailError: (error) => mailErrors.push(error),
  });
  const users = new UserRepository(db);

  return {
    auth,
    baseURL,
    outbox,
    mailErrors,
    users,
    /** Makes the stubbed provider answer with `status` from now on. */
    setResendStatus(status: number) {
      resendStatus = status;
    },
    /** A service bound to one request: `cookie` plays the browser's jar. */
    service(options: { cookie?: string; address?: string } = {}) {
      const headers = new Headers();

      if (options.cookie) {
        headers.set("cookie", options.cookie);
      }

      headers.set("x-forwarded-for", options.address ?? "198.51.100.10");

      return new ServerAuthService(createAuthApiPort(auth), users, {
        headers,
        limiter: createRateLimiter(),
      });
    },
    /** Mail is sent fire-and-forget, so it lands shortly after the call. */
    async waitForMail(
      predicate: (mail: CapturedMail) => boolean,
    ): Promise<CapturedMail> {
      const deadline = Date.now() + 5_000;

      for (;;) {
        const found = outbox.find(predicate);

        if (found) {
          return found;
        }

        if (Date.now() > deadline) {
          throw new Error("Expected email was not delivered to the stub");
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },
    /** Real HTTP handler: the only place cookies are observable. */
    async post(
      path: string,
      body: unknown,
      cookie?: string,
      origin: string | null = baseURL,
    ) {
      return auth.handler(
        new Request(`${baseURL}/api/auth${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(origin ? { origin } : {}),
            ...(cookie ? { cookie } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    },
  };
}

export type AuthHarness = ReturnType<typeof createAuthHarness>;

/** `name=value` pairs of the response cookies, as a browser would send them. */
export function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .filter((pair): pair is string => Boolean(pair) && !pair?.endsWith("="))
    .join("; ");
}

export function findSetCookie(response: Response, namePart: string) {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.split("=", 1)[0]?.includes(namePart));
}

export function tokenFromLink(text: string): string {
  const link = /https?:\/\/\S+/.exec(text)?.[0];
  const token = link ? new URL(link).searchParams.get("token") : null;

  if (!token) {
    throw new Error("Email did not contain a tokenised link");
  }

  return token;
}
