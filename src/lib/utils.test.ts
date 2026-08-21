import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("lets later Tailwind classes override conflicting defaults", () => {
    expect(cn("flex flex-col gap-5", "gap-8")).toBe("flex flex-col gap-8");
  });
});
