import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/** Bounds for the application pool. A small pool is enough for one container;
 * the timeouts keep an unreachable or stuck database from piling up work (the
 * server cancels a query after `statement_timeout`, so a caller that gave up
 * does not leave it running). Values are milliseconds except where noted. */
export const DATABASE_POOL_OPTIONS = {
  max: 10,
  /** seconds */
  connect_timeout: 5,
  /** seconds */
  idle_timeout: 30,
  prepare: false,
  connection: { statement_timeout: 15_000 },
} as const satisfies postgres.Options<Record<string, never>>;

export function createDatabaseConnection(databaseUrl: string) {
  const sqlClient = postgres(databaseUrl, DATABASE_POOL_OPTIONS);
  const db = drizzle(sqlClient, { schema });

  return {
    db,
    close: () => sqlClient.end(),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
export type DbTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export type DbExecutor = Database | DbTransaction;
