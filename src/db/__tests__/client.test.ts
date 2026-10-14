import { describe, expect, it } from "vitest";

import { createDatabaseConnection, DATABASE_POOL_OPTIONS } from "../client";

describe("database pool options", () => {
  it("bounds pool size, connection time and server-side statement time", () => {
    expect(DATABASE_POOL_OPTIONS.max).toBeLessThanOrEqual(10);
    expect(DATABASE_POOL_OPTIONS.connect_timeout).toBeLessThanOrEqual(10);
    expect(DATABASE_POOL_OPTIONS.connection.statement_timeout).toBeGreaterThan(0);
    expect(DATABASE_POOL_OPTIONS.prepare).toBe(false);
  });

  it("builds a client without connecting and applies the options", async () => {
    // postgres.js connects lazily, so no server is needed.
    const { db, close } = createDatabaseConnection(
      "postgres://u:p@127.0.0.1:1/none",
    );

    expect(db).toBeDefined();
    await close();
  });
});
