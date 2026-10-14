import { describe, expect, it } from "vitest";

import { parseAuthRuntimeConfig } from "../config";

const valid = {
  BETTER_AUTH_SECRET: "s".repeat(32),
  BETTER_AUTH_URL: "https://butaca.lat/",
};

describe("parseAuthRuntimeConfig", () => {
  it("normalizes the base URL to its origin and treats blank mail settings as absent", () => {
    const config = parseAuthRuntimeConfig({ ...valid, RESEND_API_KEY: " ", RESEND_FROM_EMAIL: "" });

    expect(config.baseURL).toBe("https://butaca.lat");
    expect(config.resend).toEqual({ apiKey: undefined, from: undefined });
  });

  it("names invalid keys without echoing their values", () => {
    const attempt = () =>
      parseAuthRuntimeConfig({ BETTER_AUTH_SECRET: "short-secret-value", BETTER_AUTH_URL: "nope" });

    expect(attempt).toThrow("Invalid auth environment: BETTER_AUTH_SECRET, BETTER_AUTH_URL");
    expect(attempt).not.toThrow("short-secret-value");
  });
});
