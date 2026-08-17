import { describe, expect, it } from "vitest";

import { ViewerMovieStateSchema } from "../interactions";

describe("ViewerMovieStateSchema", () => {
  it("accepts a neutral state without a watched timestamp", () => {
    const result = ViewerMovieStateSchema.safeParse({
      reaction: null,
      watchedAt: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a watched timestamp without a reaction", () => {
    const result = ViewerMovieStateSchema.safeParse({
      reaction: null,
      watchedAt: "2026-08-17T16:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
