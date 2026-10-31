# Idempotent `npm run setup` installer

- **Status:** implemented
- **Created:** 2026-10-31
- **Issue:** #5

## 📝 TLDR

New contributors set up the project by copying six commands from README → Getting started. Proposed:
a single `npm run setup` runs those steps in order. Each step first checks whether it is already
done and is skipped if so, so the command is safe to run on a fresh clone and on a working checkout
alike. The manual steps stay in the README as an alternative.

## 📝 Problem Statement

Today's Getting started (`README.md`) is:

```bash
npm install
cp .env.example .env
cp .env.example packages/app/.env.local
docker compose up -d db
npm run db:migration:up
npm run dev
```

- A missed step only shows up later, e.g. `/api/health` returns 503, or the db CLI can't find
  `DATABASE_URL`.
- Rerunning the block is unsafe: `cp` overwrites a customised `.env`.
- `npm run db:migration:up` can run before PostgreSQL accepts connections. `up -d` doesn't wait for
  the `pg_isready` healthcheck declared in `compose.yaml`.

## 📝 Proposed Solution

A root script `"setup": "node scripts/setup.ts"`. Node 24 runs the TypeScript directly through type
stripping; the repo already enforces `erasableSyntaxOnly`. The installer is a list of steps. Each
step has:

- `check()`, which returns `"done"` or `"todo"`;
- `run()`, which does the work.

The runner prints one line per step (`✔ skipped — already done`, `→ running`, `✖ failed`), stops at
the first failure with a non-zero exit code, and ends by printing `npm run dev`.

| #   | Step                | `check()` = done when                                                                                                            | `run()`                                                                                                                                           |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Preflight           | (always runs; never mutates)                                                                                                     | Node ≥ 24                                                                                                                                         |
| 1   | Dependencies        | `node_modules/.package-lock.json` exists and is not older than `package-lock.json` or any `package.json` (root and `packages/*`) | `npm install`                                                                                                                                     |
| 2   | Root env file       | `.env` exists                                                                                                                    | copy `.env.example` → `.env`                                                                                                                      |
| 3   | App env file        | `packages/app/.env.local` exists                                                                                                 | copy `.env.example` → `packages/app/.env.local`                                                                                                   |
| 4   | Database            | a TCP connection to the host/port of `DATABASE_URL` (read from `.env` with `util.parseEnv`) succeeds                             | check `docker info` / `docker compose version` (fail with a hint), then `docker compose up -d --wait db` (waits for the `pg_isready` healthcheck) |
| 5   | Database migrations | `npm run db:migration:pending` exits 0 **and** its stdout contains `No pending migrations` (MikroORM 7 CLI text)                 | `npm run db:migration:up`                                                                                                                         |

Step 4 checks whether the database is reachable, not which compose project owns it. A second
checkout or git worktree has a different compose project name and would otherwise try to start a
second container on the port the first one already holds. The agent pipeline's worktrees under
`.ai/tmp/` are such checkouts. Docker is only required when the database actually has to be
started, so steps 1–3 work without Docker.

Copying `.env` uses an exclusive create (`fs.copyFileSync(src, dst, COPYFILE_EXCL)`), so an existing
file can never be overwritten, even if a race appears between `check()` and `run()`.

**Alternatives considered:**

- **Bash script.** Rejected: it can't be unit-tested at the required 100% coverage with the repo's
  Vitest setup, and it isn't portable to non-POSIX shells.
- **Always run every step, with no checks.** Rejected: `cp` isn't idempotent, and the brief asks for
  done steps to be reported as skipped.
- **A setup CLI library** (zx, listr2, execa). Rejected: step 1 installs dependencies, so the
  installer must run before `node_modules` exists. It may use Node built-ins only. It also avoids
  adding a new dependency.

## 📝 Architecture

New repo-tooling files sit at the root, outside the workspace packages. They aren't part of any
`@wpas/*` package and import none.

```
scripts/
  setup.ts          entry: wires real deps (child_process, fs, process) into runSetup, sets exit code
  setup-steps.ts    pure: step definitions, runner, output formatting; deps injected
  setup-steps.test.ts
  setup.test.ts     entry test (setup-steps mocked)
```

- **Dependency injection without the container.** `runSetup(deps)` takes a
  `{ exec, fileExists, mtimeMs, copyExclusive, log, nodeVersion, cwd }` object. Awilix is for the
  app's runtime services and is unavailable before `npm install`. A plain argument object follows
  the same "dependencies through the factory argument" rule from `AGENTS.md`.
- **Real dependencies** are built by `createRealDeps()` in `setup.ts`. Its test mocks
  `node:child_process`, `node:fs` and `node:net` and calls every wrapper, so the entry file reaches
  100% coverage without touching the system.
- **Output via `console`** is a deliberate exception to the AGENTS.md "logger, never `console`"
  rule: pino isn't installed before step 1, and this is an interactive CLI, not app code. The
  exception is written into the AGENTS.md logging rule in the same PR.
- **`exec`** wraps `spawnSync(cmd, args, { stdio, cwd })`. It never uses `shell: true` and never
  interpolates strings, so arguments can't be injected. Long steps (`npm install`, `docker compose
up`) inherit stdio so the user sees progress. Checks capture output instead.
- **Entry import.** `setup.ts` imports `./setup-steps.ts` with its extension, as Node requires.
  Root `tsconfig.json` gains `allowImportingTsExtensions: true`; this is valid because `noEmit` is
  already set.
- **Tooling wiring:**
  - Root `tsconfig.json` `include`: add `scripts/**/*.ts`.
  - `vitest.config.ts`: add `scripts/**/*.test.ts` to the `unit-node` project and
    `scripts/**/*.ts` to coverage `include`. This adds files; the `exclude` list is not widened.
  - knip discovers `scripts/setup.ts` through the `setup` npm script; no config change is needed
    unless knip reports it.
  - ESLint already lints every `*.ts` with `projectService`. Check that `scripts/` resolves through
    the root tsconfig.

## 📝 Edge Cases & Failure Scenarios

| Situation                                            | Behaviour                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node < 24                                            | Preflight fails: "Node.js 24+ required (found vX)", exit 1, nothing changed.                                                                     |
| Node too old to run `.ts` at all (< 22.6)            | Node's own "Unknown file extension" error. Accepted: `engines` and the README already require Node 24.                                           |
| Docker not installed / daemon down, DB not reachable | Step 4 fails with a hint ("start Docker Desktop"), exit 1; steps 1–3 have already completed.                                                     |
| Database already served by another checkout/worktree | Step 4 is skipped (port reachable); migrations run against that database, as the README flow would.                                              |
| Port 5432 taken by another Postgres                  | `docker compose up --wait` fails; the step reports the failure and the existing `DATABASE_PORT` override.                                        |
| `.env` exists with custom values                     | Skipped; file byte-identical.                                                                                                                    |
| `npm install` fails (network, lockfile)              | Step fails with npm's output; exit 1; later steps don't run.                                                                                     |
| Migration fails                                      | Step fails with MikroORM's output; exit 1. Rerunning `setup` retries from that step.                                                             |
| `db:migration:pending` output format changes         | Treated as "todo": `migration:up` is itself idempotent, so the worst case is a no-op run, never a skip. A test fixture pins the MikroORM 7 text. |
| Interrupted mid-run (Ctrl-C)                         | Exit code from the signal; rerun resumes because each `check()` re-inspects real state.                                                          |

## 📝 Risks & Impact Review

- **Public contracts:** only additions — a new `setup` npm script and README section. Existing
  scripts, env variables, `compose.yaml` and migrations are unchanged. Nothing listed in
  `BACKWARD_COMPATIBILITY.md` is touched.
- **Developer machines:** the script only runs commands the README already documents, against the
  local compose database. It never deletes data and never overwrites files. Rollback means removing
  the script.
- **Secrets:** the script copies `.env.example`, which holds only local-dev placeholder credentials.
  It never prints `.env` contents.

## 📋 Phasing

One phase. The installer and README change ship together on one PR.

## 📋 Implementation Plan

1. **Tooling wiring:** update root `tsconfig.json` (include `scripts/**/*.ts`,
   `allowImportingTsExtensions`) and `vitest.config.ts` (unit-node include plus coverage include). Verify with `npm run typecheck` and `npm run knip`; both stay green with
   empty placeholders.
2. **`scripts/setup-steps.ts` + tests:** step definitions, runner and output. Unit tests with fake
   deps cover, for every step, the done → skip path, the todo → run path and the run-failure path;
   plus preflight failures, stopping at the first failure, and the final hint. 100% coverage.
3. **`scripts/setup.ts` + test:** `createRealDeps()` and the entry, which sets `process.exitCode`.
   The test mocks the Node built-ins and `./setup-steps.ts`, calls every real-deps wrapper, and
   asserts the exit code. Add the `console` exception to the AGENTS.md logging rule.
4. **`package.json`:** add `"setup": "node scripts/setup.ts"`.
5. **README:** make Getting started lead with `npm run setup` (what it does, that it is safe to
   rerun), followed by a "Manual setup" subsection with the current commands. Fix the migration race
   by changing the manual step to `docker compose up -d --wait db`.
6. **Verify:** `npm run check`, plus a manual run on this machine. The first run executes the
   pending steps. The second run reports every step as skipped. An existing `.env` keeps the same
   checksum. Then `npm run test:integration`.

## 📝 Resolved assumptions (autonomous defaults)

| #   | Question                                       | Default                                    | Rationale                                                                                                                                       |
| --- | ---------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Should `setup` start `npm run dev` at the end? | No: print the command                      | Keeps the script terminating and usable unattended; starting the server is one command.                                                         |
| Q2  | A `--force` flag to recreate `.env` files?     | No flag                                    | Least new surface; deleting the file and rerunning does the same thing.                                                                         |
| Q3  | Platform support                               | macOS/Linux supported; Windows best-effort | Matches the README. npm is spawned as `node $npm_execpath` because Windows `npm.cmd` can't be spawned without a shell, but Windows is untested. |
| Q4  | Split into separate specs?                     | No                                         | The installer and its README section don't work independently of each other.                                                                    |
