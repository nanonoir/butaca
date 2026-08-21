import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": "next/dist/compiled/server-only/empty",
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/components/**/*.test.tsx"],
    exclude: ["tests/integration/**"],
    passWithNoTests: true,
  },
});
