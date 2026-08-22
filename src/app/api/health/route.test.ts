import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("answers ok without reaching for anything outside the process", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "ok" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  /** The route guard skips everything under /api, so a container probe reaches
   * this without a session. That is the whole point of it. */
  it("is not a guarded route", async () => {
    const { resolveRouteGuard } = await import(
      "@/features/auth/route-guard"
    );

    expect(resolveRouteGuard("/api/health", false)).toEqual({
      type: "continue",
    });
  });
});
