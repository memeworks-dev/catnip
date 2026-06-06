import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Match the "@/*" -> repo root alias from tsconfig.
    alias: { "@": root },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    // These tests hit a real Postgres; don't run test files in parallel.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
