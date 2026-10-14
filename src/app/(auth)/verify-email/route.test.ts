import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyEmail = vi.hoisted(() => vi.fn());
const getServerAuthService = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/server-auth-factory", () => ({
  getServerAuthService,
}));

const { GET } = await import("./route");

function callback(query: string) {
  return GET(new NextRequest(`https://app.test/verify-email${query}`));
}

describe("GET /verify-email", () => {
  beforeEach(() => {
    verifyEmail.mockReset();
    getServerAuthService.mockReset();
    getServerAuthService.mockResolvedValue({ verifyEmail });
  });

  it("verifies the token and hands the user to the app", async () => {
    verifyEmail.mockResolvedValue(undefined);

    const response = await callback("?token=opaque-token");

    expect(verifyEmail).toHaveBeenCalledWith("opaque-token");
    expect(response.headers.get("location")).toBe("https://app.test/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not block the user when the token is rejected or the service is down", async () => {
    verifyEmail.mockRejectedValue(new Error("invalid"));

    const response = await callback("?token=opaque-token");

    expect(response.headers.get("location")).toBe("https://app.test/");
  });

  it("skips the provider when there is no token", async () => {
    const response = await callback("");

    expect(verifyEmail).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.test/");
  });
});
