# Backward compatibility

The surfaces below are contracts: other code, deployed environments or operators depend on
them. Review skills check changes against this file, and implementation skills warn when a
change breaks one. The project is pre-1.0 with no external consumers yet, so the required path
is light, but it is not optional: a breaking change is made on purpose, in one PR, with every
consumer updated and the break stated in the PR body.

## Surfaces

### Internal package exports (`@wpas/core`, `@wpas/db`, `@wpas/ui`)

The `exports` maps in each `packages/*/package.json` are the public API between packages:

- `@wpas/core`: `./di`, `./env`, `./errors`, `./logger`
- `@wpas/db`: `.` (ORM config, `getOrm`/`closeOrm`, `entities`, `EntityManager` type) and
  `./testing`
- `@wpas/ui`: `./admin/*`, `./site/*`, `./hooks/*`, `./lib/*`, `./styles/*`

**Breaking:** removing or renaming an export path or an exported symbol, changing a function
signature or return type incompatibly, changing a component's required props.
**Path:** update every consumer in the same PR (all consumers are in this monorepo), and keep
`npm run typecheck` and `npm run knip` green. No deprecation window is needed while every
consumer lives in the repo.

### Database schema and migrations (`packages/db/src/migrations/`)

**Breaking:** editing or deleting a migration that has been applied anywhere; dropping or
renaming a column or table that running code still reads; a migration without a working
`down`.
**Path:** new migrations only, generated with `npm run db:migration:create` and reviewed. Use
expand–contract for renames and drops (add, backfill, switch readers, then drop in a later
migration). Label the PR `risk-high` and include a rollback plan in the PR body.

### Environment variables (`@wpas/core/env` schema, `.env.example`)

Current variables: `DATABASE_URL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`, `LOG_LEVEL`,
`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, plus `NODE_ENV`.

**Breaking:** renaming or removing a variable, making an optional variable required, or
changing its accepted format or default in a way that changes behavior.
**Path:** update the schema, `.env.example` and CI env in the same PR, and call out the change
in the PR body so operators update their environments.

### HTTP routes (`packages/app/app/`)

- `GET /api/health` returns `{ status: "ok" | "degraded", db: "up" | "down" }` with 200 or 503.
  Monitoring and the integration stack depend on this shape.
- Page routes: `/` (site) and `/admin`.

**Breaking:** removing or moving a route, changing a response shape or status semantics,
changing the problem+json error format route handlers return.
**Path:** keep the old shape or add a new route alongside; update integration tests in
`packages/app/integration/`.

### Server actions and error codes

`ActionResult<T>` (`@wpas/core/errors`) and the `code` values on `AppError` subclasses are read
by the UI and, later, by the worker.

**Breaking:** changing the `ActionResult` shape or renaming/removing an error `code`.
**Path:** update every caller in the same PR; error codes are only ever added or deprecated,
not reused with a new meaning.

### Repository commands and config

The npm scripts in the root `package.json` (listed in `AGENTS.md`), `.ai/agentic.config.json`,
`compose.yaml`, and the `.ai/` directory layout are used by CI, git hooks and agents.

**Breaking:** renaming or removing a script CI or the validation gate calls; changing the
`.ai/` layout or config keys skills read.
**Path:** update `.github/workflows/`, `lefthook`, `AGENTS.md`, `SDLC.md` and the config in the
same PR.

## Planned surfaces

Add a section here when each one lands: pg-boss job names and payloads (`module.verb-noun`,
phase 4; payloads must stay readable by the previous worker version during a deploy), outbox
event types, SSE event formats, MCP tool schemas exposed to agents (phase 6), and the
`theme.json` / generated WordPress code contract (phase 7).
