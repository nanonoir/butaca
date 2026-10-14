import { describe, expect, it } from "vitest";

import {
  ServiceUnavailableError,
  isOperationalDatabaseError,
  withDatabaseAvailability,
} from "../errors";

describe("isOperationalDatabaseError", () => {
  it.each(["ECONNREFUSED", "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "08006", "57P01", "53300"])(
    "treats %s as operational",
    (code) => {
      expect(isOperationalDatabaseError(Object.assign(new Error(), { code }))).toBe(true);
    },
  );

  it("finds the cause wrapped by the ORM", () => {
    const wrapped = new Error("Failed query", {
      cause: Object.assign(new Error(), { code: "ECONNRESET" }),
    });

    expect(isOperationalDatabaseError(wrapped)).toBe(true);
  });

  it.each(["23505", "42P01", "22001"])("keeps data and query error %s as bugs", (code) => {
    expect(isOperationalDatabaseError(Object.assign(new Error(), { code }))).toBe(false);
  });

  it("ignores unrelated values", () => {
    expect(isOperationalDatabaseError(undefined)).toBe(false);
    expect(isOperationalDatabaseError("ECONNREFUSED")).toBe(false);
    expect(isOperationalDatabaseError(new Error("plain"))).toBe(false);
  });
});

describe("withDatabaseAvailability", () => {
  it("turns operational failures into ServiceUnavailableError", async () => {
    const operation = () =>
      Promise.reject(Object.assign(new Error("secret detail"), { code: "ETIMEDOUT" }));

    const thrown = await withDatabaseAvailability(operation).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(ServiceUnavailableError);
    expect(String(thrown)).not.toContain("secret detail");
  });

  it("passes other errors and results through", async () => {
    const failure = new Error("bug");

    await expect(withDatabaseAvailability(() => Promise.reject(failure))).rejects.toBe(failure);
    await expect(withDatabaseAvailability(() => Promise.resolve(1))).resolves.toBe(1);
  });
});
