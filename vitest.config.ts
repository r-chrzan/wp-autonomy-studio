import { defineConfig } from "vitest/config";

/**
 * One Vitest run, two projects:
 * - `unit`: `*.test.ts` next to the code. No network, no database. Fast.
 * - `integration`: `*.int.test.ts`. Gets a real PostgreSQL from Testcontainers (needs Docker).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.int.test.{ts,tsx}", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["packages/*/src/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["packages/db/test/global-setup.ts"],
          setupFiles: ["packages/db/test/setup-env.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "packages/db/src/migrations/**", "packages/ui/src/admin/**"],
    },
  },
});
