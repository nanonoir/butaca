import { config } from "dotenv";

import { getIntegrationEnv } from "./support/env";

config({ path: ".env.local", quiet: true });
config({ path: ".env.integration.local", override: true, quiet: true });

getIntegrationEnv();
