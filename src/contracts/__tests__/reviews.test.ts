import { describe, expect, it } from "vitest";

import { ReviewAuthorSchema, ReviewSummarySchema } from "../reviews";

describe("ReviewAuthorSchema", () => {
  it("normalizes an empty avatar URL to null", () => {
    const result = ReviewAuthorSchema.safeParse({
      displayName: "A reviewer",
      avatarUrl: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarUrl).toBeNull();
    }
  });
});

describe("ReviewSummarySchema", () => {
  it("accepts matching totals and a recommendation rate", () => {
    const result = ReviewSummarySchema.safeParse({
      recommended: 8,
      notWorthIt: 2,
      total: 10,
      recommendationRate: 80,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a total that does not match the verdict counts", () => {
    const result = ReviewSummarySchema.safeParse({
      recommended: 8,
      notWorthIt: 2,
      total: 9,
      recommendationRate: 80,
    });

    expect(result.success).toBe(false);
  });

  it("requires a null recommendation rate when there are no reviews", () => {
    const result = ReviewSummarySchema.safeParse({
      recommended: 0,
      notWorthIt: 0,
      total: 0,
      recommendationRate: 0,
    });

    expect(result.success).toBe(false);
  });
});
