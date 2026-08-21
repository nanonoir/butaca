import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": "next/dist/compiled/server-only/empty",
    },
  },
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    setupFiles: ["./tests/integration/setup-env.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
