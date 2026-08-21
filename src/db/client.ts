import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDatabaseConnection(databaseUrl: string) {
  const sqlClient = postgres(databaseUrl, { prepare: false });
  const db = drizzle(sqlClient, { schema });

  return {
    db,
    close: () => sqlClient.end(),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
