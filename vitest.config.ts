import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    env: {
      DATABASE_URL: "file:./test.db",
      NODE_ENV: "test",
    },
    environment: "node",
    fileParallelism: false,
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    hookTimeout: 120000,
    testTimeout: 120000,
    reporters: ["default", "html"],
    outputFile: {
      html: "./reports/test-report.html",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./reports/coverage",
      include: ["src/lib/services/**/*.ts"],
    },
    sequence: {
      concurrent: false,
    },
  },
});
