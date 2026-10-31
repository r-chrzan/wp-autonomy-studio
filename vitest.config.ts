import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

/**
 * Projects:
 * - `unit-node`: `*.test.ts` next to the code, Node environment. No network, no database.
 * - `unit-dom`: `*.test.tsx` next to the code, jsdom + Testing Library.
 * - `integration`: `*.int.test.ts`, against an ephemeral stack (PostgreSQL in Testcontainers +
 *   the built app), browser tests through agent-browser. Needs Docker and `npm run build`.
 *
 * Coverage (unit projects) must stay at 100% for every metric; see AGENTS.md "Testing".
 */
export default defineConfig({
  resolve: {
    alias: {
      // The app's `@/` path alias (packages/app/tsconfig.json).
      "@/": `${path.join(root, "packages/app")}/`,
      // `server-only` throws outside a React Server Components bundle; tests run in Node.
      "server-only": path.join(root, "test/unit/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit-node",
          include: [
            "packages/*/{src,app}/**/*.test.ts",
            "packages/app/*.test.ts",
            "scripts/**/*.test.ts",
          ],
          exclude: ["**/*.int.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "unit-dom",
          include: ["packages/*/{src,app}/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["test/unit/setup-dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["packages/*/{src,integration}/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["test/integration/global-setup.ts"],
          setupFiles: ["test/integration/setup-env.ts"],
          testTimeout: 60_000,
          hookTimeout: 180_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "packages/*/src/**/*.{ts,tsx}",
        "packages/app/app/**/*.{ts,tsx}",
        "packages/app/*.ts",
        "scripts/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.int.test.ts",
        "**/*.config.{ts,mts}",
        "**/*.d.ts",
        "packages/*/src/testing/**",
        "packages/db/src/migrations/**",
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
