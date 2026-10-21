# Lessons

Long-term memory for AI agents working on this project. Read it before starting any task.

## How to use

- **Read first:** scan this index before starting work.
- **Write after:** add an entry after fixing a bug, hitting a surprise, or discovering something worth remembering.
- **Index here, detail in `lessons/`:** each entry is one line below. Anything longer than a few lines goes in `.ai/lessons/YYYY-MM-DD-slug.md` and is linked from the index.
- **Keep it true:** if a lesson turns out to be wrong or outdated, fix or delete it. Do not append contradictions.
- **No duplicates:** update an existing entry instead of adding a similar one.
- **Don't record:** things already obvious from the code, git history, or AGENTS.md.

## Entry format

```
- YYYY-MM-DD — **Short title** — one-sentence lesson. [details](lessons/YYYY-MM-DD-slug.md) (optional)
```

Detail file format (`.ai/lessons/YYYY-MM-DD-slug.md`):

```
# Title

- **Context:** what was being done
- **Finding:** what was learned / root cause
- **Fix / Rule:** what to do (or avoid) next time
- **Related:** spec / run / file links
```

## Index

<!-- Newest first. -->

- 2026-10-21 — **`lefthook run pre-commit --all-files` stages files** — jobs with `stage_fixed: true` `git add` everything they touch, even outside a commit; to test hooks, run them without `--all-files` on a scratch change, or reset the index afterwards (`git reset -q`) when nothing was staged before.
- 2026-10-21 — **Keep TypeScript erasable** — Node's type stripping (and anything that runs `.ts` without a compiler) rejects constructor parameter properties, enums and namespaces; `erasableSyntaxOnly` is on in `tsconfig.base.json`, so assign fields in the constructor body instead.
- 2026-10-21 — **Unfixable advisory: braces GHSA-vfj7-8cjw-p6xm** — reached via awilix → fast-glob (only used by `loadModules`, which we never call) and lint tooling; no patched release exists, so CI audits `--audit-level=critical` and dependency-review allowlists that one GHSA in `.github/dependency-review-config.yml`. Remove the allowlist entry once a fix ships.
- 2026-10-21 — **Check peer ranges before taking a new major** — `latest` isn't always usable: TypeScript 7 is outside typescript-eslint 8.72's peer range (`<6.1`), WPCS 3.4 doesn't support PHPCS 4, and the MikroORM adapters for Better Auth/Auth.js only cover v5–v6; run `npm view <pkg> peerDependencies` before upgrading or adding.
- 2026-10-20 — **One `next dev` per project dir** — Next 16 refuses a second dev server for `packages/app` ("Another next dev server is already running"), even on another port; check for the user's running server first and never kill it, retry after it stops or verify against it.
- 2026-10-20 — **zsh aborts the whole command on an unmatched glob** — `rm -rf packages/*/node_modules` with no matches skipped everything after it; use `find … -exec` or explicit paths in cleanup commands.

- 2026-10-20 — **MikroORM v7 `init()` does not connect** — `checkConnection()` reports "Connection not established" until `orm.connect()` is called; `getOrm()` connects right after `init()`, so keep that when touching ORM bootstrap.
- 2026-10-20 — **Stop Next servers by port, not by name** — `pkill -f "next start"` misses the process (its title is `next-server`); use `kill $(lsof -iTCP:<port> -sTCP:LISTEN -t)` and confirm the port is free before testing.

- 2026-10-20 — **Review every shadcn CLI change** — in `packages/ui` the CLI rewrote the utils import to `"cn"` and installed an unrelated `cn` npm package; check imports and `package.json` after each `shadcn add`. [details](lessons/2026-10-20-shadcn-cli-monorepo.md)
- 2026-10-20 — **MikroORM v7 CLI: command before options** — `mikro-orm --config x debug` fails with a usage dump; put the config path in `packages/db/package.json` (`mikro-orm.configPaths`) and run via `npm run orm -w @wpas/db -- <command>` (tsx + root `.env`).
- 2026-10-20 — **`next dev` writes `AGENTS.md` in the Next project dir** — in this monorepo that's `packages/app/AGENTS.md`, not the root; keep the managed blocks there and project rules in the root file.
- 2026-10-20 — **Unanchored `.gitignore` patterns in a monorepo** — `/.next/` only matches the root; use `.next/`, `node_modules/` etc. so workspace packages are covered.
