# Run: CI checks, 100% unit coverage, agent-browser integration tests

- **Date:** 2026-10-21
- **Spec:** .ai/specs/implemented/2026-10-21-ci-and-test-coverage.md
- **Outcome:** success

## Goal

Commit phase 1, then: PR CI with build, lint, unit and integration checks; integration tests on
an ephemeral Testcontainers PostgreSQL with the app driven by agent-browser; AGENTS.md rule for
100% unit coverage; unit tests covering 100% of existing code.

## Steps taken

1. Committed phase 1 on branch `phase-1-tooling-hardening` (210fb19); hooks passed.
2. Inspected agent-browser 0.39.1 (vercel-labs): native CLI, `--json`, sessions, semantic
   locators, embedded axe-core `a11y`. Local install works without its postinstall script.
3. Swapped Playwright + @axe-core/playwright for agent-browser 0.39.1 (exact pin, app devDep);
   added Testing Library + jsdom; `npx agent-browser install` downloads Chrome for Testing.
4. `@wpas/db`: `migrator.ts` (absolute migrations path, shared by CLI config and tests) and the
   `@wpas/db/testing` export (`startTestDatabase()`: Testcontainers PostgreSQL 17 + migrations).
5. Root `test/integration/global-setup.ts`: database, then `next start` of the build on a free
   port with `DATABASE_URL` pointing at it, waits for `/api/health`, kills the process group in
   teardown. `packages/app/integration/browser.ts`: typed agent-browser wrapper (`--json`, one
   session per file, role-based locators, axe audit). `pages.int.test.ts`: home, navigation to
   admin, health, axe on both pages.
6. Vitest projects `unit-node`, `unit-dom`, `integration`; coverage thresholds 100% for all four
   metrics; aliases for `@/` and `server-only`.
7. Unit tests for every source file (67 tests, 22 files fully covered + 2 re-export barrels).
   Refactor for testability: `loggerOptions()` extracted in `@wpas/core/logger`.
8. Admin page now has an `<h1>` (CardTitle wrapped a plain div; no page heading).
9. CI rewritten: `build`, `lint`, `typecheck` (+knip), `unit` (coverage, artifact), `integration`
   (agent-browser install --with-deps, `npm run test:integration`), `security`.
10. AGENTS.md "Testing (MANDATORY)" section with the 100% rule; README and parent spec amended.

## Decisions & assumptions

- agent-browser is the only browser-test tool for the platform; Playwright remains in the parent
  spec only for generated WordPress code inside the sandbox image.
- One `integration` project for DB-level and browser tests, sharing one ephemeral stack;
  `test:integration` builds first so the stack always serves current code.
- `@testing-library/jest-dom` lives in the root (only `test/unit/setup-dom.ts` imports it).
- Only test infra is excluded from coverage (`src/testing/`, `test/`, `integration/`, configs,
  migrations, `.d.ts`); `next.config.ts` and `mikro-orm.config.ts` count as tool configs.
- Didn't commit this part: the user asked to commit phase 1 only.

## Files changed

New: `test/{types.d.ts,unit/setup-dom.ts,unit/server-only.ts,integration/global-setup.ts,
integration/setup-env.ts}`, `packages/db/src/{migrator.ts,testing/index.ts}`,
`packages/app/integration/{browser.ts,pages.int.test.ts}`, 18 unit test files.
Changed: `vitest.config.ts`, `knip.config.ts`, `package.json` scripts/devDeps, package manifests
and tsconfigs, `packages/db/src/mikro-orm.config.ts`, `packages/core/src/logger.ts`, admin page,
`.github/workflows/ci.yml`, `.gitignore`, `.prettierignore`, `AGENTS.md`, `README.md`,
parent spec, `.ai/lessons.md`.
Removed: `packages/app/e2e/`, `packages/app/playwright.config.ts`, `packages/db/test/`.

## Verification (commands run + results)

- `npm run check`: pass; 67 unit tests; coverage 100% statements (127/127), branches (58/58),
  functions (50/50), lines (121/121).
- Removing `migrator.test.ts` makes all four thresholds fail (exit 1), so the gate works.
- `npm run test:integration`: pass, 5 tests (2 files), build + Testcontainers + agent-browser;
  afterwards no test containers or Node servers left running.
- actionlint on both workflows: clean. CI not run on GitHub (not pushed).

## Follow-ups

- Push the branch and open a PR to see the workflow run; then make the CI jobs required checks
  in branch protection for `main`.
- Phase 2 spec (identity and tenancy).

## Lessons recorded

- `next build` type-checks tests; agent-browser role locators; React 19 static `<head>`.

## Update: pushed and ran on GitHub

- Committed `ed2f04e` (commitlint rejected the first subject for sentence case), pushed branch
  `phase-1-tooling-hardening`, opened PR #1 (gh had to be re-authenticated as the repo owner).
- First CI run: build, lint, typecheck, unit (100% coverage), integration (Testcontainers +
  agent-browser) all passed on ubuntu-latest. Security failed only at dependency review, and
  CodeQL failed, both because the private repo on GitHub Free has no Advanced Security.
- Fix `2e65766`: both run only when the repository is public; CodeQL gets `actions: read`.
- Branch protection and rulesets return 403 ("Upgrade to GitHub Pro or make this repository
  public"), so required checks can't be configured on the current plan. User decision.

## Update 2026-10-31: repository public, stage closed

- User asked to make the repository public and finish the stage. Before switching: gitleaks over
  all branches and history (8 commits): no leaks; no `.env`/key files ever committed.
- Visibility switched to public, so CodeQL and dependency review run (the
  `!github.event.repository.private` guard now passes) and branch protection is available.
- Plan: green run on PR #1 with all checks, then protect `main` (required checks, PR required),
  squash-merge PR #1, sync local `main`.
