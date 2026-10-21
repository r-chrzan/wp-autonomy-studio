# WP Autonomy Studio

A Next.js application in an npm-workspaces monorepo, backed by PostgreSQL.

## Getting started

Requirements: Node.js 24+, npm 11+, Docker (for the local database).

```bash
npm install
cp .env.example .env              # used by the db CLI; the app reads env from packages/app/.env*
cp .env.example packages/app/.env.local
docker compose up -d db           # PostgreSQL on localhost:5432
npm run db:migration:up
npm run dev                       # http://localhost:3000
```

- `/` is the frontend (DaisyUI).
- `/admin` is the backend (shadcn/ui).
- `/api/health` checks the DI container and database connection. It returns 200 when the
  database is reachable, 503 otherwise.

## Scripts

Run from the repo root.

| Command                             | Purpose                                  |
| ----------------------------------- | ---------------------------------------- |
| `npm run dev`                       | Next.js dev server (Turbopack)           |
| `npm run build` / `npm run start`   | production build / server                |
| `npm run lint`                      | ESLint across all packages               |
| `npm run typecheck`                 | TypeScript check in every workspace      |
| `npm run db:migration:create`       | generate a migration from entity changes |
| `npm run db:migration:up` / `:down` | apply / revert migrations                |
| `npm run db:migration:pending`      | list pending migrations                  |

## Architecture

### Stack

- **Next.js 16** (App Router, Turbopack, Cache Components), **React 19**, **TypeScript** (strict)
- **PostgreSQL** with **MikroORM v7**: entities, migrations, connection pooling
- **Awilix** for dependency injection
- **Tailwind CSS 4**, with **DaisyUI 5** for frontend pages and **shadcn/ui** for backend pages
- **npm workspaces** monorepo

### Packages

```
wp-autonomy-studio/
├── packages/
│   ├── app/    @wpas/app   Next.js app: routes, pages, API, DI composition root
│   ├── core/   @wpas/core  framework-agnostic building blocks (DI helpers, env, types)
│   ├── db/     @wpas/db    MikroORM config, entities, migrations, ORM lifecycle
│   └── ui/     @wpas/ui    shared components and themes (DaisyUI + shadcn/ui)
├── compose.yaml            local PostgreSQL
├── tsconfig.base.json      shared compiler options
└── eslint.config.mjs       one ESLint config for the whole repo
```

Dependencies only point one way:

```
          ┌──────────┐
          │   app    │
          └──┬──┬──┬─┘
             │  │  │
      ┌──────┘  │  └──────┐
      ▼         ▼         ▼
   ┌────┐    ┌────┐    ┌──────┐
   │ ui │    │ db │───▶│ core │
   └────┘    └────┘    └──────┘
```

`core` and `ui` don't depend on any other internal package. Nothing depends on `app`.

The internal packages contain only TypeScript source and have no build step. Each one
exposes entry points through the `exports` map in its `package.json`, for example
`@wpas/ui/admin/button`. Next.js (Turbopack) compiles workspace packages as part of the app.

### Frontend vs. backend pages

The app has two root layouts, one per route group:

| Area              | Route group                       | URL        | Styling                                 |
| ----------------- | --------------------------------- | ---------- | --------------------------------------- |
| Frontend (public) | `packages/app/app/(site)/`        | `/…`       | DaisyUI (`@wpas/ui/styles/site.css`)    |
| Backend (admin)   | `packages/app/app/(admin)/admin/` | `/admin/…` | shadcn/ui (`@wpas/ui/styles/admin.css`) |

DaisyUI and shadcn/ui both define Tailwind theme colors such as `primary`, with different
values and semantics. Separate root layouts mean each page loads exactly one of the two
stylesheets. The cost is a full page load when navigating between the two areas.

Components follow the same split: `packages/ui/src/site/` (DaisyUI) and
`packages/ui/src/admin/` (shadcn/ui, added with the shadcn CLI run from `packages/ui`).

### Dependency injection

Awilix containers are created with `createAppContainer()` from `@wpas/core`, which uses:

- **`PROXY` injection mode.** Dependencies are passed as one object
  (`constructor({ orm, em })`). This keeps working after minification, which breaks
  `CLASSIC` mode because it reads parameter names.
- **`strict` mode.** Unknown dependencies and lifetime mismatches fail fast.

The composition root is `packages/app/src/server/container.ts` (server-only):

- `getContainer()` returns the process-wide container, which holds singletons such as the ORM.
- `createRequestScope()` returns a per-request child scope. Scoped registrations live there,
  such as `em`, a forked MikroORM `EntityManager`.

Services are registered explicitly and typed in `Cradle`. There's no filesystem
auto-loading.

### Data layer

`@wpas/db` owns everything database-related:

- `createOrmConfig()` builds the runtime config from env:
  - `DATABASE_URL`
  - `DATABASE_POOL_MIN` / `DATABASE_POOL_MAX`
- `getOrm()` lazily creates one ORM instance per process, which means one connection pool.
  It's cached on `globalThis` so dev hot reloads reuse it.
- Entities are defined with `defineEntity` (no decorators or reflection) and registered in
  `src/entities/index.ts`.
- Migrations live in `src/migrations/`. They run through the MikroORM CLI with the CLI-only
  config `src/mikro-orm.config.ts`, which keeps the migrator out of the app bundle.
- `@mikro-orm/postgresql` is listed in `serverExternalPackages`, so Next.js loads it from
  `node_modules` at runtime instead of bundling it.

### Configuration

| Variable            | Required | Default | Used by    |
| ------------------- | -------- | ------- | ---------- |
| `DATABASE_URL`      | yes      | –       | `@wpas/db` |
| `DATABASE_POOL_MIN` | no       | `0`     | `@wpas/db` |
| `DATABASE_POOL_MAX` | no       | `10`    | `@wpas/db` |

## Working with AI agents

[`AGENTS.md`](AGENTS.md) contains the rules coding agents follow: the stack, package
boundaries and the `.ai/` workflow (specs, run logs, lessons). Next.js-specific agent rules
are generated into [`packages/app/AGENTS.md`](packages/app/AGENTS.md) by `next dev`.
