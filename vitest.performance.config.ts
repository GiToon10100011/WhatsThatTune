import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/performance/setup.ts"],
    globals: true,
    include: ["tests/performance/**/*.test.{ts,tsx}"],
    testTimeout: 300000, // 5 minutes for performance tests
    hookTimeout: 120000,
    maxConcurrency: 1, // Run performance tests sequentially
    reporters: ["verbose", "json"],
    outputFile: "./tests/performance/results.json",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
