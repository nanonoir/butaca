import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { createIntegrationDatabase } from "./support/database";

let database: ReturnType<typeof createIntegrationDatabase> | undefined;

beforeAll(() => {
  database = createIntegrationDatabase();
});

afterAll(async () => {
  await database?.close();
});

it("verifies the approved public database schema", async () => {
  if (!database) {
    throw new Error("Integration database connection was not created");
  }

  const [
    publicTableRows,
    enumRows,
    constraintRows,
    indexRows,
    rlsRows,
    grantRows,
  ] = await Promise.all([
    database.db.execute(sql<{ tableName: string }>`
        SELECT tablename AS "tableName" FROM pg_tables
        WHERE schemaname = 'public' ORDER BY tablename
      `),
    database.db.execute(sql<{ enumName: string; enumValue: string }>`
        SELECT type.typname AS "enumName", enum.enumlabel AS "enumValue"
        FROM pg_type AS type
        INNER JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
        INNER JOIN pg_enum AS enum ON enum.enumtypid = type.oid
        WHERE namespace.nspname = 'public'
          AND type.typname IN ('movie_reaction', 'review_verdict')
        ORDER BY type.typname, enum.enumsortorder
      `),
    database.db.execute(
      sql<{
        tableName: string;
        constraintName: string;
        constraintType: string;
        deleteAction: string | null;
        localColumns: string[] | null;
        referencedSchema: string | null;
        referencedTable: string | null;
        referencedColumns: string[] | null;
      }>`
          SELECT
            relation.relname AS "tableName",
            catalogConstraint.conname AS "constraintName",
            catalogConstraint.contype AS "constraintType",
            CASE catalogConstraint.confdeltype WHEN 'c' THEN 'CASCADE' END AS "deleteAction",
            CASE WHEN catalogConstraint.contype = 'f' THEN (
              SELECT array_agg(localAttribute.attname ORDER BY localKey.ordinality)
              FROM unnest(catalogConstraint.conkey) WITH ORDINALITY AS localKey(attnum, ordinality)
              INNER JOIN pg_attribute AS localAttribute
                ON localAttribute.attrelid = catalogConstraint.conrelid
                AND localAttribute.attnum = localKey.attnum
            ) END AS "localColumns",
            referencedNamespace.nspname AS "referencedSchema",
            referencedRelation.relname AS "referencedTable",
            CASE WHEN catalogConstraint.contype = 'f' THEN (
              SELECT array_agg(referencedAttribute.attname ORDER BY referencedKey.ordinality)
              FROM unnest(catalogConstraint.confkey) WITH ORDINALITY AS referencedKey(attnum, ordinality)
              INNER JOIN pg_attribute AS referencedAttribute
                ON referencedAttribute.attrelid = catalogConstraint.confrelid
                AND referencedAttribute.attnum = referencedKey.attnum
            ) END AS "referencedColumns"
          FROM pg_constraint AS catalogConstraint
          INNER JOIN pg_class AS relation ON relation.oid = catalogConstraint.conrelid
          INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          LEFT JOIN pg_class AS referencedRelation
            ON referencedRelation.oid = catalogConstraint.confrelid
          LEFT JOIN pg_namespace AS referencedNamespace
            ON referencedNamespace.oid = referencedRelation.relnamespace
          WHERE namespace.nspname = 'public'
            AND relation.relname IN (
              'movie_cache', 'reviews', 'user_movie_interactions',
              'user_preferences', 'users'
            )
          ORDER BY relation.relname, catalogConstraint.conname
        `,
    ),
    database.db.execute(
      sql<{ tableName: string; indexName: string; isUnique: boolean }>`
          SELECT
            relation.relname AS "tableName",
            indexes.indexname AS "indexName",
            indexMetadata.indisunique AS "isUnique"
          FROM pg_indexes AS indexes
          INNER JOIN pg_namespace AS namespace ON namespace.nspname = indexes.schemaname
          INNER JOIN pg_class AS relation
            ON relation.relname = indexes.tablename
            AND relation.relnamespace = namespace.oid
          INNER JOIN pg_class AS indexRelation
            ON indexRelation.relname = indexes.indexname
            AND indexRelation.relnamespace = namespace.oid
          INNER JOIN pg_index AS indexMetadata
            ON indexMetadata.indrelid = relation.oid
            AND indexMetadata.indexrelid = indexRelation.oid
          WHERE indexes.schemaname = 'public'
            AND relation.relname IN (
              'movie_cache', 'reviews', 'user_movie_interactions',
              'user_preferences', 'users'
            )
            AND indexMetadata.indisunique = false
          ORDER BY relation.relname, indexes.indexname
        `,
    ),
    database.db.execute(sql<{ tableName: string }>`
        SELECT relation.relname AS "tableName"
        FROM pg_class AS relation
        INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind = 'r'
          AND relation.relname IN (
            'movie_cache', 'reviews', 'user_movie_interactions',
            'user_preferences', 'users'
          )
          AND relation.relrowsecurity = false
        ORDER BY relation.relname
      `),
    database.db.execute(
      sql<{ tableName: string; grantee: string; privilegeType: string }>`
          SELECT table_name AS "tableName", grantee, privilege_type AS "privilegeType"
          FROM information_schema.role_table_grants
          WHERE table_schema = 'public'
            AND table_name IN (
              'movie_cache', 'reviews', 'user_movie_interactions',
              'user_preferences', 'users'
            )
            AND grantee IN ('anon', 'authenticated')
          ORDER BY table_name, grantee, privilege_type
        `,
    ),
  ]);

  const publicTables = publicTableRows.map((row) => row.tableName);
  const movieReactionValues = enumRows
    .filter((row) => row.enumName === "movie_reaction")
    .map((row) => row.enumValue);
  const reviewVerdictValues = enumRows
    .filter((row) => row.enumName === "review_verdict")
    .map((row) => row.enumValue);
  const tablesWithoutRls = rlsRows.map((row) => row.tableName);
  const browserRoleGrants = grantRows.map((row) => ({
    tableName: row.tableName,
    grantee: row.grantee,
    privilegeType: row.privilegeType,
  }));
  const normalizedConstraints = constraintRows.map(
    ({ tableName, constraintName, constraintType, deleteAction }) => ({
      tableName,
      constraintName,
      constraintType,
      deleteAction,
    }),
  );
  const authForeignKey = constraintRows.find(
    (row) => row.constraintName === "users_id_auth_users_id_fk",
  );
  const authForeignKeyDeleteAction = authForeignKey?.deleteAction;

  expect(publicTables).toEqual([
    "movie_cache",
    "reviews",
    "user_movie_interactions",
    "user_preferences",
    "users",
  ]);
  expect(movieReactionValues).toEqual(["LIKE", "DISLIKE"]);
  expect(reviewVerdictValues).toEqual(["RECOMMENDED", "NOT_WORTH_IT"]);
  expect(normalizedConstraints).toEqual(
    [
      ["movie_cache", "movie_cache_language_length_check", "c", null],
      ["movie_cache", "movie_cache_movie_id_language_pk", "p", null],
      ["movie_cache", "movie_cache_movie_id_positive_check", "c", null],
      ["reviews", "reviews_description_length_check", "c", null],
      ["reviews", "reviews_movie_id_positive_check", "c", null],
      ["reviews", "reviews_pkey", "p", null],
      ["reviews", "reviews_title_length_check", "c", null],
      ["reviews", "reviews_user_id_movie_id_unique", "u", null],
      ["reviews", "reviews_user_id_users_id_fk", "f", "CASCADE"],
      [
        "user_movie_interactions",
        "user_movie_interactions_meaningful_state_check",
        "c",
        null,
      ],
      [
        "user_movie_interactions",
        "user_movie_interactions_movie_id_positive_check",
        "c",
        null,
      ],
      ["user_movie_interactions", "user_movie_interactions_pkey", "p", null],
      [
        "user_movie_interactions",
        "user_movie_interactions_user_id_movie_id_unique",
        "u",
        null,
      ],
      [
        "user_movie_interactions",
        "user_movie_interactions_user_id_users_id_fk",
        "f",
        "CASCADE",
      ],
      ["user_preferences", "user_preferences_minimum_genres_check", "c", null],
      ["user_preferences", "user_preferences_pkey", "p", null],
      ["user_preferences", "user_preferences_positive_genres_check", "c", null],
      [
        "user_preferences",
        "user_preferences_user_id_users_id_fk",
        "f",
        "CASCADE",
      ],
      ["users", "users_display_name_length_check", "c", null],
      ["users", "users_id_auth_users_id_fk", "f", "CASCADE"],
      ["users", "users_pkey", "p", null],
    ].map(([tableName, constraintName, constraintType, deleteAction]) => ({
      tableName,
      constraintName,
      constraintType,
      deleteAction,
    })),
  );
  expect(indexRows).toEqual([
    {
      tableName: "movie_cache",
      indexName: "movie_cache_fetched_at_idx",
      isUnique: false,
    },
    {
      tableName: "reviews",
      indexName: "reviews_movie_created_at_idx",
      isUnique: false,
    },
    {
      tableName: "reviews",
      indexName: "reviews_movie_verdict_idx",
      isUnique: false,
    },
    {
      tableName: "user_movie_interactions",
      indexName: "user_movie_interactions_user_reaction_updated_at_idx",
      isUnique: false,
    },
    {
      tableName: "user_movie_interactions",
      indexName: "user_movie_interactions_user_updated_at_idx",
      isUnique: false,
    },
  ]);
  expect(tablesWithoutRls).toEqual([]);
  expect(browserRoleGrants).toEqual([]);
  expect(authForeignKey).toMatchObject({
    tableName: "users",
    localColumns: ["id"],
    referencedSchema: "auth",
    referencedTable: "users",
    referencedColumns: ["id"],
    constraintType: "f",
    deleteAction: "CASCADE",
  });
  expect(authForeignKeyDeleteAction).toBe("CASCADE");
});
