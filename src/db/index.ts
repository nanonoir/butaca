import "server-only";

import { getDatabaseUrl } from "../lib/env/server";
import { createDatabaseConnection, type Database } from "./client";

let database: Database | undefined;

export function getDatabase() {
  database ??= createDatabaseConnection(getDatabaseUrl()).db;
  return database;
}

export type { Database } from "./client";
