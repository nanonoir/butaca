import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({ getDatabase: () => ({ execute }) }));
vi.mock("@/features/auth/server-auth-factory", () => ({
  getServerAuthService: vi.fn(),
}));

const { GET } = await import("./route");

describe("GET /api/ready", () => {
  beforeEach(() => {
    execute.mockReset();
    vi.useRealTimers();
  });

  it("answers ready when the database responds", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "ready" },
    });
  });

  it("answers SERVICE_UNAVAILABLE without echoing the failure", async () => {
    execute.mockRejectedValue(new Error("postgres://user:secret@host/db"));

    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(body).toContain("SERVICE_UNAVAILABLE");
    expect(body).not.toContain("secret");
  });

  it("gives up on a database that never answers", async () => {
    vi.useFakeTimers();
    execute.mockReturnValue(new Promise(() => undefined));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(3_000);

    expect((await pending).status).toBe(503);
  });
});
