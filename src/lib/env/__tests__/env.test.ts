import { describe, expect, it } from "vitest";

import { parseAiEnv } from "../ai";
import { parseMigrationEnv } from "../migration";
import { parseDatabaseUrl, parseServerEnv } from "../server";

const valid = {
  DATABASE_URL: "postgres://butaca_app:runtime-pass@postgres:5432/butaca",
  DATABASE_MIGRATION_URL:
    "postgres://butaca_owner:migration-pass@postgres:5432/butaca",
  TMDB_ACCESS_TOKEN: "tmdb-test-token",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "https://butaca.lat",
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "Butaca <no-reply@butaca.lat>",
  GOOGLE_GENERATIVE_AI_API_KEY: "google-test-key",
};

describe("environment parsers", () => {
  it("returns only validated runtime values", () => {
    expect(parseServerEnv(valid)).toEqual({
      DATABASE_URL: valid.DATABASE_URL,
      TMDB_ACCESS_TOKEN: valid.TMDB_ACCESS_TOKEN,
      BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: valid.BETTER_AUTH_URL,
      RESEND_API_KEY: valid.RESEND_API_KEY,
      RESEND_FROM_EMAIL: valid.RESEND_FROM_EMAIL,
    });
  });

  it("does not require or expose Supabase configuration", () => {
    const parsed = parseServerEnv({
      ...valid,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    });

    expect(parsed).not.toHaveProperty("NEXT_PUBLIC_SUPABASE_URL");
  });

  it.each([
    "DATABASE_URL",
    "TMDB_ACCESS_TOKEN",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
  ] as const)("reports a missing %s without leaking another value", (key) => {
    const missing: Partial<typeof valid> = { ...valid };
    delete missing[key];

    expect(() => parseServerEnv(missing)).toThrow(key);
    expect(() => parseServerEnv(missing)).not.toThrow("tmdb-test-token");
    expect(() => parseServerEnv(missing)).not.toThrow("re_test_key");
  });

  it("rejects a short auth secret without echoing it", () => {
    const attempt = () =>
      parseServerEnv({ ...valid, BETTER_AUTH_SECRET: "too-short" });

    expect(attempt).toThrow("BETTER_AUTH_SECRET");
    expect(attempt).not.toThrow("too-short");
  });

  it("rejects an invalid auth URL", () => {
    expect(() =>
      parseServerEnv({ ...valid, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow("BETTER_AUTH_URL");
  });

  it("validates the database URL without mail, TMDB or auth configuration", () => {
    expect(parseDatabaseUrl({ DATABASE_URL: valid.DATABASE_URL })).toBe(
      valid.DATABASE_URL,
    );
    expect(() => parseDatabaseUrl({})).toThrow("DATABASE_URL");
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
