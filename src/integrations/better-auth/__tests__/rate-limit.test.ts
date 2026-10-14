import { describe, expect, it } from "vitest";

import { clientAddress, createRateLimiter } from "../rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit and then blocks until the window resets", () => {
    let now = 1_000;
    const limiter = createRateLimiter(() => now);
    const rule = { limit: 2, windowMs: 1_000 };

    expect(limiter.consume("k", rule)).toBe(true);
    expect(limiter.consume("k", rule)).toBe(true);
    expect(limiter.consume("k", rule)).toBe(false);
    expect(limiter.consume("other", rule)).toBe(true);

    now += 1_000;
    expect(limiter.consume("k", rule)).toBe(true);
  });

  it("rejects new keys once 10k live windows are tracked, then recovers after expiry", () => {
    let now = 1_000;
    const limiter = createRateLimiter(() => now);
    const rule = { limit: 2, windowMs: 1_000 };

    for (let i = 0; i < 10_000; i += 1) {
      expect(limiter.consume(`key-${i}`, rule)).toBe(true);
    }

    expect(limiter.consume("key-new", rule)).toBe(false);
    expect(limiter.consume("key-0", rule)).toBe(true);
    expect(limiter.consume("key-0", rule)).toBe(false);

    now += 1_000;
    expect(limiter.consume("key-new", rule)).toBe(true);
  });
});

describe("clientAddress", () => {
  it("prefers the first forwarded address, then x-real-ip", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientAddress(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
