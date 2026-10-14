import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionWithHeaders, findById } = vi.hoisted(() => ({
  getSessionWithHeaders: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/integrations/better-auth", () => ({ getSessionWithHeaders }));
vi.mock("@/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/db/repositories", () => ({
  UserRepository: class {
    findById = findById;
  },
}));

const { proxy } = await import("./proxy");

const COMPLETED_AT = new Date("2026-08-21T18:00:00.000Z");

function request(pathname: string): NextRequest {
  return new NextRequest(`https://app.test${pathname}?x=1`);
}

function session(setCookie?: string) {
  const responseHeaders = new Headers();

  if (setCookie) {
    responseHeaders.append("set-cookie", setCookie);
  }

  return { userId: "u1", email: "a@b.test", emailVerified: false, responseHeaders };
}

describe("proxy", () => {
  beforeEach(() => {
    getSessionWithHeaders.mockReset();
    findById.mockReset();
  });

  it("does not resolve a session for API routes", async () => {
    const response = await proxy(request("/api/ready"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getSessionWithHeaders).not.toHaveBeenCalled();
  });

  it("sends a guest on a product route to the sign-in page", async () => {
    getSessionWithHeaders.mockResolvedValue(null);

    const response = await proxy(request("/liked"));

    expect(response.headers.get("location")).toBe("https://app.test/login");
  });

  it("lets a guest reach the auth pages", async () => {
    getSessionWithHeaders.mockResolvedValue(null);

    const response = await proxy(request("/login"));

    expect(response.headers.get("location")).toBeNull();
    expect(findById).not.toHaveBeenCalled();
  });

  it("keeps a session without onboarding on onboarding, with no loop", async () => {
    getSessionWithHeaders.mockResolvedValue(session());
    findById.mockResolvedValue({ onboardingCompletedAt: null });

    expect(
      (await proxy(request("/"))).headers.get("location"),
    ).toBe("https://app.test/onboarding");
    expect((await proxy(request("/onboarding"))).headers.get("location")).toBeNull();
  });

  it("lets a completed user through and forwards the renewed session cookie", async () => {
    getSessionWithHeaders.mockResolvedValue(session("sid=renewed; Path=/"));
    findById.mockResolvedValue({ onboardingCompletedAt: COMPLETED_AT });

    const response = await proxy(request("/liked"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(["sid=renewed; Path=/"]);
  });

  it("keeps the renewed cookie on a guard redirect", async () => {
    getSessionWithHeaders.mockResolvedValue(session("sid=renewed; Path=/"));
    findById.mockResolvedValue({ onboardingCompletedAt: COMPLETED_AT });

    const response = await proxy(request("/login"));

    expect(response.headers.get("location")).toBe("https://app.test/");
    expect(response.headers.getSetCookie()).toEqual(["sid=renewed; Path=/"]);
  });

  it("answers 503 instead of treating a session lookup failure as a guest", async () => {
    getSessionWithHeaders.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await proxy(request("/liked"));

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("answers 503 for a valid session whose profile is missing", async () => {
    getSessionWithHeaders.mockResolvedValue(session());
    findById.mockResolvedValue(null);

    const response = await proxy(request("/onboarding"));

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });

  it("answers 503 instead of unlocking routes when the profile lookup fails", async () => {
    getSessionWithHeaders.mockResolvedValue(session());
    findById.mockRejectedValue(new Error("down"));

    const response = await proxy(request("/liked"));

    expect(response.status).toBe(503);
  });
});
