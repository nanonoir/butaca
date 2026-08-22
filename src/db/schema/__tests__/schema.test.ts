import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  normalizeRelation,
} from "drizzle-orm";
import {
  getTableConfig,
  PgDialect,
  type AnyPgTable,
} from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "..";

const {
  movieCache,
  movieReactionEnum,
  reviewVerdictEnum,
  reviews,
  reviewsRelations,
  userMovieInteractions,
  userMovieInteractionsRelations,
  userPreferences,
  userPreferencesRelations,
  users,
  usersRelations,
} = schema;

const pgDialect = new PgDialect();

const getColumnNames = (table: AnyPgTable) =>
  getTableConfig(table).columns.map((column) => column.name);

const getPrimaryKeyColumns = (table: AnyPgTable) => {
  const config = getTableConfig(table);

  return [
    ...config.columns
      .filter((column) => column.primary)
      .map((column) => [column.name]),
    ...config.primaryKeys.map((primaryKey) =>
      primaryKey.columns.map((column) => column.name),
    ),
  ];
};

const getUniqueConstraintColumns = (table: AnyPgTable) =>
  getTableConfig(table).uniqueConstraints.map((constraint) =>
    constraint.columns.map((column) => column.name),
  );

const getCheckSummary = (table: AnyPgTable) =>
  getTableConfig(table).checks.map((constraint) => ({
    name: constraint.name,
    sql: pgDialect.sqlToQuery(constraint.value).sql,
  }));

const getIndexSummary = (table: AnyPgTable) =>
  getTableConfig(table).indexes.map((tableIndex) => ({
    name: tableIndex.config.name,
    unique: tableIndex.config.unique,
    columns: tableIndex.config.columns.map((column) =>
      "name" in column ? column.name : undefined,
    ),
    order: tableIndex.config.columns.map((column) =>
      "indexConfig" in column ? column.indexConfig?.order : undefined,
    ),
  }));

const getForeignKeySummary = (table: AnyPgTable) =>
  getTableConfig(table).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();

    return {
      columns: reference.columns.map((column) => column.name),
      foreignTable: getTableConfig(reference.foreignTable).name,
      foreignColumns: reference.foreignColumns.map((column) => column.name),
      onDelete: foreignKey.onDelete,
    };
  });

describe("foundation database schema", () => {
  it("exports only the approved runtime schema surface", () => {
    expect(Object.keys(schema).sort()).toEqual([
      "movieCache",
      "movieReactionEnum",
      "reviewVerdictEnum",
      "reviews",
      "reviewsRelations",
      "userMovieInteractions",
      "userMovieInteractionsRelations",
      "userPreferences",
      "userPreferencesRelations",
      "users",
      "usersRelations",
    ]);
  });

  it("uses the five approved public table names", () => {
    expect(
      [users, userPreferences, userMovieInteractions, reviews, movieCache].map(
        (table) => getTableConfig(table).name,
      ),
    ).toEqual([
      "users",
      "user_preferences",
      "user_movie_interactions",
      "reviews",
      "movie_cache",
    ]);
  });

  it("uses only the approved enum values", () => {
    expect(movieReactionEnum.enumValues).toEqual(["LIKE", "DISLIKE"]);
    expect(reviewVerdictEnum.enumValues).toEqual([
      "RECOMMENDED",
      "NOT_WORTH_IT",
    ]);
  });

  it("declares the exact columns and primary keys", () => {
    expect({
      users: getColumnNames(users),
      userPreferences: getColumnNames(userPreferences),
      userMovieInteractions: getColumnNames(userMovieInteractions),
      reviews: getColumnNames(reviews),
      movieCache: getColumnNames(movieCache),
    }).toEqual({
      users: [
        "id",
        "display_name",
        "avatar_url",
        "onboarding_completed_at",
        "created_at",
        "updated_at",
      ],
      userPreferences: [
        "user_id",
        "preferred_genre_ids",
        "created_at",
        "updated_at",
      ],
      userMovieInteractions: [
        "id",
        "user_id",
        "movie_id",
        "reaction",
        "watched_at",
        "created_at",
        "updated_at",
      ],
      reviews: [
        "id",
        "user_id",
        "movie_id",
        "verdict",
        "title",
        "description",
        "created_at",
        "updated_at",
      ],
      movieCache: ["movie_id", "language", "payload", "fetched_at"],
    });

    expect([
      getPrimaryKeyColumns(users),
      getPrimaryKeyColumns(userPreferences),
      getPrimaryKeyColumns(userMovieInteractions),
      getPrimaryKeyColumns(reviews),
      getPrimaryKeyColumns(movieCache),
    ]).toEqual([
      [["id"]],
      [["user_id"]],
      [["id"]],
      [["id"]],
      [["movie_id", "language"]],
    ]);
  });

  it("declares only the required unique constraints", () => {
    expect({
      users: getUniqueConstraintColumns(users),
      userPreferences: getUniqueConstraintColumns(userPreferences),
      userMovieInteractions: getUniqueConstraintColumns(userMovieInteractions),
      reviews: getUniqueConstraintColumns(reviews),
      movieCache: getUniqueConstraintColumns(movieCache),
    }).toEqual({
      users: [],
      userPreferences: [],
      userMovieInteractions: [["user_id", "movie_id"]],
      reviews: [["user_id", "movie_id"]],
      movieCache: [],
    });
  });

  it("declares the exact ordered SQL for every required check", () => {
    expect({
      users: getCheckSummary(users),
      userPreferences: getCheckSummary(userPreferences),
      userMovieInteractions: getCheckSummary(userMovieInteractions),
      reviews: getCheckSummary(reviews),
      movieCache: getCheckSummary(movieCache),
    }).toEqual({
      users: [
        {
          name: "users_display_name_length_check",
          sql: 'char_length(btrim("users"."display_name")) between 1 and 80',
        },
      ],
      userPreferences: [
        {
          name: "user_preferences_minimum_genres_check",
          sql: 'cardinality("user_preferences"."preferred_genre_ids") >= 2',
        },
        {
          name: "user_preferences_positive_genres_check",
          sql: 'coalesce(0 < ALL("user_preferences"."preferred_genre_ids"), false)',
        },
      ],
      userMovieInteractions: [
        {
          name: "user_movie_interactions_movie_id_positive_check",
          sql: '"user_movie_interactions"."movie_id" > 0',
        },
        {
          name: "user_movie_interactions_meaningful_state_check",
          sql: '"user_movie_interactions"."reaction" is not null or "user_movie_interactions"."watched_at" is not null',
        },
      ],
      reviews: [
        {
          name: "reviews_movie_id_positive_check",
          sql: '"reviews"."movie_id" > 0',
        },
        {
          name: "reviews_title_length_check",
          sql: 'char_length(btrim("reviews"."title")) between 3 and 30',
        },
        {
          name: "reviews_description_length_check",
          sql: 'char_length(btrim("reviews"."description")) between 10 and 400',
        },
      ],
      movieCache: [
        {
          name: "movie_cache_movie_id_positive_check",
          sql: '"movie_cache"."movie_id" > 0',
        },
        {
          name: "movie_cache_language_length_check",
          sql: 'char_length(btrim("movie_cache"."language")) between 2 and 10',
        },
      ],
    });
  });

  it("declares only the required non-unique indexes and sort order", () => {
    expect({
      users: getIndexSummary(users),
      userPreferences: getIndexSummary(userPreferences),
      userMovieInteractions: getIndexSummary(userMovieInteractions),
      reviews: getIndexSummary(reviews),
      movieCache: getIndexSummary(movieCache),
    }).toEqual({
      users: [],
      userPreferences: [],
      userMovieInteractions: [
        {
          name: "user_movie_interactions_user_updated_at_idx",
          unique: false,
          columns: ["user_id", "updated_at"],
          order: ["asc", "desc"],
        },
        {
          name: "user_movie_interactions_user_reaction_updated_at_idx",
          unique: false,
          columns: ["user_id", "reaction", "updated_at"],
          order: ["asc", "asc", "desc"],
        },
      ],
      reviews: [
        {
          name: "reviews_movie_created_at_idx",
          unique: false,
          columns: ["movie_id", "created_at"],
          order: ["asc", "desc"],
        },
        {
          name: "reviews_movie_verdict_idx",
          unique: false,
          columns: ["movie_id", "verdict"],
          order: ["asc", "asc"],
        },
      ],
      movieCache: [
        {
          name: "movie_cache_fetched_at_idx",
          unique: false,
          columns: ["fetched_at"],
          order: ["asc"],
        },
      ],
    });
  });

  it("cascades every public user foreign key and adds no others", () => {
    expect({
      users: getForeignKeySummary(users),
      userPreferences: getForeignKeySummary(userPreferences),
      userMovieInteractions: getForeignKeySummary(userMovieInteractions),
      reviews: getForeignKeySummary(reviews),
      movieCache: getForeignKeySummary(movieCache),
    }).toEqual({
      users: [],
      userPreferences: [
        {
          columns: ["user_id"],
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "cascade",
        },
      ],
      userMovieInteractions: [
        {
          columns: ["user_id"],
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "cascade",
        },
      ],
      reviews: [
        {
          columns: ["user_id"],
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "cascade",
        },
      ],
      movieCache: [],
    });
  });

  it("uses date-mode timestamptz columns and only the designed defaults", () => {
    const timestampColumns = [
      users.onboardingCompletedAt,
      users.createdAt,
      users.updatedAt,
      userPreferences.createdAt,
      userPreferences.updatedAt,
      userMovieInteractions.watchedAt,
      userMovieInteractions.createdAt,
      userMovieInteractions.updatedAt,
      reviews.createdAt,
      reviews.updatedAt,
      movieCache.fetchedAt,
    ];

    expect(
      timestampColumns.every(
        (column) =>
          column.columnType === "PgTimestamp" &&
          column.getSQLType() === "timestamp with time zone",
      ),
    ).toBe(true);

    expect({
      userId: users.id.hasDefault,
      interactionId: userMovieInteractions.id.hasDefault,
      reviewId: reviews.id.hasDefault,
      reactionNotNull: userMovieInteractions.reaction.notNull,
      onboardingCompletedAt: users.onboardingCompletedAt.hasDefault,
      watchedAt: userMovieInteractions.watchedAt.hasDefault,
      fetchedAt: movieCache.fetchedAt.hasDefault,
      createdAndUpdatedAt: [
        users.createdAt,
        users.updatedAt,
        userPreferences.createdAt,
        userPreferences.updatedAt,
        userMovieInteractions.createdAt,
        userMovieInteractions.updatedAt,
        reviews.createdAt,
        reviews.updatedAt,
      ].every((column) => column.hasDefault),
    }).toEqual({
      userId: false,
      interactionId: true,
      reviewId: true,
      reactionNotNull: false,
      onboardingCompletedAt: false,
      watchedAt: false,
      fetchedAt: false,
      createdAndUpdatedAt: true,
    });
  });

  it("connects users to preferences, interactions, and reviews only", () => {
    const { tables, tableNamesMap } = extractTablesRelationalConfig(
      {
        users,
        userPreferences,
        userMovieInteractions,
        reviews,
        movieCache,
        usersRelations,
        userPreferencesRelations,
        userMovieInteractionsRelations,
        reviewsRelations,
      },
      createTableRelationsHelpers,
    );

    const relationSummary = Object.fromEntries(
      Object.entries(tables).map(([tableName, table]) => [
        tableName,
        Object.fromEntries(
          Object.entries(table.relations).map(([relationName, relation]) => {
            const normalized = normalizeRelation(
              tables,
              tableNamesMap,
              relation,
            );

            return [
              relationName,
              {
                referencedTable: relation.referencedTableName,
                fields: normalized.fields.map((column) => column.name),
                references: normalized.references.map((column) => column.name),
              },
            ];
          }),
        ),
      ]),
    );

    expect(relationSummary).toEqual({
      users: {
        preferences: {
          referencedTable: "user_preferences",
          fields: ["id"],
          references: ["user_id"],
        },
        interactions: {
          referencedTable: "user_movie_interactions",
          fields: ["id"],
          references: ["user_id"],
        },
        reviews: {
          referencedTable: "reviews",
          fields: ["id"],
          references: ["user_id"],
        },
      },
      userPreferences: {
        user: {
          referencedTable: "users",
          fields: ["user_id"],
          references: ["id"],
        },
      },
      userMovieInteractions: {
        user: {
          referencedTable: "users",
          fields: ["user_id"],
          references: ["id"],
        },
      },
      reviews: {
        user: {
          referencedTable: "users",
          fields: ["user_id"],
          references: ["id"],
        },
      },
      movieCache: {},
    });
  });
});
