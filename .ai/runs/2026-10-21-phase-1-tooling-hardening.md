# Run: Phase 1 tooling hardening

- **Date:** 2026-10-21
- **Spec:** .ai/specs/implemented/2026-10-21-phase-1-tooling-hardening.md
- **Outcome:** success

## Goal

User asked to implement `.ai/specs/2026-10-21-engineering-standards.md`. The spec rolls out in
8 phases, each with its own spec; this run implements phase 1.

## Steps taken

1. Wrote the phase-1 spec. Docker (OrbStack) not running at start.
2. Installed tooling (root): typescript ~5.9.3, typescript-eslint 8.72, eslint-plugin-boundaries
   7.2, eslint-config-prettier 10, prettier 3.9 + tailwind plugin 0.8, knip 6.42, vitest 5.0,
   @vitest/coverage-v8, lefthook 2.2, commitlint 21. Per package: zod 4.6 + pino 10 (+ pino-pretty
   dev) in core; @testcontainers/postgresql in db; vitest in core/db; @playwright/test,
   @axe-core/playwright, @sentry/nextjs 11.8 in app.
3. `@wpas/core` rewritten into subpath exports (`/di`, `/env`, `/errors`, `/logger`), no barrel, so
   client code importing error types never pulls in pino. Zod env schema replaces
   `requireEnv`/`intEnv`; `AppError` hierarchy + `ActionResult`/`toProblem`; `createLogger()` with
   path redaction.
4. App: `instrumentation.ts` (env validation at server start, Sentry when `SENTRY_DSN`),
   `instrumentation-client.ts` (browser Sentry when `NEXT_PUBLIC_SENTRY_DSN`), `src/server/logger.ts`
   (process logger independent of the container), `withRequestScope()` (disposes scopes), health
   route uses both.
5. ESLint: strict + stylistic type-checked, boundaries policy generated from one
   `allowedPackageDeps` map (includes planned `domain`/`worker`), cross-package relative-path ban,
   framework ban in core, data-access ban in ui, no enums, named exports only, return types on
   exported functions in `.ts`. Probed with deliberate violations (core → @wpas/db, relative
   reach-in, ui → @wpas/db): all reported.
6. Vitest: one root config with `unit` and `integration` projects; integration global setup starts
   `postgres:17-alpine` via Testcontainers and hands the URL to tests with `provide`/`inject`.
7. Playwright: smoke + axe (WCAG 2.2 AA tags, serious/critical fail) for `/`, `/admin`,
   `/api/health`, serving the build on port 3100.
8. lefthook (Prettier + ESLint on staged files, commitlint on commit-msg), commitlint scopes,
   Renovate (validated with renovate-config-validator), GitHub Actions CI + CodeQL (validated with
   actionlint), gitleaks via CLI image (ran locally: no leaks), dependency review config.
9. Docs: AGENTS.md (commands, core subpaths, env/logging rules, erasable syntax, `withRequestScope`),
   README.md (scripts, testing prerequisites, commit convention, env table), lessons.

## Decisions & assumptions

- `erasableSyntaxOnly` added (not in the parent spec): found that Node type stripping rejects
  parameter properties; the flag also enforces the existing "no enum" rule at compile time.
- Return types required only in `.ts` files: requiring them on React components is noise and
  conflicts with shadcn CLI output. AGENTS.md updated.
- CI audits at `--audit-level=critical`: braces GHSA-vfj7-8cjw-p6xm (high) has no fix and is
  unreachable here (awilix `loadModules` is never used); dependency-review allowlists that GHSA.
- gitleaks runs from its CLI image instead of `gitleaks-action` (the action needs a license key
  for organization repos).
- Env validation doesn't exit the process: when `register()` throws, Next logs the error, still
  prints "Ready" and answers every request with 500. README describes that accurately.
- Deferred, per the phase-1 spec non-goals: MSW (phase 3), OTel exporter (phase 4), Dockerfile /
  `output: "standalone"` (deployment spec), migration DB role (phase 2).

## Files changed

New: `.prettierrc.json`, `.prettierignore`, `.nvmrc`, `tsconfig.json`, `vitest.config.ts`,
`knip.config.ts`, `commitlint.config.mjs`, `lefthook.yml`, `renovate.json`, `.github/workflows/ci.yml`,
`.github/workflows/codeql.yml`, `.github/dependency-review-config.yml`,
`packages/core/src/{di,env,logger}.ts`, `packages/core/src/errors/*`, core unit tests,
`packages/db/test/{global-setup,setup-env}.ts`, `packages/db/src/orm.int.test.ts`,
`packages/app/{instrumentation,instrumentation-client,playwright.config}.ts`, `packages/app/e2e/*`,
`packages/app/src/server/logger.ts`.
Changed: `eslint.config.mjs`, `tsconfig.base.json`, `package.json` (scripts), package manifests,
`package-lock.json`, `packages/db/src/config.ts`, `packages/app/src/server/container.ts`, health
route, `.env.example`, `.gitignore`, `AGENTS.md`, `README.md`, `.ai/lessons.md`. Prettier
reformatted existing source/markdown once (run logs excluded and restored).
Removed: `packages/core/src/index.ts`, `config/env.ts`, `di/container.ts` (moved).

## Verification (commands run + results)

- `npm run check` (format:check, lint --max-warnings 0, typecheck, knip, unit): pass, 19 tests.
- `npm run test:integration`: pass, 2 tests (Testcontainers, OrbStack Docker 29.8.2).
- `npm run build`: pass.
- `npm run test:e2e`: pass, 3 tests (local compose DB, migrations applied).
- Invalid env (`DATABASE_URL=mysql://…`, `LOG_LEVEL=loud`): server logs both variables by name.
- `next dev` with an unreachable DB: `/api/health` 503, pretty pino line with error and service.
- commitlint: rejects "feat boostrap", accepts "feat(core): add env schema". Pre-commit hooks run.
- actionlint, renovate-config-validator, gitleaks: clean.
- CI itself not run (nothing pushed).

## Follow-ups

- First push: confirm the CI jobs on GitHub (especially Testcontainers on the runner and CodeQL).
- Phase 2 spec: identity and tenancy.
- Remove the braces GHSA allowlist when a fix ships.

## Lessons recorded

- lefthook `--all-files` stages files; keep TypeScript erasable; braces advisory handling.
