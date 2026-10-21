# AGENTS.md — WP Autonomy Studio

Rules for coding agents working in this repo. The stack and package boundaries below are
decided; follow them, and if one has to change, discuss it and update this file and
`README.md` together.

## Next.js agent rules (read first)

This repo runs Next.js 16, which differs from older versions in your training data. Before
writing Next.js code, read [`packages/app/AGENTS.md`](packages/app/AGENTS.md) and the
relevant guide in `node_modules/next/dist/docs/`. `next dev` generates and maintains that
file; don't edit its managed `BEGIN/END` blocks, and commit it when it changes.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 | `cacheComponents` is on |
| Language | TypeScript, `strict` | shared settings in `tsconfig.base.json` |
| Database | PostgreSQL | local instance via `compose.yaml` |
| ORM | MikroORM v7 (`@mikro-orm/postgresql`) | migrations, connection pool |
| DI container | Awilix | `PROXY` injection mode |
| Frontend (public) pages | DaisyUI 5 on Tailwind CSS 4 | |
| Backend (admin) pages | shadcn/ui (new-york, Radix) on Tailwind CSS 4 | |
| Monorepo | npm workspaces, `packages/*` | scope `@wpas/*` |
| Runtime | Node.js ≥ 24 | |

Don't add a second library for something on this list (another ORM, DI container, CSS
framework or component kit, or package manager).

## Monorepo layout

```
packages/
  app/   @wpas/app   Next.js application (routes, pages, composition root)
  core/  @wpas/core  reusable, framework-agnostic code: DI helpers, env, shared types
  db/    @wpas/db    data management: MikroORM config, entities, migrations, repositories
  ui/    @wpas/ui    reusable UI: site/ (DaisyUI), admin/ (shadcn/ui), styles, cn()
```

### Package rules

1. **Dependency direction:** `app → ui, db, core`; `db → core`; `ui` and `core` import no
   other `@wpas/*` package. Never import `@wpas/app` from another package.
2. **`core` stays framework-agnostic:** no React, Next.js or MikroORM imports.
3. **`ui` stays presentational:** no data fetching, no `@wpas/db`, no server-only code.
4. **Source-only packages:** internal packages export TypeScript source through their
   `package.json` `exports` map. There is no build step; Turbopack transpiles workspace
   packages. Import only through those exports (`@wpas/ui/admin/button`), never by relative
   path into another package (`../../ui/src/...`).
5. **Dependencies belong to the package that imports them.** Add them with
   `npm install <pkg> -w @wpas/<name>`. Internal deps use `"@wpas/core": "*"`.
6. New packages go in `packages/<name>`, are named `@wpas/<name>`, extend
   `../../tsconfig.base.json`, and define a `typecheck` script.

## Application (`@wpas/app`)

- Two root layouts in route groups, so the two design systems never share a stylesheet:
  - `app/(site)/` holds the frontend (public) pages. Layout imports `site.css` (DaisyUI).
  - `app/(admin)/admin/` holds the backend (admin) pages under `/admin`. Layout imports
    `admin.css` (shadcn/ui).
  - Moving between the two does a full page load; that's expected.
- Never use DaisyUI classes in admin pages or shadcn components in site pages. Both define
  Tailwind theme colors (`--color-primary`, …) with different meanings.
- Server-only code goes in `src/server/` and starts with `import "server-only"`.
- Route handlers and server components get services from the container (see below), not by
  constructing them.

## Dependency injection (Awilix)

- Create containers only through `createAppContainer()` from `@wpas/core`. It uses `PROXY`
  injection mode (dependencies arrive as one destructured object, which survives
  minification) and `strict: true`.
- The **composition root** is `packages/app/src/server/container.ts`. Register every
  service there, explicitly, and add it to the `Cradle` type. Don't use `loadModules`
  (filesystem globbing doesn't work in the bundle).
- Lifetimes: infrastructure (ORM, clients, config) is singleton or `asValue`; anything that
  holds per-request state (`em`, the current user) is `.scoped()` and is resolved only from
  `createRequestScope()`. Dispose the scope when the request finishes.
- Services take their dependencies through the constructor/factory argument
  (`constructor({ em }: Pick<Cradle, "em">)`), not by importing the container.

## Database (MikroORM + PostgreSQL)

- Define entities with `defineEntity` + `p` builders and export the inferred type
  (`InferEntity`). No decorators, `reflect-metadata` or `@mikro-orm/reflection`.
- Register every entity in `packages/db/src/entities/index.ts`.
- Runtime config is `createOrmConfig()` in `packages/db/src/config.ts`, built from env:
  `DATABASE_URL` (required), `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`. Don't hardcode
  credentials; `.env.example` documents the variables.
- `getOrm()` returns one process-wide ORM (one pool), cached on `globalThis` so dev hot
  reloads reuse it. Never call `MikroORM.init` elsewhere.
- Use a forked EntityManager per request (the scoped `em` registration). Never use the
  global `orm.em` for request work.
- **Schema changes only through migrations.** Change the entity, run
  `npm run db:migration:create`, review the generated file in `packages/db/src/migrations/`,
  commit it with the entity change. Never use `schema:update` against shared databases.
  Never edit a migration that has already been applied anywhere; add a new one.
- The migrator is registered only in the CLI config (`src/mikro-orm.config.ts`), so it stays
  out of the Next.js bundle.

## UI (`@wpas/ui`)

- `src/site/` holds DaisyUI components for frontend pages (`@wpas/ui/site/<name>`).
- `src/admin/` holds shadcn/ui components for admin pages (`@wpas/ui/admin/<name>`). Add
  them with the CLI, from `packages/ui`: `npx shadcn@latest add <component>`. Then check
  the result: the utils import must be `@wpas/ui/lib/utils`, and the CLI must not have added stray
  dependencies to `package.json`.
- Theme tokens live in `src/styles/site.css` (DaisyUI plugin and themes) and
  `src/styles/admin.css` (shadcn CSS variables). Each one declares `@source` for its own
  component folder.
- Use `cn()` from `@wpas/ui/lib/utils` to merge class names.

## Commands (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js app |
| `npm run lint` | ESLint over all packages |
| `npm run typecheck` | `tsc` in every workspace |
| `docker compose up -d db` | local PostgreSQL |
| `npm run db:migration:create` | generate a migration from entity changes |
| `npm run db:migration:up` / `:down` / `:pending` | apply / revert / list migrations |

Before calling work done, run `npm run lint`, `npm run typecheck` and `npm run build`.

## Project workflow: the `.ai/` directory (MANDATORY)

All AI agents working in this repo MUST use the `.ai/` directory as the project's specification, run-log and long-term memory system.

```
.ai/
├── specs/                 # Specifications (SDD) — active / not yet implemented
│   ├── implemented/       # Specs that are fully implemented and verified
│   └── archive/           # Abandoned, superseded or obsolete specs
├── runs/                  # Logs of autonomous AI runs
├── lessons.md             # Index of lessons learned (long-term memory)
└── lessons/               # Detailed lessons linked from lessons.md
```

### Naming convention

Specs, runs, and lesson detail files all use `YYYY-MM-DD-slug.md` — ISO date, then lowercase kebab-case slug (e.g. `2026-10-20-site-import-flow.md`). Use today's actual date.

### Rules

1. **Before starting a task:** read `.ai/lessons.md`. If the task relates to a spec in `.ai/specs/`, read it and implement against it. Don't silently deviate; if the spec is wrong or incomplete, say so and update it.
2. **Specs (SDD):** non-trivial features are specified in `.ai/specs/` before implementation. When a spec is fully implemented and verified, `git mv` it to `.ai/specs/implemented/`. Obsolete specs go to `.ai/specs/archive/` with a one-line reason at the top. Never delete specs.
3. **Runs:** every autonomous run (multi-step work without step-by-step human guidance) MUST write a log to `.ai/runs/YYYY-MM-DD-slug.md` — goal, linked spec, steps, decisions/assumptions, files changed, verification results, follow-ups. Create it at the start and update it as you go. Run logs are append-only history; don't rewrite old ones.
4. **Lessons:** after fixing a bug, being corrected by the user, hitting a surprising failure, or finding something worth remembering long-term, add an entry to `.ai/lessons.md`. Write it as a rule that would have prevented the mistake. Put longer write-ups in `.ai/lessons/YYYY-MM-DD-slug.md` and link them from the index. Keep lessons accurate: update or remove wrong ones; don't duplicate.
5. **Don't put secrets** (tokens, credentials, personal data) in anything under `.ai/`.
6. Each `.ai/` subfolder has a `README.md` with templates and details.

## Working principles

1. **Plan complex tasks first.** For multi-step or non-trivial work, plan before editing (plan mode, or a spec in `.ai/specs/`). Aim for a plan good enough to implement in one pass. If implementation goes sideways, stop and re-plan instead of pushing through.
2. **Verify, don't assume.** Before calling work done, prove it: run `npm run lint`, `npm run typecheck` and `npm run build`, plus any relevant tests, and check the change in the running app when it affects UI or behavior. Report the commands and their results, including failures. Unverified work is not done.
3. **Prefer the clean fix.** If a fix works but is hacky, revisit it with what you now know and replace it with the simpler, well-structured solution before finishing.
4. **Fix bugs autonomously.** Given a bug report, failing check or log, find the root cause and fix it without waiting for step-by-step direction. Ask only when a decision belongs to the user.
5. **Use subagents for heavy lifting.** Delegate broad searches, research and independent subtasks to subagents to keep the main context focused. Run independent work in parallel.
6. **Turn repetition into tooling.** If the same workflow comes up repeatedly, propose a committed skill or slash command for it.
