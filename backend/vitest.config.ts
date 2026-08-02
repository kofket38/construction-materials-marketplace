import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 20_000,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
