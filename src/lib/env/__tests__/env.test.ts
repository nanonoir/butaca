import { describe, expect, it } from "vitest";

import { parseMigrationEnv } from "../migration";
import { parseServerEnv } from "../server";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://runtime.example/db",
  DATABASE_MIGRATION_URL: "postgresql://migration.example/db",
  TMDB_ACCESS_TOKEN: "tmdb-test-token",
};

describe("environment parsers", () => {
  it("returns only validated runtime values", () => {
    expect(parseServerEnv(valid)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      DATABASE_URL: valid.DATABASE_URL,
      TMDB_ACCESS_TOKEN: valid.TMDB_ACCESS_TOKEN,
    });
  });

  it("reports a missing key without including another secret value", () => {
    const missingToken: Partial<typeof valid> = { ...valid };
    delete missingToken.TMDB_ACCESS_TOKEN;

    expect(() => parseServerEnv(missingToken)).toThrow("TMDB_ACCESS_TOKEN");
    expect(() => parseServerEnv(missingToken)).not.toThrow(
      "sb_publishable_test",
    );
  });

  it("rejects an invalid Supabase URL", () => {
    expect(() =>
      parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("parses only the migration URL for Drizzle Kit", () => {
    expect(parseMigrationEnv(valid)).toEqual({
      DATABASE_MIGRATION_URL: valid.DATABASE_MIGRATION_URL,
    });
  });
});
