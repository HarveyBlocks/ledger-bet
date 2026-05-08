import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/services/**/*.ts"],
    },
    sequence: {
      concurrent: false,
    },
  },
});
