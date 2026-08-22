import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthenticatedError } from "@/features/auth/errors";

const requireViewer = vi.hoisted(() => vi.fn());
const complete = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/route")>()),
  requireViewer,
}));
vi.mock("@/features/onboarding/onboarding-factory", () => ({
  getOnboardingService: () => ({ complete }),
}));

import { POST } from "./route";

const viewer = {
  id: "00000000-0000-4000-8000-000000000001",
  onboardingCompletedAt: null,
};
const input = { preferredGenreIds: [28, 12], likedMovieIds: [550, 680, 155] };

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    requireViewer.mockReset();
    complete.mockReset();
  });

  it("authorizes the viewer and returns the completion envelope", async () => {
    requireViewer.mockResolvedValue(viewer);
    complete.mockResolvedValue({
      completed: true,
      completedAt: "2026-08-21T18:00:00.000Z",
    });

    const response = await POST(
      new Request("https://butaca.test/api/onboarding", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { completed: true, completedAt: "2026-08-21T18:00:00.000Z" },
    });
    expect(complete).toHaveBeenCalledWith(viewer, input);
  });

  it("maps invalid input and unauthenticated viewers through standard errors", async () => {
    const invalidResponse = await POST(
      new Request("https://butaca.test/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ preferredGenreIds: [28], likedMovieIds: [] }),
      }),
    );
    expect(invalidResponse.status).toBe(400);

    requireViewer.mockRejectedValue(new UnauthenticatedError());
    const unauthorizedResponse = await POST(
      new Request("https://butaca.test/api/onboarding", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    expect(unauthorizedResponse.status).toBe(401);
  });
});
