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

- 2026-10-20 — **MikroORM v7 `init()` does not connect** — `checkConnection()` reports "Connection not established" until `orm.connect()` is called; `getOrm()` connects right after `init()`, so keep that when touching ORM bootstrap.
- 2026-10-20 — **Stop Next servers by port, not by name** — `pkill -f "next start"` misses the process (its title is `next-server`); use `kill $(lsof -iTCP:<port> -sTCP:LISTEN -t)` and confirm the port is free before testing.

- 2026-10-20 — **Review every shadcn CLI change** — in `packages/ui` the CLI rewrote the utils import to `"cn"` and installed an unrelated `cn` npm package; check imports and `package.json` after each `shadcn add`. [details](lessons/2026-10-20-shadcn-cli-monorepo.md)
- 2026-10-20 — **MikroORM v7 CLI: command before options** — `mikro-orm --config x debug` fails with a usage dump; put the config path in `packages/db/package.json` (`mikro-orm.configPaths`) and run via `npm run orm -w @wpas/db -- <command>` (tsx + root `.env`).
- 2026-10-20 — **`next dev` writes `AGENTS.md` in the Next project dir** — in this monorepo that's `packages/app/AGENTS.md`, not the root; keep the managed blocks there and project rules in the root file.
- 2026-10-20 — **Unanchored `.gitignore` patterns in a monorepo** — `/.next/` only matches the root; use `.next/`, `node_modules/` etc. so workspace packages are covered.

