import { describe, expect, it } from "vitest";

import { isMovieCacheExpired } from "../index";

describe("movie cache repository", () => {
  it("expires entries at the TTL boundary", () => {
    const entry = { fetchedAt: new Date("2026-08-18T10:00:00.000Z") };
    const now = new Date("2026-08-19T09:59:59.999Z");

    expect(isMovieCacheExpired(entry, 86_400_000, now)).toBe(false);
    expect(
      isMovieCacheExpired(
        entry,
        86_400_000,
        new Date("2026-08-19T10:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
