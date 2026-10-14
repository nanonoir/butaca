import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

function callback(query: string) {
  return GET(new NextRequest(`https://app.test/confirm${query}`));
}

describe("GET /confirm", () => {
  it("hands the token to the reset page without caching it or leaking a referrer", async () => {
    const response = await callback("?token=opaque-token");
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/reset-password");
    expect(location.searchParams.get("token")).toBe("opaque-token");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("reports an invalid link when there is no token", async () => {
    const response = await callback("");
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.searchParams.get("status")).toBe("invalid");
    expect(location.searchParams.has("token")).toBe(false);
  });

  it("never forwards a token that arrives next to a provider error", async () => {
    const response = await callback("?token=opaque-token&error=INVALID_TOKEN");
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.searchParams.get("status")).toBe("invalid");
    expect(location.searchParams.has("token")).toBe(false);
  });

  it("reports an expired link when the provider says so", async () => {
    const response = await callback("?error=TOKEN_EXPIRED");

    expect(
      new URL(response.headers.get("location") ?? "").searchParams.get("status"),
    ).toBe("expired");
  });
});
