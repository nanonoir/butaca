import { describe, expect, it } from "vitest";

import { RecommendationFiltersSchema } from "../discover";

describe("RecommendationFiltersSchema", () => {
  it("accepts a valid runtime range", () => {
    const result = RecommendationFiltersSchema.safeParse({
      minRuntime: 90,
      maxRuntime: 150,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a minimum runtime greater than the maximum", () => {
    const result = RecommendationFiltersSchema.safeParse({
      minRuntime: 150,
      maxRuntime: 90,
    });

    expect(result.success).toBe(false);
  });
});
