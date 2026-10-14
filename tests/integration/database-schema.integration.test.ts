import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createIntegrationDatabase } from "./support/database";
import {
  createTestAuthUser,
  deleteTestAuthUser,
} from "./support/identity";
import {
  assertIsolatedDatabaseUrl,
  assertLocalOrigin,
  parseIntegrationEnv,
} from "./support/env";

const EXPECTED_TABLES = [
  "auth_account",
  "auth_session",
  "auth_user",
  "auth_verification",
  "movie_cache",
  "reviews",
  "user_movie_interactions",
  "user_preferences",
  "users",
];

const tableList = sql.join(
  EXPECTED_TABLES.map((table) => sql`${table}`),
  sql`, `,
);

const byCodeUnit = <T extends Record<string, unknown>>(
  rows: T[],
  ...keys: (keyof T)[]
) =>
  [...rows].sort((left, right) => {
    const a = keys.map((key) => String(left[key])).join("\u0000");
    const b = keys.map((key) => String(right[key])).join("\u0000");

    return a < b ? -1 : a > b ? 1 : 0;
  });

let database: ReturnType<typeof createIntegrationDatabase> | undefined;

beforeAll(() => {
  database = createIntegrationDatabase();
});

afterAll(async () => {
  await database?.close();
});

function getDatabase() {
  if (!database) {
    throw new Error("Integration database connection was not created");
  }

  return database.db;
}

describe("isolation guard", () => {
  const valid = {
    BUTACA_TEST_DATABASE: "1",
    DATABASE_URL: "postgres://user:secret@127.0.0.1:5432/butaca_migration_test",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3100",
  };

  it("accepts an explicit local butaca test database", () => {
    expect(() => parseIntegrationEnv(valid)).not.toThrow();
  });

  it("requires the explicit opt-in flag", () => {
    expect(() =>
      parseIntegrationEnv({ ...valid, BUTACA_TEST_DATABASE: undefined }),
    ).toThrow("BUTACA_TEST_DATABASE");
    expect(() =>
      parseIntegrationEnv({ ...valid, BUTACA_TEST_DATABASE: "0" }),
    ).toThrow("BUTACA_TEST_DATABASE");
  });

  it.each([
    "postgres://u:p@db.example.com:5432/butaca_test",
    "postgres://u:p@10.0.0.5:5432/butaca_test",
    "postgres://u:p@127.0.0.1:5432/butaca",
    "postgres://u:p@127.0.0.1:5432/postgres",
    "postgres://u:p@127.0.0.1:5432/other_test",
    "postgres://u:p@127.0.0.1:5432/",
    "https://127.0.0.1/butaca_test",
  ])("rejects a non-isolated database target", (url) => {
    expect(() => assertIsolatedDatabaseUrl(url)).toThrow();
  });

  it("only widens the host list through the explicit allowlist", () => {
    const url = "postgres://u:p@butaca-pg:5432/butaca_ci_test";

    expect(() => assertIsolatedDatabaseUrl(url)).toThrow();
    expect(() => assertIsolatedDatabaseUrl(url, "butaca-pg")).not.toThrow();
  });

  it("checks the migration URL and the auth origin too", () => {
    expect(() =>
      parseIntegrationEnv({
        ...valid,
        DATABASE_MIGRATION_URL: "postgres://u:p@db.example.com:5432/butaca_test",
      }),
    ).toThrow();
    expect(() => assertLocalOrigin("https://butaca.lat", "origin")).toThrow();
  });

  it("never echoes the URL or credentials in the error", () => {
    let message = "";

    try {
      assertIsolatedDatabaseUrl("postgres://user:hunter2@db.example.com/x");
    } catch (error) {
      message = String(error);
    }

    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("db.example.com");
  });
});

describe("approved public schema", () => {
  it("contains exactly the identity and product tables", async () => {
    const rows = await getDatabase().execute(sql<{ tableName: string }>`
      SELECT tablename AS "tableName" FROM pg_tables
      WHERE schemaname = 'public'
    `);

    expect(rows.map((row) => row.tableName).sort()).toEqual(EXPECTED_TABLES);
  });

  it("has no dependency on a Supabase-style auth schema", async () => {
    const [schemas, foreignSchemas] = await Promise.all([
      getDatabase().execute(sql<{ name: string }>`
        SELECT nspname AS name FROM pg_namespace WHERE nspname = 'auth'
      `),
      getDatabase().execute(sql<{ constraintName: string }>`
        SELECT catalogConstraint.conname AS "constraintName"
        FROM pg_constraint AS catalogConstraint
        INNER JOIN pg_class AS referenced ON referenced.oid = catalogConstraint.confrelid
        INNER JOIN pg_namespace AS referencedNamespace
          ON referencedNamespace.oid = referenced.relnamespace
        WHERE catalogConstraint.contype = 'f'
          AND referencedNamespace.nspname <> 'public'
      `),
    ]);

    expect(schemas).toHaveLength(0);
    expect(foreignSchemas).toHaveLength(0);
  });

  it("keeps the reaction and verdict enums", async () => {
    const enumRows = await getDatabase().execute(
      sql<{ enumName: string; enumValue: string }>`
        SELECT type.typname AS "enumName", enum.enumlabel AS "enumValue"
        FROM pg_type AS type
        INNER JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
        INNER JOIN pg_enum AS enum ON enum.enumtypid = type.oid
        WHERE namespace.nspname = 'public'
          AND type.typname IN ('movie_reaction', 'review_verdict')
        ORDER BY type.typname, enum.enumsortorder
      `,
    );

    expect(
      enumRows.filter((row) => row.enumName === "movie_reaction").map((row) => row.enumValue),
    ).toEqual(["LIKE", "DISLIKE"]);
    expect(
      enumRows.filter((row) => row.enumName === "review_verdict").map((row) => row.enumValue),
    ).toEqual(["RECOMMENDED", "NOT_WORTH_IT"]);
  });

  it("uses UUID identifiers for identity and profile rows", async () => {
    const rows = await getDatabase().execute(
      sql<{ tableName: string; columnName: string; dataType: string }>`
        SELECT table_name AS "tableName", column_name AS "columnName",
               data_type AS "dataType"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('auth_user', 'auth_session', 'auth_account', 'users')
          AND column_name IN ('id', 'user_id')
      `,
    );

    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.every((row) => row.dataType === "uuid")).toBe(true);
  });

  it("declares the expected constraints and cascading foreign keys", async () => {
    const constraintRows = await getDatabase().execute(
      sql<{
        tableName: string;
        constraintName: string;
        constraintType: string;
        deleteAction: string | null;
        referencedSchema: string | null;
        referencedTable: string | null;
      }>`
        SELECT
          relation.relname AS "tableName",
          catalogConstraint.conname AS "constraintName",
          catalogConstraint.contype AS "constraintType",
          CASE catalogConstraint.confdeltype WHEN 'c' THEN 'CASCADE' END AS "deleteAction",
          referencedNamespace.nspname AS "referencedSchema",
          referencedRelation.relname AS "referencedTable"
        FROM pg_constraint AS catalogConstraint
        INNER JOIN pg_class AS relation ON relation.oid = catalogConstraint.conrelid
        INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        LEFT JOIN pg_class AS referencedRelation
          ON referencedRelation.oid = catalogConstraint.confrelid
        LEFT JOIN pg_namespace AS referencedNamespace
          ON referencedNamespace.oid = referencedRelation.relnamespace
        WHERE namespace.nspname = 'public'
          AND catalogConstraint.contype IN ('p', 'u', 'f', 'c')
          AND relation.relname IN (${tableList})
      `,
    );

    const actual = byCodeUnit(
      constraintRows.map(
        ({ tableName, constraintName, constraintType, deleteAction }) => ({
          tableName,
          constraintName,
          constraintType,
          deleteAction,
        }),
      ),
      "tableName",
      "constraintName",
    );
    const expected = byCodeUnit(
      [
        ["auth_account", "auth_account_pkey", "p", null],
        ["auth_account", "auth_account_user_id_auth_user_id_fk", "f", "CASCADE"],
        ["auth_session", "auth_session_pkey", "p", null],
        ["auth_session", "auth_session_token_unique", "u", null],
        ["auth_session", "auth_session_user_id_auth_user_id_fk", "f", "CASCADE"],
        ["auth_user", "auth_user_email_unique", "u", null],
        ["auth_user", "auth_user_pkey", "p", null],
        ["auth_verification", "auth_verification_pkey", "p", null],
        ["movie_cache", "movie_cache_language_length_check", "c", null],
        ["movie_cache", "movie_cache_movie_id_language_pk", "p", null],
        ["movie_cache", "movie_cache_movie_id_positive_check", "c", null],
        ["reviews", "reviews_description_length_check", "c", null],
        ["reviews", "reviews_movie_id_positive_check", "c", null],
        ["reviews", "reviews_pkey", "p", null],
        ["reviews", "reviews_title_length_check", "c", null],
        ["reviews", "reviews_user_id_movie_id_unique", "u", null],
        ["reviews", "reviews_user_id_users_id_fk", "f", "CASCADE"],
        ["user_movie_interactions", "user_movie_interactions_meaningful_state_check", "c", null],
        ["user_movie_interactions", "user_movie_interactions_movie_id_positive_check", "c", null],
        ["user_movie_interactions", "user_movie_interactions_pkey", "p", null],
        ["user_movie_interactions", "user_movie_interactions_user_id_movie_id_unique", "u", null],
        ["user_movie_interactions", "user_movie_interactions_user_id_users_id_fk", "f", "CASCADE"],
        ["user_preferences", "user_preferences_minimum_genres_check", "c", null],
        ["user_preferences", "user_preferences_pkey", "p", null],
        ["user_preferences", "user_preferences_positive_genres_check", "c", null],
        ["user_preferences", "user_preferences_user_id_users_id_fk", "f", "CASCADE"],
        ["users", "users_display_name_length_check", "c", null],
        ["users", "users_id_auth_user_id_fk", "f", "CASCADE"],
        ["users", "users_pkey", "p", null],
      ].map(([tableName, constraintName, constraintType, deleteAction]) => ({
        tableName,
        constraintName,
        constraintType,
        deleteAction,
      })),
      "tableName",
      "constraintName",
    );

    expect(actual).toEqual(expected);

    const profileForeignKey = constraintRows.find(
      (row) => row.constraintName === "users_id_auth_user_id_fk",
    );

    expect(profileForeignKey).toMatchObject({
      referencedSchema: "public",
      referencedTable: "auth_user",
      deleteAction: "CASCADE",
    });
  });

  it("declares the expected secondary indexes", async () => {
    const indexRows = await getDatabase().execute(
      sql<{ tableName: string; indexName: string }>`
        SELECT indexes.tablename AS "tableName", indexes.indexname AS "indexName"
        FROM pg_indexes AS indexes
        INNER JOIN pg_class AS indexRelation ON indexRelation.relname = indexes.indexname
        INNER JOIN pg_namespace AS namespace
          ON namespace.oid = indexRelation.relnamespace AND namespace.nspname = indexes.schemaname
        INNER JOIN pg_index AS indexMetadata ON indexMetadata.indexrelid = indexRelation.oid
        WHERE indexes.schemaname = 'public'
          AND indexes.tablename IN (${tableList})
          AND indexMetadata.indisunique = false
      `,
    );

    expect(
      byCodeUnit(
        indexRows.map(({ tableName, indexName }) => ({ tableName, indexName })),
        "tableName",
        "indexName",
      ),
    ).toEqual([
      { tableName: "auth_account", indexName: "auth_account_user_id_idx" },
      { tableName: "auth_session", indexName: "auth_session_user_id_idx" },
      {
        tableName: "auth_verification",
        indexName: "auth_verification_identifier_idx",
      },
      { tableName: "movie_cache", indexName: "movie_cache_fetched_at_idx" },
      { tableName: "reviews", indexName: "reviews_movie_created_at_idx" },
      { tableName: "reviews", indexName: "reviews_movie_verdict_idx" },
      {
        tableName: "user_movie_interactions",
        indexName: "user_movie_interactions_user_reaction_updated_at_idx",
      },
      {
        tableName: "user_movie_interactions",
        indexName: "user_movie_interactions_user_updated_at_idx",
      },
    ]);
  });

  it("installs the initial-profile trigger with a pinned search_path", async () => {
    const [triggers, functions] = await Promise.all([
      getDatabase().execute(
        sql<{ name: string; enabled: string; definition: string }>`
          SELECT trigger.tgname AS name, trigger.tgenabled AS enabled,
                 pg_get_triggerdef(trigger.oid) AS definition
          FROM pg_trigger AS trigger
          WHERE trigger.tgrelid = 'public.auth_user'::regclass
            AND NOT trigger.tgisinternal
        `,
      ),
      getDatabase().execute(
        sql<{ config: string[] | null }>`
          SELECT proc.proconfig AS config
          FROM pg_proc AS proc
          INNER JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
          WHERE namespace.nspname = 'public'
            AND proc.proname = 'create_profile_for_auth_user'
        `,
      ),
    ]);

    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      name: "auth_user_create_profile",
      enabled: "O",
    });
    expect(triggers[0]?.definition).toContain("AFTER INSERT");
    expect(triggers[0]?.definition).toContain("FOR EACH ROW");
    expect(functions).toHaveLength(1);
    expect(String(functions[0]?.config)).toContain("search_path");
  });
});

describe("identity and profile integrity", () => {
  it("creates the profile with the identity UUID in the same statement", async () => {
    const identity = await createTestAuthUser(getDatabase(), {
      displayName: "Trigger profile",
    });

    try {
      const [profile] = await getDatabase().execute(
        sql<{ id: string; displayName: string; avatarUrl: string | null }>`
          SELECT id, display_name AS "displayName", avatar_url AS "avatarUrl"
          FROM users WHERE id = ${identity.id}
        `,
      );

      expect(profile).toMatchObject({
        id: identity.id,
        displayName: "Trigger profile",
        avatarUrl: null,
      });
    } finally {
      await deleteTestAuthUser(getDatabase(), identity.id);
    }
  });

  it("falls back to the email local part, then a fixed name, for blank names", async () => {
    const blank = await createTestAuthUser(getDatabase(), {
      displayName: "   ",
    });
    const empty = await createTestAuthUser(getDatabase(), { displayName: "" });

    try {
      const rows = await getDatabase().execute(
        sql<{ id: string; displayName: string }>`
          SELECT id, display_name AS "displayName" FROM users
          WHERE id IN (${blank.id}, ${empty.id})
        `,
      );
      const nameOf = (id: string) =>
        rows.find((row) => row.id === id)?.displayName;

      expect(nameOf(blank.id)).toBe(blank.email.split("@")[0]);
      expect(nameOf(empty.id)).toBe(empty.email.split("@")[0]);
    } finally {
      await deleteTestAuthUser(getDatabase(), blank.id);
      await deleteTestAuthUser(getDatabase(), empty.id);
    }
  });

  it("truncates a long name to the profile limit instead of failing the identity insert", async () => {
    const identity = await createTestAuthUser(getDatabase(), {
      displayName: "n".repeat(200),
    });

    try {
      const [profile] = await getDatabase().execute(
        sql<{ length: number }>`
          SELECT char_length(display_name) AS length FROM users
          WHERE id = ${identity.id}
        `,
      );

      expect(profile?.length).toBe(80);
    } finally {
      await deleteTestAuthUser(getDatabase(), identity.id);
    }
  });

  it("rejects a profile without an identity (foreign key)", async () => {
    const orphanId = crypto.randomUUID();

    await expect(
      getDatabase().execute(
        sql`INSERT INTO users (id, display_name) VALUES (${orphanId}, 'Orphan')`,
      ),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
  });

  it("removes profile, sessions and accounts when the identity is deleted", async () => {
    const identity = await createTestAuthUser(getDatabase(), {
      displayName: "Cascade identity",
    });
    const token = crypto.randomUUID();

    await getDatabase().execute(sql`
      INSERT INTO auth_session (expires_at, token, user_id)
      VALUES (now() + interval '1 hour', ${token}, ${identity.id})
    `);
    await getDatabase().execute(sql`
      INSERT INTO auth_account (account_id, provider_id, user_id)
      VALUES (${identity.id}, 'credential', ${identity.id})
    `);

    await deleteTestAuthUser(getDatabase(), identity.id);

    const [counts] = await getDatabase().execute(
      sql<{ users: number; sessions: number; accounts: number }>`
        SELECT
          (SELECT count(*)::int FROM users WHERE id = ${identity.id}) AS users,
          (SELECT count(*)::int FROM auth_session WHERE user_id = ${identity.id}) AS sessions,
          (SELECT count(*)::int FROM auth_account WHERE user_id = ${identity.id}) AS accounts
      `,
    );

    expect(counts).toEqual({ users: 0, sessions: 0, accounts: 0 });
  });

  it("enforces unique emails on the identity", async () => {
    const identity = await createTestAuthUser(getDatabase());

    try {
      await expect(
        getDatabase().execute(
          sql`INSERT INTO auth_user (name, email) VALUES ('Duplicate', ${identity.email})`,
        ),
      ).rejects.toMatchObject({ cause: { code: "23505" } });
    } finally {
      await deleteTestAuthUser(getDatabase(), identity.id);
    }
  });
});
