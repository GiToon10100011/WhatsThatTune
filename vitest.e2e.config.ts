import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/e2e/setup.ts"],
    globals: true,
    include: ["tests/e2e/**/*.test.{ts,tsx}"],
    testTimeout: 120000, // 2 minutes for E2E tests
    hookTimeout: 60000,
    maxConcurrency: 1, // Run E2E tests sequentially
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
