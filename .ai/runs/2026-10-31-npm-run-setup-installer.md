# Run: idempotent `npm run setup` installer

- **Date:** 2026-10-31
- **Spec:** .ai/specs/2026-10-31-npm-run-setup-installer.md (on spec PR #6)
- **Issue:** #5
- **Outcome:** in progress

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

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Tooling wiring

- [ ] 1.1 Wire scripts/ into tsconfig and Vitest

### Phase 2: Installer

- [ ] 2.1 setup-steps.ts with tests
- [ ] 2.2 setup.ts entry with tests
- [ ] 2.3 package.json script and AGENTS.md exception

### Phase 3: Docs and verification

- [ ] 3.1 README update
- [ ] 3.2 Manual run and full validation gate
