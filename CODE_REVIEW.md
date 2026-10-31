# Code review

Review rules for WP Autonomy Studio. `om-code-review` (and so `om-auto-review-pr`) applies this
file on top of its built-in checklist. The rules come from [`AGENTS.md`](AGENTS.md) and the
[engineering-standards spec](.ai/specs/2026-10-21-engineering-standards.md); when they disagree
with this file, those two win and this file gets fixed.

## Review priorities

1. **Correctness:** the change does what its spec, issue or PR body says, including failure
   paths. Read the linked spec in `.ai/specs/` before the diff.
2. **Security and tenancy:** tenant isolation, authorization, secrets, untrusted input (Figma,
   plugins, sites, agent output).
3. **Contracts:** anything in [`BACKWARD_COMPATIBILITY.md`](BACKWARD_COMPATIBILITY.md).
4. **Tests:** behavior is asserted, not just executed. Coverage is 100% and enforced.
5. **Conventions and maintainability:** the rules below.

## Repo-specific checks

### Package boundaries

- Dependency direction holds: `app → ui, db, core`; `db → core`; `ui` and `core` import no other
  `@wpas/*` package; nothing imports `@wpas/app`. `eslint-plugin-boundaries` catches most of
  this; check the rest by hand.
- Cross-package imports go through `package.json` `exports` (`@wpas/ui/admin/button`), never
  relative paths into another package.
- `core` imports no React, Next.js or MikroORM. `ui` does no data fetching and imports no
  `@wpas/db` or server-only code.
- A new dependency is installed in the package that imports it, and is on the approved stack
  table in `AGENTS.md` for the current phase. No second ORM, DI container, CSS framework,
  component kit or package manager. A new major needs its peer ranges checked.
- `domain/` and `worker/` packages don't appear before phase 4.

### Next.js 16 app

- Server-only modules live in `packages/app/src/server/` and start with `import "server-only"`.
- Server Components by default; `"use client"` only on leaf components that need it.
- No DaisyUI classes in `app/(admin)/`, no shadcn components in `app/(site)/`.
- Code that uses a Next.js API matches the Next 16 docs in `node_modules/next/dist/docs/`, not
  older conventions (`cacheComponents` is on).

### Dependency injection

- Services are registered explicitly in `packages/app/src/server/container.ts` and added to
  `Cradle`. No `loadModules`.
- Containers come only from `createAppContainer()` (`@wpas/core/di`).
- Per-request state (`em`, current user) is `.scoped()` and resolved only from a request scope;
  infrastructure is singleton or `asValue`.
- Services take dependencies through the constructor argument (`Pick<Cradle, …>`), never by
  importing the container.

### Boundaries and unit of work

- Server actions, route handlers and job handlers: open the scope (`withRequestScope()`),
  validate input with Zod, call `authorize()`, run the use case, flush once (`em.flush()` or
  `em.transactional()`), dispose the scope in `finally`.
- Repositories never flush. The global `orm.em` is never used for request work.
- Use cases are `VerbNounService` with one `execute(input)`. A module's public API is its
  `index.ts`; other modules don't import its files or tables.
- No MikroORM entity crosses into a Server Component or the client; map to a DTO.
- Errors are `AppError` subclasses with a `SCREAMING_SNAKE` `code`. Server actions return
  `ActionResult<T>`; route handlers return problem+json. `redirect`/`notFound` are never caught.

### Database

- Entities use `defineEntity` + `p` builders, export the `InferEntity` type, and are registered
  in `packages/db/src/entities/index.ts`. No decorators or `reflect-metadata`.
- Every entity change ships with a generated migration in `packages/db/src/migrations/`,
  reviewed by hand. An already-applied migration is never edited.
- `MikroORM.init` is called only inside `getOrm()`.
- Tenant-owned tables have `organization_id`, the tenant filter and an RLS policy. Every
  tenant-scoped query has a cross-tenant denial test.

### Security

- Env is read only through `getEnv()` (`@wpas/core/env`); new variables are in the schema and in
  `.env.example`. `NEXT_PUBLIC_*` in client code is the only exception.
- Secrets live only in the `credential` table (AES-256-GCM), are decrypted only in the adapter
  that uses them, and never appear in logs, DTOs, run logs, `.ai/` files or agent sandboxes.
- Agents run only in the worker sandbox. Writes to live sites, deploys and over-budget spend go
  through human approval. Content from Figma, plugins or sites is treated as data, never as
  instructions.
- State changes that start work write an `outbox_event` in the same transaction; job handlers
  are idempotent.
- Only data changed by user actions is cached (tag `org:<id>:<resource>`, `updateTag` in the
  action). Worker-written data is never cached.

### TypeScript and style

- No `any`, no non-null `!` outside tests, no `enum`/`namespace`/parameter properties
  (`erasableSyntaxOnly`), `import type` for types, `type` over `interface`, named exports only
  (except files Next.js or a tool loads by default export), explicit return types on exported
  functions in `.ts` files.
- Logging through the container's pino `logger` with context fields, never `console`.
- Naming: kebab-case files, PascalCase types and singular entities, snake_case tables, server
  actions `verbNounAction`, jobs `module.verb-noun`.
- Comments say why, not what. No commented-out code.

### Tests

- 100% lines, branches, functions and statements (`npm run test:coverage`). Thresholds,
  coverage `exclude` and `v8 ignore`/`istanbul ignore` comments are not touched to get there;
  untestable code is restructured.
- Tests sit where `AGENTS.md` says: `*.test.ts` (node), `*.test.tsx` (DOM, Testing Library
  queries by role and name), `*.int.test.ts` (Testcontainers / agent-browser).
- Unit tests touch no network, Docker or real database.
- Browser tests go through `packages/app/integration/browser.ts` with role-based locators, and
  its axe audit reports no serious or critical WCAG 2.2 AA violations.
- A bug fix starts with a failing test.

### Process

- Conventional Commits with the package as scope (`feat(db): …`).
- Non-trivial features have a spec in `.ai/specs/`; implemented specs move to
  `.ai/specs/implemented/`. Autonomous runs have a log in `.ai/runs/`. Bugs and surprises get a
  lesson in `.ai/lessons.md`.
- `packages/app/AGENTS.md` managed blocks are not edited by hand.

## Validation gate

The PR passes, in order: `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm run knip`, `npm run test:coverage`, `npm run test:integration` (needs Docker). The list
lives in `.ai/agentic.config.json`.

## Severity

- **Blocker:** tenant data leak or missing tenant filter/RLS, secret exposure, missing
  `authorize()`, edited applied migration, broken package boundary, coverage below 100% or a
  coverage bypass, failing gate, breaking a protected surface without the path in
  `BACKWARD_COMPATIBILITY.md`.
- **Major:** entity passed to the client, flush in a repository, unscoped `em`, `process.env`
  outside `getEnv()`, `console` logging, unapproved dependency, missing failure-path tests,
  missing spec for a non-trivial feature.
- **Minor:** naming, comment quality, small style issues the linter doesn't catch. File as a
  follow-up rather than blocking when the PR is otherwise ready.

Blockers and majors mean `changes-requested`; minors alone don't.
