# CI checks, 100% unit coverage and agent-browser integration tests

- **Status:** implemented
- **Created:** 2026-10-21
- **Parent:** `.ai/specs/2026-10-21-engineering-standards.md` (sections 10 and 13); amends it

## Problem

The user wants every pull request checked for: build, lint, unit tests (TypeScript), and
integration tests that start the app on an ephemeral Testcontainers PostgreSQL and drive it
with **agent-browser**. Every new feature must have 100% unit coverage, and existing code must
be brought to 100%.

## Decisions

1. **Unit tests:** Vitest projects `unit-node` (`*.test.ts`, Node) and `unit-dom` (`*.test.tsx`,
   jsdom + Testing Library). Coverage (v8) thresholds are **100% lines, branches, functions and
   statements** over all source files. Excluded only: tests and test support, tool config files
   (`*.config.*`), generated migrations, type declarations. No `v8 ignore` comments.
2. **Integration tests:** one Vitest project `integration` (`*.int.test.ts` in `packages/*/src`
   and `packages/app/integration`). `npm run test:integration` builds first; the global setup it starts PostgreSQL 17 in
   Testcontainers, applies the migrations, and starts the **built** app (`next start`) on a free
   port against that database. Browser tests drive the app through a typed wrapper around the
   agent-browser CLI (`--json`, one `--session` per test file) and audit accessibility with its
   built-in axe-core (`a11y`, WCAG 2.2 AA tags, serious/critical fail).
   `npm run test:integration` = `next build` + that project.
3. **agent-browser replaces Playwright** for platform tests (no second browser-test library).
   Playwright stays only where the parent spec uses it for generated WordPress code inside the
   sandbox image (section 6.6), which is a product concern, not this repo's test stack.
4. **CI on every PR:** jobs `build`, `lint` (Prettier + ESLint), `typecheck` (tsc + knip),
   `unit` (with coverage thresholds), `integration`, `security`. `@wpas/db` exports
   `@wpas/db/testing` (ephemeral database helper) for both integration setups.
5. **AGENTS.md** states the 100% unit-coverage rule for every feature.

## Acceptance criteria

- `npm run test:coverage` passes with 100% on all four metrics; removing any test makes it fail.
- `npm run test:integration` starts its own database and app, runs DB and agent-browser tests,
  and leaves no container or server running.
- CI workflow has the jobs above, triggered on `pull_request`; actionlint passes.
- `npm run check`, `npm run build` pass.

## Result

All acceptance criteria verified on 2026-10-21 (see `.ai/runs/2026-10-21-ci-and-test-coverage.md`).
CI validated with actionlint; it runs on GitHub once the branch is pushed.
