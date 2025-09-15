import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],
    exclude: ["tests/e2e/**/*", "tests/performance/**/*"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
