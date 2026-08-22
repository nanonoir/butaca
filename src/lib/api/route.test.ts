import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { ApiErrorSchema } from "@/contracts";
import {
  AuthProviderError,
  UnauthenticatedError,
  UserProfileNotProvisionedError,
} from "@/features/auth/errors";
import { TmdbError } from "@/integrations/tmdb";

vi.mock("@/features/auth/server-auth-factory", () => ({
  getServerAuthService: vi.fn(),
}));

const {
  ApiRouteError,
  apiData,
  apiError,
  readJsonBody,
  runApiRoute,
  toApiErrorCode,
} = await import("./route");

function jsonRequest(body: string): Request {
  return new Request("https://app.test/api/movies/1", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
}

describe("apiData", () => {
  it("wraps the payload in the shared data envelope", async () => {
    const response = apiData({ movieId: 1 });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { movieId: 1 } });
  });

  it("honours an explicit created status", () => {
    expect(apiData({ movieId: 1 }, 201).status).toBe(201);
  });
});

describe("apiError", () => {
  it("builds a body the shared contract accepts", async () => {
    const response = apiError("REVIEW_NOT_FOUND");
    const body: unknown = await response.json();

    expect(response.status).toBe(404);
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it("maps each code to its transport status", () => {
    expect(apiError("UNAUTHORIZED").status).toBe(401);
    expect(apiError("VALIDATION_ERROR").status).toBe(400);
    expect(apiError("ONBOARDING_REQUIRED").status).toBe(403);
    expect(apiError("REACTION_REQUIRED").status).toBe(409);
    expect(apiError("TMDB_UNAVAILABLE").status).toBe(503);
    expect(apiError("INTERNAL_ERROR").status).toBe(500);
  });
});

describe("toApiErrorCode", () => {
  it("keeps the code a service chose explicitly", () => {
    expect(toApiErrorCode(new ApiRouteError("REVIEW_NOT_FOUND"))).toBe(
      "REVIEW_NOT_FOUND",
    );
  });

  it("maps a missing session to UNAUTHORIZED", () => {
    expect(toApiErrorCode(new UnauthenticatedError())).toBe("UNAUTHORIZED");
    expect(toApiErrorCode(new UserProfileNotProvisionedError())).toBe(
      "UNAUTHORIZED",
    );
  });

  it("separates an unknown movie from a catalog outage", () => {
    expect(toApiErrorCode(new TmdbError("NOT_FOUND", 404))).toBe(
      "MOVIE_NOT_FOUND",
    );
    expect(toApiErrorCode(new TmdbError("RATE_LIMITED", 429))).toBe(
      "TMDB_UNAVAILABLE",
    );
    expect(toApiErrorCode(new TmdbError("UNAVAILABLE"))).toBe(
      "TMDB_UNAVAILABLE",
    );
  });

  it("maps contract validation failures", () => {
    const failure = z.object({ id: z.number() }).safeParse({ id: "x" });

    expect(failure.success).toBe(false);
    if (!failure.success) {
      expect(toApiErrorCode(failure.error)).toBe("VALIDATION_ERROR");
    }
  });

  it("maps anything unrecognized to INTERNAL_ERROR", () => {
    expect(toApiErrorCode(new AuthProviderError())).toBe("INTERNAL_ERROR");
    expect(toApiErrorCode(new Error("boom"))).toBe("INTERNAL_ERROR");
    expect(toApiErrorCode("nope")).toBe("INTERNAL_ERROR");
  });
});

describe("runApiRoute", () => {
  it("returns the handler response untouched on success", async () => {
    const response = await runApiRoute(async () => apiData({ ok: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { ok: true } });
  });

  it("converts a thrown domain error into a contract error", async () => {
    const response = await runApiRoute(async () => {
      throw new UnauthenticatedError();
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(401);
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("never leaks the message of an unexpected failure", async () => {
    const response = await runApiRoute(async () => {
      throw new Error("connection string postgres://secret@host/db");
    });

    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("passes the details a service attached", async () => {
    const response = await runApiRoute(async () => {
      throw new ApiRouteError("VALIDATION_ERROR", { field: "verdict" });
    });

    await expect(response.json()).resolves.toMatchObject({
      error: { details: { field: "verdict" } },
    });
  });
});

describe("readJsonBody", () => {
  it("returns the parsed body when it matches the contract", async () => {
    await expect(
      readJsonBody(
        jsonRequest(JSON.stringify({ reaction: "LIKE" })),
        z.object({ reaction: z.enum(["LIKE", "DISLIKE"]) }),
      ),
    ).resolves.toEqual({ reaction: "LIKE" });
  });

  it("rejects a body that does not match the contract", async () => {
    await expect(
      readJsonBody(
        jsonRequest(JSON.stringify({ reaction: "MAYBE" })),
        z.object({ reaction: z.enum(["LIKE", "DISLIKE"]) }),
      ),
    ).rejects.toBeInstanceOf(ApiRouteError);
  });

  it("rejects a body that is not JSON", async () => {
    await expect(
      readJsonBody(jsonRequest("not json"), z.object({})),
    ).rejects.toBeInstanceOf(ApiRouteError);
  });
});
