import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { parseMigrationEnv } from "./src/lib/env/migration";

config({ path: ".env.local", quiet: true });
const env = parseMigrationEnv(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: env.DATABASE_MIGRATION_URL },
  strict: true,
  verbose: true,
});
