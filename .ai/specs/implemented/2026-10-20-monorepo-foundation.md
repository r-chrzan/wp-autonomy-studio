# Monorepo foundation

- **Status:** implemented
- **Created:** 2026-10-20

## Problem

The repo is a single `create-next-app` project. WP Autonomy Studio needs a monorepo with a
fixed stack and package boundaries that coding agents can follow without re-deciding them.

## Goals / Non-goals

**Goals**

- npm workspaces monorepo with `packages/app`, `packages/core`, `packages/db`, `packages/ui`.
- Stack wired end to end: Next.js 16 + React 19 + TypeScript, PostgreSQL + MikroORM v7
  (migrations, connection pool), Awilix DI, DaisyUI (frontend pages), shadcn/ui (backend pages).
- `AGENTS.md` records the stack and architecture rules; `README.md` documents the architecture.

**Non-goals**

- Domain entities, auth, real admin features. Only the skeleton and one wiring proof
  (`/api/health`).

## Requirements

1. Package manager: npm workspaces (existing `package-lock.json`). Package scope `@wpas/*`.
2. Internal packages ship TypeScript source (no build step); Turbopack transpiles workspace
   packages automatically.
3. Dependency direction: `app → ui, db, core`; `db → core`; `ui` and `core` depend on no
   other internal package.
4. Frontend (public) pages and backend (admin) pages are separate root layouts in route
   groups, each with its own stylesheet, so DaisyUI and shadcn/ui theme tokens never collide.
5. MikroORM: entities via `defineEntity` (no decorators / reflect-metadata), config built from
   `DATABASE_URL`, pool settings from env, `Migrator` extension, CLI scripts in `@wpas/db`.
6. Awilix: `PROXY` injection mode (safe under minification), `strict: true`, explicit
   registration (no `loadModules`). The composition root lives in `packages/app` and is
   server-only. Per-request scope gets a forked `EntityManager`.

## Design

```
packages/
  app/   @wpas/app   Next.js app: app/(site) = DaisyUI, app/(admin)/admin = shadcn/ui,
                     src/server/container.ts = composition root
  core/  @wpas/core  createAppContainer(), env helpers, shared types
  db/    @wpas/db    createOrmConfig(), initOrm(), entity registry, migrations, CLI config
  ui/    @wpas/ui    site/ (DaisyUI components), admin/ (shadcn components), lib/utils (cn),
                     styles/site.css, styles/admin.css
```

## Acceptance criteria

- `npm run lint`, `npm run typecheck`, `npm run build` pass from the repo root.
- `/` renders with DaisyUI styles; `/admin` renders with shadcn/ui styles.
- `/api/health` resolves the container and reports DB status (works with or without a DB).
- `npm run db:migration:create` / `db:migration:up` scripts exist in the root and `@wpas/db`.

## Progress

| Phase                                                                           | Result |
| ------------------------------------------------------------------------------- | ------ |
| 1. Workspace + package split (`app`, `core`, `db`, `ui`), imports, scripts      | done   |
| 2. Stack wiring: MikroORM, Awilix, DaisyUI / shadcn route groups, `/api/health` | done   |
| 3. Docs: `AGENTS.md`, `README.md`, `CLAUDE.md`                                  | done   |
| 4. Live verification against PostgreSQL (`compose.yaml`) and migrations         | done   |
| 5. Final whole-project verification from a clean install                        | done   |

All acceptance criteria verified on 2026-10-20. Phase 5 re-ran everything from a clean
`npm ci`: lint, typecheck, build, migrations, production and dev startup.
The project has no automated tests yet. See
`.ai/runs/2026-10-20-monorepo-foundation.md`.

## Next phase (new spec)

Define the first domain entities (e.g. the WordPress site model) with `defineEntity`.
Generate the initial migration and add the first service and repository in the container.

## Open questions

- Deployment target (Vercel vs. self-hosted `output: "standalone"`) — not decided.
