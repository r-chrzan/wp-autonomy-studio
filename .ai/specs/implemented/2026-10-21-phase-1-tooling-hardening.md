# Phase 1: tooling hardening

- **Status:** implemented
- **Created:** 2026-10-21
- **Parent:** `.ai/specs/2026-10-21-engineering-standards.md` (sections 2.4, 9, 10, 11, 13; rollout phase 1)

## Problem

The repo has lint (Next presets only) and typecheck, nothing else: no formatter, no tests, no
type-aware lint, no package-boundary enforcement, no CI, no structured logging, and env is
read ad hoc. Every later phase needs these in place first.

## Goals / Non-goals

**Goals**

1. Prettier (+ Tailwind class sorting) as the only formatter; `format` / `format:check` scripts.
2. TypeScript pinned `~5.9`; tsconfig adds `noImplicitOverride`, `noFallthroughCasesInSwitch`.
3. ESLint: typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` (`projectService`),
   eslint-config-prettier, eslint-plugin-boundaries for the AGENTS.md dependency rules,
   `no-restricted-imports` for framework-free `core`, bans on `enum`, and named exports
   only (default exports allowed where Next.js or tool configs need them).
4. knip for unused files, exports and dependencies (`npm run knip`).
5. `@wpas/core`: Zod env schema (replaces `requireEnv`/`intEnv`), `AppError` hierarchy +
   `ActionResult`, pino `createLogger()` with redaction.
6. App: env validated at boot in `instrumentation.ts`; logger registered in the container;
   request scopes disposed; health route uses the logger; Sentry enabled only by
   `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (`onRequestError`).
7. Tests: Vitest 5 `test.projects` (unit per package + `integration` project using
   Testcontainers Postgres); Playwright E2E with axe against `next build && next start`.
8. lefthook (pre-commit: Prettier + ESLint on staged files; commit-msg: commitlint),
   Conventional Commits with package scopes.
9. Renovate config; GitHub Actions CI (lint, typecheck, knip, unit, integration, build, e2e,
   security: CodeQL, gitleaks, dependency review, npm audit).

**Non-goals** (later phases)

- MSW (first outbound adapter, phase 3), OTel exporter (worker, phase 4), Dockerfile and
  `output: "standalone"` (deployment spec), `DATABASE_MIGRATION_URL` and RLS (phase 2).

## Acceptance criteria

- `npm run format:check`, `lint`, `typecheck`, `knip`, `test`, `test:integration`, `build`,
  `test:e2e` all pass locally.
- A deliberate cross-package import violation (e.g. `core` importing `@wpas/db`) fails lint.
- Missing `DATABASE_URL` fails fast with a readable Zod error naming the variable.
- The CI workflow file is valid YAML and runs the same commands.

## Result

All acceptance criteria verified on 2026-10-21 (see `.ai/runs/2026-10-21-phase-1-tooling-hardening.md`).
Additions beyond the goals: `erasableSyntaxOnly`, `withRequestScope()`, a container-independent
app logger, and `@wpas/core` subpath exports instead of a barrel. The CI workflow is validated
with actionlint but has not run on GitHub yet.
