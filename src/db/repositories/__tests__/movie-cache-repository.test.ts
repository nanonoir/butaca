import { describe, expect, it } from "vitest";

import { MovieCacheRepository, isMovieCacheExpired } from "../index";

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

  it("uses the default TTL through the repository", () => {
    const repository = new MovieCacheRepository(
      {} as ConstructorParameters<typeof MovieCacheRepository>[0],
    );
    const entry = { fetchedAt: new Date("2026-08-18T10:00:00.000Z") };

    expect(
      repository.isExpired(
        entry,
        undefined,
        new Date("2026-08-19T09:59:59.999Z"),
      ),
    ).toBe(false);
    expect(
      repository.isExpired(
        entry,
        undefined,
        new Date("2026-08-19T10:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
