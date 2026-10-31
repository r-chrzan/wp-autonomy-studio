# Run: idempotent `npm run setup` installer

- **Date:** 2026-10-31
- **Spec:** .ai/specs/2026-10-31-npm-run-setup-installer.md (on spec PR #6)
- **Issue:** #5
- **Outcome:** success

Source doc: .ai/specs/2026-10-31-npm-run-setup-installer.md

## Goal

Make `npm run setup` run the README Getting started steps, skipping any step that is already done,
and update the README with the one-command path while keeping the manual steps.

## Scope

- New: `scripts/setup.ts`, `scripts/setup-steps.ts` and their unit tests.
- Changed: `package.json` (the `setup` script), root `tsconfig.json`, `vitest.config.ts`,
  `README.md`, `AGENTS.md` (the `console` exception for `scripts/`).
- Non-goals: installing Node/Docker; CI/production provisioning; changing `compose.yaml`,
  `.env.example` or migrations; editing existing `.env` values; starting `npm run dev`.

## Implementation Plan

### Phase 1: Tooling wiring

1.1 Root `tsconfig.json`: include `scripts/**/*.ts`, `allowImportingTsExtensions`; Vitest
`unit-node` include plus coverage include for `scripts/`.

### Phase 2: Installer

2.1 `scripts/setup-steps.ts` + tests: steps, runner, output; covers skip, run and failure paths.
2.2 `scripts/setup.ts` + test: `createRealDeps()`, entry, exit code.
2.3 `package.json` `setup` script; AGENTS.md `console` exception.

### Phase 3: Docs and verification

3.1 README: `npm run setup` first, with a "Manual setup" alternative.
3.2 Manual run, twice (first run does the work, second skips everything), `npm run check`,
`npm run test:integration`.

## Risks

- `db:migration:pending` text may change across MikroORM versions → the fallback is "todo", and
  `migration:up` is idempotent.
- Worktrees share the main checkout's database → step 4 checks reachability, not the compose
  project.

## Decisions & assumptions

Autonomous defaults Q1–Q4 from the spec (no dev-server start, no `--force`, macOS/Linux,
no split).

## Verification

- Manual, in this worktree, with the main checkout's database running:
  - Run 1 installed dependencies and created both env files. The database and migrations were
    skipped: `DATABASE_URL` was reachable, and the real MikroORM CLI printed "No pending
    migrations". Exit 0.
  - Run 2 skipped all 5 steps. Exit 0. Both env files had identical checksums.
  - A customised `.env` was byte-identical after a rerun.
- `npm run format:check`, `lint`, `typecheck`, `knip`: all pass.
- `npm run test:coverage`: 88 tests pass, 100% coverage on every metric.
- `npm run test:integration`: 5 tests pass.
- Not exercised for real: starting the database with Docker from scratch. Stopping the user's
  running database was out of scope. The unit tests cover it.

## Review

- `om-auto-review-pr` (fresh-context reviewer) found 1 major and 3 minor issues:
  - Windows `npm.cmd` spawn;
  - IPv6 brackets;
  - swallowed spawn errors;
  - untested DATABASE_URL edge cases.
- Fixed in 88bb48b.
- A pnpm/bun `npm_execpath` nit was fixed in 5acceb8.
- Re-review: approve. The spec's Q3 rationale was corrected on #6 (ca61153).

## Progress

PR: #7

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Tooling wiring

- [x] 1.1 Wire scripts/ into tsconfig and Vitest — 7b4bb98

### Phase 2: Installer

- [x] 2.1 setup-steps.ts with tests — 16790a4
- [x] 2.2 setup.ts entry with tests — 8497f7b
- [x] 2.3 package.json script and AGENTS.md exception — 86ddbd0

### Phase 3: Docs and verification

- [x] 3.1 README update — 5038d7a
- [x] 3.2 Manual run and full validation gate
