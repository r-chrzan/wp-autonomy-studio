import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

/**
 * Package dependency rules from AGENTS.md ("Package rules" 1-2). Each key may import only the
 * packages listed for it; `domain` and `worker` are planned packages (phase 4).
 */
/** Relative imports that leave the current package (`../../ui/src/...`). */
const crossPackagePath = {
  regex: "^(\\.\\./)+(app|core|db|domain|ui|worker)/",
  message: "Import another package through its exports (`@wpas/<name>/...`), not by path.",
};

const allowedPackageDeps = {
  app: ["ui", "domain", "db", "core"],
  worker: ["domain", "db", "core"],
  domain: ["db", "core"],
  db: ["core"],
  ui: [],
  core: [],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Type-aware rules for all TypeScript.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      next: { rootDir: "packages/app/" },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      // Server actions passed to `action`/`formAction` props return promises by design.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use an `as const` object and a union type instead of `enum`.",
        },
      ],
      // Named exports only; files that must default-export are listed below.
      "import/no-default-export": "error",
    },
  },

  // Exported functions declare their return type; React components (.tsx) are exempt.
  {
    files: ["**/*.ts"],
    rules: { "@typescript-eslint/explicit-module-boundary-types": "error" },
  },

  // Plain JS config files aren't in any tsconfig.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Files that Next.js or tools load by default export.
  {
    files: [
      "packages/app/app/**/{page,layout,template,default,error,global-error,not-found,loading,route,opengraph-image,icon}.{ts,tsx}",
      "**/*.config.{ts,mts,mjs,js}",
    ],
    rules: { "import/no-default-export": "off" },
  },

  // Package boundaries (AGENTS.md "Package rules").
  {
    files: ["packages/*/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": Object.keys(allowedPackageDeps).map((name) => ({
        type: name,
        pattern: `packages/${name}`,
      })),
      "boundaries/root-path": import.meta.dirname,
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: Object.entries(allowedPackageDeps).map(([from, allowed]) => ({
            from: { element: { type: from } },
            disallow: {
              to: {
                element: {
                  type: Object.keys(allowedPackageDeps).filter(
                    (name) => name !== from && !allowed.includes(name),
                  ),
                },
              },
            },
          })),
        },
      ],
    },
  },

  // Never reach into another package by relative path; import its `exports` instead.
  {
    files: ["packages/*/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [crossPackagePath] }] },
  },

  // `core` stays framework-agnostic (AGENTS.md "Package rules" 2).
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            crossPackagePath,
            {
              group: ["react", "react-dom", "react/*", "next", "next/*", "@mikro-orm/*"],
              message: "@wpas/core is framework-agnostic: no React, Next.js or MikroORM.",
            },
          ],
        },
      ],
    },
  },

  // `ui` stays presentational (AGENTS.md "Package rules" 3).
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            crossPackagePath,
            {
              group: ["@mikro-orm/*", "server-only"],
              message: "@wpas/ui is presentational: no data access or server-only code.",
            },
          ],
        },
      ],
    },
  },

  // Tests may use non-null assertions and looser typing of fixtures.
  {
    files: ["**/*.test.{ts,tsx}", "**/e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,

  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/next-env.d.ts",
    "packages/db/src/migrations/**",
    // Vendored agent skills, not this app's code
    ".agents/**",
  ]),
]);
