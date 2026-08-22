import type { CookieMethodsServer } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "../proxy";

const { createServerClient, getClaims, getSession } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("updateSession", () => {
  it("awaits claim refresh and propagates every cookie on the returned response", async () => {
    const cookiesToSet: Parameters<
      NonNullable<CookieMethodsServer["setAll"]>
    >[0] = [
      {
        name: "sb-access-token",
        value: "rotated-access-token",
        options: { httpOnly: true, path: "/", sameSite: "lax" },
      },
      {
        name: "sb-refresh-token",
        value: "rotated-refresh-token",
        options: { maxAge: 60, path: "/auth", secure: true },
      },
    ];
    const responseHeaders = {
      "Cache-Control":
        "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    };
    let releaseClaims!: () => void;
    const claimsPending = new Promise<void>((resolve) => {
      releaseClaims = resolve;
    });

    createServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        options: { cookies: CookieMethodsServer },
      ) => {
        getClaims.mockImplementation(async () => {
          await claimsPending;
          await options.cookies.setAll?.(cookiesToSet, responseHeaders);
        });

        return { auth: { getClaims, getSession } };
      },
    );

    const request = new NextRequest("https://example.com/discover");
    const nextSpy = vi.spyOn(NextResponse, "next");
    let settled = false;

    const updatePromise = updateSession(request).then((update) => {
      settled = true;
      return update;
    });

    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const settledBeforeClaims = settled;

    releaseClaims();
    const { response, isAuthenticated } = await updatePromise;
    await getClaims.mock.results[0]?.value;

    expect(settledBeforeClaims).toBe(false);
    expect(isAuthenticated).toBe(false);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
    expect(nextSpy).toHaveBeenCalledTimes(2);
    expect(nextSpy).toHaveBeenNthCalledWith(1, { request });
    expect(nextSpy).toHaveBeenNthCalledWith(2, { request });
    expect(response).toBe(nextSpy.mock.results.at(-1)?.value);
    expect(response).not.toBe(nextSpy.mock.results[0]?.value);

    const forwardedCookieHeader = response.headers.get(
      "x-middleware-request-cookie",
    );

    for (const { name, value, options } of cookiesToSet) {
      expect(request.cookies.get(name)?.value).toBe(value);
      expect(forwardedCookieHeader).toContain(`${name}=${value}`);
      expect(response.cookies.get(name)).toEqual(
        expect.objectContaining({ name, value, ...options }),
      );
    }

    for (const [name, value] of Object.entries(responseHeaders)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });
});
