import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { Database } from "../../../src/db/client";
import * as schema from "../../../src/db/schema";

import { getIntegrationEnv } from "./env";

/**
 * Same connection as `src/db/client`, minus its `server-only` guard, for
 * runners that are plain Node (Playwright). The isolation guard still applies.
 */
export function createStandaloneTestDatabase() {
  const sqlClient = postgres(getIntegrationEnv().DATABASE_URL, {
    prepare: false,
    max: 1,
  });
  const db = drizzle(sqlClient, { schema }) as unknown as Database;

  return { db, close: () => sqlClient.end() };
}
