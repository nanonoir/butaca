import { afterAll, describe, expect, it, vi } from "vitest";

const CANONICAL_ORIGIN = vi.hoisted(() => "http://localhost:3100");

// The origin guard reads the canonical origin; this test has no full auth
// runtime config, so pin it instead of loading real environment secrets.
vi.mock("../../src/integrations/better-auth", () => ({
  getAuthBaseUrl: () => CANONICAL_ORIGIN,
}));

import { createDatabaseConnection } from "../../src/db/client";
import { UserRepository } from "../../src/db/repositories/user-repository";
import { ServiceUnavailableError } from "../../src/features/auth/errors";
import { runAuthAction } from "../../src/features/auth/auth-http";
import { GET as health } from "../../src/app/api/health/route";
import { apiError, toApiErrorCode } from "../../src/lib/api/route";
import { withDatabaseAvailability } from "../../src/db/errors";
import { createAuthHarness } from "./support/auth-harness";
import { assertIsolatedDatabaseUrl } from "./support/env";

// Port 1 on loopback has no listener, so every connection is refused. This
// exercises the real driver error path without touching any server.
const UNREACHABLE_URL =
  "postgres://butaca_test:unused@127.0.0.1:1/butaca_unreachable_test";

assertIsolatedDatabaseUrl(UNREACHABLE_URL);

const connection = createDatabaseConnection(UNREACHABLE_URL);

afterAll(async () => {
  await connection.close();
});

describe("database unavailable", () => {
  it("turns a refused connection into ServiceUnavailableError", async () => {
    await expect(
      withDatabaseAvailability(() =>
        new UserRepository(connection.db).findById(crypto.randomUUID()),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("maps it to a 503 SERVICE_UNAVAILABLE API envelope", async () => {
    const error = await withDatabaseAvailability(() =>
      new UserRepository(connection.db).findById(crypto.randomUUID()),
    ).catch((caught: unknown) => caught);

    expect(toApiErrorCode(error)).toBe("SERVICE_UNAVAILABLE");

    const response = apiError(toApiErrorCode(error));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE" },
    });
  });

  it("surfaces an unreachable database through real Better Auth as 503 AUTH_UNAVAILABLE", async () => {
    const harness = createAuthHarness(connection.db);

    const request = new Request(`${CANONICAL_ORIGIN}/api/login`, {
      method: "POST",
      headers: { origin: CANONICAL_ORIGIN },
    });

    const response = await runAuthAction(request, async () => {
      await harness
        .service()
        .signIn({
          email: "butaca-test-down@example.test",
          password: "Aa1-down-pass",
        });

      return Response.json({});
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it("keeps liveness answering while the database is down", async () => {
    const response = health();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: "ok" } });
  });
});
