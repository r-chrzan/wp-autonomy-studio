/**
 * Conventional Commits. The scope is the package name without the `@wpas/` prefix, or a
 * repo-wide area: `feat(db): add Site entity`, `chore(ci): cache Playwright browsers`.
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["app", "core", "db", "domain", "ui", "worker", "sandbox", "ai", "ci", "deps", "repo"],
    ],
  },
};

export default config;
