# WP Autonomy Studio

A Next.js application in an npm-workspaces monorepo, backed by PostgreSQL. This application automates the development process for WordPress-based websites through the use of autonomous agents. It streamlines the implementation of unique themes—derived from designs created in Figma or similar design tools—as well as code generation, ongoing maintenance, and the development of custom functionalities. The platform is built upon WordPress best practices while allowing for the integration of your own custom solutions, existing plugins, or themes.

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

| Command                             | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `npm run dev`                       | Next.js dev server (Turbopack)                       |
| `npm run build` / `npm run start`   | production build / server                            |
| `npm run format` / `format:check`   | Prettier                                             |
| `npm run lint`                      | ESLint (type-aware rules, package boundaries)        |
| `npm run typecheck`                 | TypeScript check in every workspace                  |
| `npm run knip`                      | unused files, exports and dependencies               |
| `npm run test`                      | unit tests (Vitest, Node + jsdom)                    |
| `npm run test:coverage`             | unit tests with the 100% coverage thresholds         |
| `npm run test:integration`          | build, then tests against an ephemeral DB + app      |
| `npm run check`                     | format, lint, typecheck, knip, unit tests + coverage |
| `npm run db:migration:create`       | generate a migration from entity changes             |
| `npm run db:migration:up` / `:down` | apply / revert migrations                            |
| `npm run db:migration:pending`      | list pending migrations                              |

Unit tests must cover 100% of the code (lines, branches, functions, statements); CI fails
otherwise. Integration tests need Docker and a browser for
[agent-browser](https://agent-browser.dev) (`npx agent-browser install`, once). Each run
starts PostgreSQL in Testcontainers, applies the migrations, starts the production build on a
free port against it, drives the pages with agent-browser (including an axe accessibility
audit) and tears everything down. It never touches your local database or `npm run dev`.

Every pull request runs these checks in GitHub Actions: build, lint, typecheck + knip, unit
tests with coverage, integration tests, and security scans.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with the package
as scope (`feat(db): …`). `npm install` installs lefthook git hooks that format and lint
staged files and check the commit message.

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
│   ├── core/   @wpas/core  framework-agnostic building blocks (DI, env, errors, logger)
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

Awilix containers are created with `createAppContainer()` from `@wpas/core/di`, which uses:

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

| Variable                 | Required | Default | Used by                                  |
| ------------------------ | -------- | ------- | ---------------------------------------- |
| `DATABASE_URL`           | yes      | –       | `@wpas/db`                               |
| `DATABASE_POOL_MIN`      | no       | `0`     | `@wpas/db`                               |
| `DATABASE_POOL_MAX`      | no       | `10`    | `@wpas/db`                               |
| `LOG_LEVEL`              | no       | `info`  | app logger                               |
| `SENTRY_DSN`             | no       | –       | server error reporting (off when empty)  |
| `NEXT_PUBLIC_SENTRY_DSN` | no       | –       | browser error reporting (off when empty) |

All variables are validated when the server starts (`packages/app/instrumentation.ts`) against
the Zod schema in `packages/core/src/env.ts`. If any is invalid, the server logs every bad
variable and answers every request with an error until the environment is fixed.

### Target architecture (roadmap)

The approved design is in
[`.ai/specs/2026-10-21-engineering-standards.md`](.ai/specs/2026-10-21-engineering-standards.md).
In short:

- **Control plane:** this Next.js app (users, organizations, sites, designs, runs,
  approvals).
- **Execution plane:** a separate worker process (`@wpas/worker`). It takes jobs from
  Postgres (pg-boss) and runs each agent session (Claude Agent SDK) in a disposable,
  hardened Docker sandbox with WordPress, WP-CLI, Composer, Node and Playwright. The sandbox
  holds no credentials. GitHub and live-site operations go through host-side tools, and
  risky ones need a human approval.
- **PostgreSQL is the only stateful service:** app data with row-level security per
  organization, the job queue, auth (Better Auth) and run event streams (SSE to the admin).
- **Generated WordPress code:** block themes with `theme.json` built from Figma design
  tokens, gated by WPCS, PHPStan, Plugin/Theme Check, accessibility (WCAG 2.2 AA) and
  per-section visual diffs against the Figma frames.

Rollout phases: 1 tooling, 2 identity & tenancy, 3 sites & credentials, 4 runs & jobs,
5 sandbox, 6 agents, 7 theme build, 8 maintenance. Each phase gets its own spec in
`.ai/specs/`.

## Working with AI agents

[`AGENTS.md`](AGENTS.md) contains the rules coding agents follow: the stack, package
boundaries and the `.ai/` workflow (specs, run logs, lessons). Next.js-specific agent rules
are generated into [`packages/app/AGENTS.md`](packages/app/AGENTS.md) by `next dev`.
