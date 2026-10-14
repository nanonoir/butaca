import { getIntegrationEnv, loadTestEnvironmentFile } from "./support/env";

// Deliberately no `.env`/`.env.local` fallback: the target must be selected
// explicitly (BUTACA_TEST_ENV_FILE or exported variables) and pass the
// isolation guard before any test touches a database.
loadTestEnvironmentFile();
getIntegrationEnv();
