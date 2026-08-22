import { describe, expect, it } from "vitest";

import { parseAiEnv } from "../ai";
import { parseMigrationEnv } from "../migration";
import { parseServerEnv } from "../server";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://runtime.example/db",
  DATABASE_MIGRATION_URL: "postgresql://migration.example/db",
  TMDB_ACCESS_TOKEN: "tmdb-test-token",
  GOOGLE_GENERATIVE_AI_API_KEY: "google-test-key",
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

describe("AI environment parser", () => {
  it("returns only the assistant credential", () => {
    expect(parseAiEnv(valid)).toEqual({
      GOOGLE_GENERATIVE_AI_API_KEY: valid.GOOGLE_GENERATIVE_AI_API_KEY,
    });
  });

  it("reports the missing key without including another secret value", () => {
    const missingKey: Partial<typeof valid> = { ...valid };
    delete missingKey.GOOGLE_GENERATIVE_AI_API_KEY;

    expect(() => parseAiEnv(missingKey)).toThrow(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    );
    expect(() => parseAiEnv(missingKey)).not.toThrow("tmdb-test-token");
  });

  it("stays out of the server environment so the app runs without it", () => {
    const withoutAiKey: Partial<typeof valid> = { ...valid };
    delete withoutAiKey.GOOGLE_GENERATIVE_AI_API_KEY;

    expect(parseServerEnv(withoutAiKey)).not.toHaveProperty(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    );
  });
});
