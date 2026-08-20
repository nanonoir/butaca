import "server-only";

import { getServerEnv } from "../lib/env/server";
import { createDatabaseConnection, type Database } from "./client";

let database: Database | undefined;

export function getDatabase() {
  database ??= createDatabaseConnection(getServerEnv().DATABASE_URL).db;
  return database;
}

export type { Database } from "./client";
