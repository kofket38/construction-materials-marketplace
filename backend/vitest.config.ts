import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 60_000,
    hookTimeout: 30_000,
    // Run test files sequentially (one at a time) to avoid saturating the
    // Supabase connection pool under concurrent integration-test load.
    fileParallelism: false,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
