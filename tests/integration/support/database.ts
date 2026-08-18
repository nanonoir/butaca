import { createDatabaseConnection } from "../../../src/db/client";

import { getIntegrationEnv } from "./env";

export function createIntegrationDatabase() {
  return createDatabaseConnection(getIntegrationEnv().DATABASE_URL);
}
