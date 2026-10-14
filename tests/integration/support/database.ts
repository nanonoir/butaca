import { createDatabaseConnection } from "../../../src/db/client";

import { getIntegrationEnv } from "./env";

/** The guard runs on every connection, so even a test that bypasses
 * `setup-env` cannot reach a database that is not an isolated test target. */
export function createIntegrationDatabase() {
  return createDatabaseConnection(getIntegrationEnv().DATABASE_URL);
}
