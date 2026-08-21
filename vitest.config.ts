import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    include: [
      "src/contracts/**/*.test.ts",
      "src/components/**/*.test.tsx",
      "src/features/**/*.test.ts",
      "src/features/**/*.test.tsx",
      "src/lib/**/*.test.ts",
    ],
    allowOnly: !process.env.CI,
    passWithNoTests: true,
  },
});
