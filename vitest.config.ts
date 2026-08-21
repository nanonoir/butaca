import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: [
      "src/contracts/**/*.test.ts",
      "src/components/**/*.test.tsx",
      "src/features/**/*.test.tsx",
      "src/app/ai/**/*.test.tsx",
      "src/app/liked/**/*.test.tsx",
      "src/app/profile/**/*.test.tsx",
    ],
    passWithNoTests: true,
  },
});
