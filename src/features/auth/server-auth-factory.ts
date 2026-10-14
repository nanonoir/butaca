import "server-only";

import { headers } from "next/headers";

import { getDatabase } from "../../db";
import { UserRepository } from "../../db/repositories/user-repository";
import {
  createAuthApiPort,
  getAuth,
  getAuthRateLimiter,
} from "../../integrations/better-auth";

import { ServerAuthService } from "./server-auth-service";

/** Built per request: the service forwards this request's headers (cookies, IP,
 * user agent) to the provider, so it must never be cached across requests the
 * way the database and the provider instance are. */
export async function getServerAuthService(): Promise<ServerAuthService> {
  // Resolve the request before runtime-only dependencies: this also tells Next
  // that authenticated pages cannot be prerendered without a request.
  const requestHeaders = await headers();

  return new ServerAuthService(
    createAuthApiPort(getAuth()),
    new UserRepository(getDatabase()),
    { headers: requestHeaders, limiter: getAuthRateLimiter() },
  );
}
