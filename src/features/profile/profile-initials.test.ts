import { describe, expect, it } from "vitest";

import { getProfileInitials } from "./profile-initials";

describe("getProfileInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getProfileInitials("Sofía Ramírez")).toBe("SR");
  });

  it("ignores the words beyond the second", () => {
    expect(getProfileInitials("Ana María López Pérez")).toBe("AM");
  });

  it("uses a single initial for a one word name", () => {
    expect(getProfileInitials("viewer")).toBe("V");
  });

  it("collapses irregular whitespace", () => {
    expect(getProfileInitials("  sofia   ramirez  ")).toBe("SR");
  });

  it("falls back when the display name has no usable letters", () => {
    expect(getProfileInitials("   ")).toBe("?");
  });
});
