# Engineering standards, tech stack and design patterns

- **Status:** approved (2026-10-21; decisions recorded in "Decisions")
- **Created:** 2026-10-21
- **Builds on:** `.ai/specs/implemented/2026-10-20-monorepo-foundation.md`
- **Research:** run log `.ai/runs/2026-10-21-engineering-standards-spec.md`. Versions checked
  against npm, Packagist and the wordpress.org API on 2026-10-21. Claims marked
  **[unverified]** must be checked before anyone relies on them.

## Problem

`README.md` describes the product. WP Autonomy Studio runs autonomous agents that:

- build unique WordPress themes from Figma (or similar) designs;
- generate custom code (plugins, blocks);
- integrate existing plugins and themes;
- maintain WordPress sites over time.

The foundation spec fixed the web stack: Next.js 16, MikroORM v7, Awilix, DaisyUI and shadcn/ui.
It said nothing about the parts that make this product hard:

- the agent runtime;
- durable long-running jobs;
- sandboxed WordPress environments;
- the Figma → `theme.json` pipeline;
- the quality bar for the PHP/JS the agents produce;
- multi-tenancy, secrets, auth, testing, observability and CI.

Without a spec, every feature would decide these again.

## Goals / Non-goals

**Goals**

- One decided stack for the platform (control plane) and the agent execution plane.
- Design patterns and coding standards for platform code.
- A quality bar for generated WordPress code that the agents must meet and CI can enforce.
- A phased rollout, so each part becomes its own implementation spec.

**Non-goals**

- Implementing anything. Each phase in "Rollout" gets its own spec.
- Choosing a hosting provider (still open from the foundation spec; see the open questions).
- Pricing and billing design.

## 1. Architecture overview

The system has two planes.

- **Control plane** (Next.js app): users, organizations, sites, designs, runs, approvals,
  and the UI.
- **Execution plane:** a worker process that takes jobs from Postgres and runs each agent
  session inside a disposable sandbox container.

```
┌──────────── Control plane ────────────┐      ┌────────── Execution plane ──────────┐
│ Next.js (@wpas/app)                   │      │ Worker (@wpas/worker, Node process) │
│  admin UI ── server actions           │      │  pg-boss work() handlers            │
│  route handlers (webhooks, SSE, API)  │      │  pipeline stage runners             │
│  application services (DI scope)      │      │  sandbox manager (dockerode)        │
└──────┬─────────────────▲──────────────┘      └──────┬──────────────────┬──────────┘
       │ outbox → pg-boss│ LISTEN/NOTIFY              │ create/kill      │ host-side tools
       ▼                 │ + run_event rows           ▼                  ▼ (git push, WP ops)
┌──────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ PostgreSQL                           │◀─────│ Sandbox container (one per job)       │
│  app schema (RLS) · pgboss · auth    │events│  Claude Agent SDK · WordPress + DB    │
└──────────────────────────────────────┘      │  WP-CLI · Composer · Node · Playwright│
                                              │  no secrets · egress allowlist proxy  │
                                              └───────────────────────────────────────┘
```

Principles:

1. **Postgres is the only stateful infrastructure.** It holds app data, the job queue, auth
   and event streams. No Redis.
2. **Agents never run in the Next.js process.** Long sessions, shell access and memory use
   (about 1 GiB per agent) belong in the worker and sandbox tiers.
3. **The sandbox holds no credentials.** The Anthropic key is injected by a host proxy.
   GitHub and live-site operations happen in host-side tools the agent calls over MCP.
4. **Every agent action that leaves the sandbox is policy-checked.** Risky ones need a
   human approval.
5. **Deterministic checks decide quality, not the agent.** The agent's work is accepted only
   when lint, static analysis, tests, accessibility and visual diff all pass.

## 2. Tech stack

### 2.1 Already fixed (foundation spec, unchanged)

Next.js 16.4 (App Router, Turbopack, `cacheComponents`), React 19.3, TypeScript strict,
PostgreSQL, MikroORM 7.2, Awilix 13, Tailwind 4, DaisyUI 5 (site), shadcn/ui (admin),
npm workspaces, Node ≥ 24, ESLint 9.

### 2.2 Additions: platform

| Concern                    | Choice (version)                                                                                                                                                                             | Rejected, and why                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth, orgs, RBAC, API keys | **Better Auth 1.7** with its built-in Postgres adapter on its own `pg.Pool`, schema `auth`. Plugins: `organization`, `access`, `two-factor`, and `@better-auth/api-key` (a separate package) | Auth.js v5: still beta. Clerk: SaaS. No MikroORM v7 adapter exists for either Better Auth or Auth.js                                               |
| Validation                 | **Zod 4.6**                                                                                                                                                                                  | Valibot: smaller ecosystem (RHF resolvers, Better Auth)                                                                                            |
| Env                        | Zod schema in `@wpas/core` (optionally `@t3-oss/env-core` 0.13), parsed at boot                                                                                                              | hand-rolled `requireEnv` (what the repo has now)                                                                                                   |
| Job queue / scheduling     | **pg-boss 12.38** (Postgres ≥ 13)                                                                                                                                                            | Temporal: separate cluster. Trigger.dev and Inngest self-hosted need Redis. Graphile Worker: no cancellation or per-key concurrency. BullMQ: Redis |
| Forms (admin)              | **React Hook Form 7.90** + `@hookform/resolvers` 6 + shadcn **Field** components                                                                                                             | TanStack Form: fine, but has fewer shadcn examples                                                                                                 |
| i18n (admin)               | **Deferred.** The admin is English-only until a second locale is a real requirement; then adopt **next-intl** in its own spec                                                                | adopting next-intl now: its `cacheComponents` interplay is unverified and it adds a catalog step to every UI change                                |
| Logging                    | **pino 10** (+ `pino-pretty` in dev only)                                                                                                                                                    | winston: slower, and its JSON is less standard                                                                                                     |
| Tracing                    | OpenTelemetry via `instrumentation.ts` + **`@vercel/otel` 2.1**, OTLP exporter                                                                                                               | —                                                                                                                                                  |
| Error tracking             | **`@sentry/nextjs` 11** SDK (and `@sentry/node` in the worker), configured only by `SENTRY_DSN`; no DSN = disabled. The backend (Sentry SaaS or GlitchTip) is a deployment choice            | self-hosted Sentry: heavy to run                                                                                                                   |
| Realtime UI                | **SSE** route handler, fed by Postgres `LISTEN/NOTIFY` and the `run_event` table                                                                                                             | WebSockets: need a custom server. Polling: latency                                                                                                 |

### 2.3 Additions: agent execution plane

| Concern                      | Choice (version)                                                                                                                                                                                                                                                                                                  | Rejected, and why                                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent runtime                | **`@anthropic-ai/claude-agent-sdk` 0.3.x** (pinned exactly), running **inside** the sandbox                                                                                                                                                                                                                       | Vercel AI SDK and raw Messages API: we'd have to build every file/shell tool, permission check and compaction step ourselves. Claude Managed Agents: the agent loop and tool I/O go through Anthropic's control plane; keep it as a later option |
| Single LLM calls             | **`@anthropic-ai/sdk` 1.0** (classification, summaries, extraction)                                                                                                                                                                                                                                               | —                                                                                                                                                                                                                                                |
| Models                       | Orchestrator `claude-opus-5-5` (effort `high`). Workers/subagents `claude-sonnet-5-5`. Triage `claude-haiku-5-5`. `claude-fable-5-1` only by explicit opt-in (it costs more and needs 30-day data retention)                                                                                                      | —                                                                                                                                                                                                                                                |
| Agent tools                  | Built-in SDK tools in the sandbox, plus our MCP servers (`@modelcontextprotocol/sdk` 1.32), served by the worker                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                |
| Sandbox                      | **One ephemeral Docker container per job via `dockerode` 5**, behind a `SandboxProvider` port so a hosted vendor can be swapped in later. Hardened, gVisor `runsc` where I/O allows, egress allowlist proxy                                                                                                       | wp-env inside a sandbox: needs Docker-in-Docker. Firecracker: too much to operate for now. E2B, Daytona, Modal, Cloudflare Sandbox: viable fallbacks if we stop self-hosting                                                                     |
| Quick WP previews            | **`@wp-playground/cli` 3.1** (WASM PHP, SQLite)                                                                                                                                                                                                                                                                   | not used for parity testing: no MySQL                                                                                                                                                                                                            |
| Figma                        | **REST API first** (`@figma/rest-api-spec`): node tree, styles, components, image exports, and Variables on Enterprise plans. The **remote Figma MCP server** is an optional enrichment behind a `DesignContextProvider` port, used only when the org's connection supports it; the pipeline must work without it | MCP as the primary source: per-user OAuth from headless workers is unverified. Raw Figma→HTML exporters                                                                                                                                          |
| Design tokens                | **DTCG 2025.10** JSON → **Style Dictionary 5.7** with a custom `theme.json` format                                                                                                                                                                                                                                | hand-copied values                                                                                                                                                                                                                               |
| GitHub                       | **GitHub App** (`@octokit/app` 16); short-lived installation tokens per job, used only on the host                                                                                                                                                                                                                | PATs, tokens inside the sandbox                                                                                                                                                                                                                  |
| Browser automation (sandbox) | **Playwright 1.64** for generated WordPress code in the sandbox image (screenshots, e2e, axe; `@wordpress/e2e-test-utils-playwright`)                                                                                                                                                                             | Cypress: no WordPress utilities                                                                                                                                                                                                                  |
| Visual diff                  | **odiff 4.5** (large pages) / **pixelmatch 8** (in-process)                                                                                                                                                                                                                                                       | —                                                                                                                                                                                                                                                |
| LLM tracing UI               | **Our own run view** in the admin, built from `run_event` + `run_usage` (we need it anyway for users). OTel export from the Agent SDK and worker is optional, to any OTLP backend                                                                                                                                 | Arize Phoenix: one more service, Elastic License 2.0. Self-hosted Langfuse: needs ClickHouse, Redis and S3                                                                                                                                       |

### 2.4 Additions: tooling

| Concern            | Choice (version)                                                                                                                                                                                                                                          | Notes                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Lint               | ESLint 9 + **typescript-eslint 8.72** `strictTypeChecked` + `stylisticTypeChecked`, `projectService: true`                                                                                                                                                | stay on ESLint 9 for now; try ESLint 10 in its own PR                           |
| TypeScript         | **pin `~5.9`**                                                                                                                                                                                                                                            | TS 7.0 (native) is `latest`, but typescript-eslint supports only `<6.1`         |
| Format             | **Prettier 3.9** + `prettier-plugin-tailwindcss`                                                                                                                                                                                                          | ESLint checks correctness only                                                  |
| Package boundaries | **eslint-plugin-boundaries 7** (+ `no-restricted-imports`)                                                                                                                                                                                                | turns the AGENTS.md dependency rules into lint errors                           |
| Dead code          | **knip 6**                                                                                                                                                                                                                                                | CI warning at first, error later                                                |
| Tests              | **Vitest 5** (`test.projects`), Testing Library + jsdom, `@testcontainers/postgresql` 12, **agent-browser 0.39** (platform browser tests + built-in axe), **MSW 3** **[3.x API unverified]**. Amended by `implemented/2026-10-21-ci-and-test-coverage.md` | Playwright for platform tests: a second browser-test tool next to agent-browser |
| Git hooks          | **lefthook 2** (staged ESLint + Prettier; commitlint)                                                                                                                                                                                                     | husky + lint-staged: two tools for one job                                      |
| Commits            | Conventional Commits via `@commitlint/cli` 21, scopes = package names                                                                                                                                                                                     | —                                                                               |
| Dependencies       | **Renovate**, grouped by monorepo, weekly schedule                                                                                                                                                                                                        | —                                                                               |
| CI                 | GitHub Actions; CodeQL, gitleaks, Dependency Review, `npm audit`, CycloneDX SBOM                                                                                                                                                                          | —                                                                               |
| Deploy artifact    | `output: "standalone"` multi-stage Dockerfile on `node:24-slim`, non-root                                                                                                                                                                                 | target host still undecided                                                     |

## 3. Package layout (proposed changes)

```
packages/
  app/      @wpas/app      Next.js: routes, server actions, route handlers, composition root
  core/     @wpas/core     DI helpers, env schema, AppError, Result types, crypto (no framework)
  db/       @wpas/db       entities, migrations, repositories, ORM lifecycle, RLS filters
  domain/   @wpas/domain   NEW — business logic shared by app and worker: modules (use cases,
                           policies, ports), pipeline definitions, external API adapters
  worker/   @wpas/worker   NEW — pg-boss process: job handlers, outbox relay, sandbox manager,
                           agent runner, prompts, MCP host tools, eval suite
  ui/       @wpas/ui       unchanged
sandbox/                   NEW — Dockerfile(s) for the sandbox image + entrypoint (not a workspace package)
```

Dependency direction (extends AGENTS.md rule 1):

```
app    → ui, domain, db, core
worker → domain, db, core
domain → db, core
db     → core
ui, core → nothing internal
```

- `@wpas/domain` exists because the app **and** the worker run the same use cases, and the
  worker can't import `@wpas/app`. Until the worker exists, use cases may live in
  `packages/app/src/server/modules/` and move later.
- The worker has its own composition root (`packages/worker/src/container.ts`) and builds
  the container with the same `createAppContainer()`.
- Each package keeps the source-only `exports` rule. The worker runs with `tsx watch` in
  dev and is bundled into one file with **esbuild** for production. Node's built-in type
  stripping can't be used: it refuses `.ts` files under `node_modules`, which is where the
  workspace packages are linked.
- Why two new packages and not three: agent code (prompts, policies, MCP tools, evals) is
  only ever run by the worker, so it lives in `packages/worker/src/agents/`. A separate
  package would add a boundary with a single consumer. Split it out only if a second
  consumer appears.
- Folder shape inside `@wpas/domain`, the same for every module, so humans and LLMs can
  predict where code lives:

  ```
  packages/domain/src/
    modules/<module>/
      <use-case>.ts          one exported service per use case
      <module>.policy.ts     pure rules (authorization, state transitions)
      <module>.ports.ts      interfaces the module needs (e.g. FigmaClient)
      <module>.errors.ts     AppError subclasses
      index.ts               the module's public API; other modules import only this
    pipelines/               run/stage definitions (data, not code paths)
    adapters/<service>/      implementations of ports (figma, github, wordpress, anthropic)
  ```

  Entities and repositories stay in `@wpas/db` (AGENTS.md).

## 4. Platform design patterns

### 4.1 Modules (bounded contexts)

The modules are:

| Module         | What it owns                                                 |
| -------------- | ------------------------------------------------------------ |
| `identity`     | users, organizations, members, roles (backed by Better Auth) |
| `sites`        | WordPress sites, environments, credentials                   |
| `designs`      | Figma files, frames, token sets, mapping manifests           |
| `runs`         | agent runs, stages, events, approvals, usage                 |
| `maintenance`  | schedules, update plans, vulnerability findings              |
| `integrations` | GitHub, Figma connections                                    |

Each module has three kinds of code (file layout in section 3):

- **Rules:** entities (in `@wpas/db`), value objects, errors, `*.policy.ts`. Pure, no I/O.
- **Use cases:** one service per use case (`StartThemeBuildService`,
  `ApproveStageService`) with a single `execute(input)` method. They depend on repositories
  and **ports**, which are interfaces.
- **Adapters:** in `src/adapters/` (WP REST, Figma, GitHub) and in the worker (sandbox
  driver). They implement the ports and are wired in the composition roots.

Rules:

- Modules never import `adapters/`; only composition roots do. Lint enforces this with
  boundaries.
- Modules talk to each other only through the other module's application services or
  through domain events. They never query another module's tables.

### 4.2 Request and job lifecycle (unit of work)

1. A **boundary** starts the scope: a server action, a route handler, or a job handler.
   It calls `createRequestScope()` (in the worker, one scope per job).
2. Zod validates the input. `authorize(actor, action, resource)` checks the actor's
   permission.
3. An application service runs. It mutates entities through repositories. **Repositories
   never call `flush()`.**
4. The boundary calls `em.flush()` once, or wraps multi-step work in `em.transactional()`.
5. It writes `outbox_event` rows in the same transaction as the state change.
6. It disposes the scope in `finally`.

### 4.3 Data access layer

- Only `src/server/**` (app) and `@wpas/domain` / `@wpas/worker` touch `em`.
- Data that reaches a React Server Component or the client is a **DTO** (a plain object with
  explicitly chosen fields), never a MikroORM entity.
- Entities use `defineEntity` + `InferEntity`. Custom repositories are registered as scoped
  Awilix services.

### 4.4 Domain events and the transactional outbox

- State changes that start work, such as `DesignImported` or `StageApproved`, write an
  `outbox_event` row in the same transaction.
- The worker's outbox relay turns those rows into pg-boss jobs. A job's `singletonKey` is
  the event id, so delivery is effectively once even though the relay delivers at least once.
- Job handlers must be **idempotent**. Each handler loads the current state, checks whether
  the work has already been done, and only then acts.

### 4.5 Errors

- `@wpas/core` exports `AppError`. It carries a `code` (`NOT_FOUND`, `FORBIDDEN`,
  `CONFLICT`, `VALIDATION`, `RATE_LIMITED`, `EXTERNAL_FAILURE`, …), plus `httpStatus` and
  `expose`.
- Domain and application code **throws** `AppError` subclasses. When a business outcome is
  expected (for example `QualityGateResult`), return a discriminated union instead.
- Boundaries map errors to results:
  - server actions return `ActionResult<T> = { ok: true, data } | { ok: false, code, message, fieldErrors? }`;
  - route handlers return `application/problem+json`;
  - job handlers decide between retry (transient) and fail (permanent) based on the error
    `code`.
- Never catch Next.js control-flow errors (`redirect`, `notFound`). Rethrow them.
- No neverthrow-style `Result` types everywhere. They fight the throw-based Next.js APIs.

### 4.6 Multi-tenancy

- The tenant is the **Organization**. Every tenant-owned table has
  `organization_id uuid not null`, and it leads the table's composite indexes.
- One MikroORM filter declared with `rls: true` produces both the app-level `WHERE` and a
  Postgres RLS policy (MikroORM v7). Each request or job scope calls
  `em.setFilterParams('tenant', { orgId })`. That sets the session variable with
  `set_config(…, true)` for each transaction, so it is pgBouncer-safe. If the variable is
  unset, the query fails (fail-closed).
- Two database roles:
  - `DATABASE_URL`: the app and worker role. It owns no tables, isn't a superuser and is
    subject to RLS.
  - `DATABASE_MIGRATION_URL`: the owner role, used only by migrations.
- QueryBuilder code must call `qb.applyFilters()`. RLS is the backstop, not the first line.
- System jobs that cross tenants, such as the vulnerability feed sync, use an explicit
  `SystemActor` and a dedicated role. They never just switch off the filter.
- **[unverified in this repo]:** prove MikroORM v7 RLS end to end in the identity/tenancy
  spec before building on it.

### 4.7 Secrets (WP application passwords, SSH keys, client API keys)

- Secrets are stored only in the `credential` table, never inline on other entities.
- Use envelope encryption with `node:crypto` AES-256-GCM:
  - a random 12-byte IV per record;
  - AAD = `orgId|table|id|field`;
  - stored format `v1.<kid>.<iv>.<tag>.<ct>` (base64url).
- Keys come from a keyring `{ kid: key }` in env (`CREDENTIALS_KEYRING`) or a KMS. One
  `kid` is active for new writes. To rotate: add a key, mark it active, and run a background
  job that re-encrypts existing records.
- Decrypt only inside the infrastructure adapter that uses the secret. Never log it, return
  it in a DTO, or pass it into a sandbox.

### 4.8 Next.js 16 rules

- `proxy.ts` (it replaced `middleware.ts`) does **optimistic** redirects only. Auth is
  enforced in the data access layer and in every action and handler.
- With `cacheComponents`:
  - Read the session inside `<Suspense>`.
  - Use `'use cache: private'` for per-user reads.
  - Shared `'use cache'` functions take `orgId` as an argument and tag their results
    `org:<orgId>:<resource>`.
- Invalidation:
  - Server actions use `updateTag(tag)` (read-your-own-writes).
  - Route handlers and the worker use `revalidateTag(tag, 'max')`. The single-argument
    form is deprecated.
  - **No cross-process invalidation.** Data the worker writes (runs, stages, events,
    usage, findings) is never put in `'use cache'`; it is read dynamically and pushed live
    over SSE. Only data changed by user actions is cached, so `updateTag` in the action
    covers it.
- Server actions are for UI mutations. Route handlers are for webhooks, API-key clients,
  SSE and health checks.
- The SSE route must stay dynamic **[confirm in `node_modules/next/dist/docs/`]**.

## 5. Agent runtime standards

### 5.1 Pipeline

A **Run** is an ordered list of **Stages**. The pipeline's state lives in our tables, and
pg-boss only carries "run stage X of run Y".

```
theme-build:   import-design → extract-tokens → plan-structure → scaffold-theme
               → implement-sections (fan-out per pattern) → quality-gates → visual-qa
               → [approval] → open-pr → [approval] → deploy-staging
maintenance:   snapshot → plan-updates → apply-update (one component at a time)
               → quality-gates → visual-diff → [approval] → promote
feature:       spec → [approval] → implement → quality-gates → [approval] → open-pr
```

- Stages are **idempotent and resumable**. Each stage writes its output artifacts (files,
  manifests, reports) before it is marked done.
- Concurrency:
  - Per site, `group: { id: siteId }` with `groupConcurrency: 1` on mutating stages.
  - Per organization, a limit on parallel sandboxes.
- pg-boss limits:
  - `expireInSeconds` ≤ 86400.
  - `heartbeatSeconds` is 30.
  - Retries with backoff for transient errors only.
- Cancelling a run calls `boss.cancel()`. The handler watches its abort signal, then kills
  the container and records `cancelled`.

### 5.2 Agent session rules

- Pin exact versions of the Agent SDK and the sandbox image. Upgrades go through a PR that
  reruns the eval suite (section 10.4).
- Every session sets:
  - `maxTurns`, because the SDK has no session timeout;
  - `maxBudgetUsd`, from the org's plan and the stage type;
  - `settingSources: []`;
  - a per-job `CLAUDE_CONFIG_DIR`;
  - `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`;
  - an explicit `effort` (`high` for coding).
- Use `allowedTools` / `disallowedTools` allowlists per stage type, and a `PreToolUse` hook
  for hard policy. The hook runs before permission modes and can't be bypassed.
- Mirror transcripts to Postgres or object storage with a `SessionStore` adapter. Approvals
  that wait a long time end the stage. The run resumes later with
  `query({ resume: sessionId, sessionStore })`.
- Prompts and agent definitions are **versioned code** in `packages/worker/src/agents/`. Each run records
  the prompt version, model, SDK version and sandbox image digest.
- Agent instructions come from the repo's own `AGENTS.md`-style rules for generated code
  (section 6), shipped as skills or system-prompt sections. They don't come from tenant
  input.
- Treat everything from Figma text, plugin code, the site's database or web pages as
  **untrusted data**. It never changes policy, tools or approval requirements.

### 5.3 Tools and approval gates

- **Sandbox-local actions are allowed by policy:** file edits, WP-CLI against the sandbox
  WP, composer and npm through the proxy, and Playwright.
- **Host-side MCP tools** are served by the worker and scoped to the job's org and site:
  - `figma.*`
  - `github.open_pr`, `github.push_branch`
  - `site.*` (staging and live WP operations)
  - `request_approval`
  - `report_artifact`
- **These always require a human approval:**
  - any write to a live (production) site;
  - deploy and promote;
  - plugin or theme install on a non-sandbox environment;
  - database import or search-replace outside the sandbox;
  - spend above the run budget.
- How an approval works:
  1. The tool creates an `approval_request` row, a notification goes out, and the stage
     parks.
  2. When a person decides, a job continues the run.

### 5.4 Sandbox standards

- One image (`sandbox/`) with:
  - php-fpm + nginx;
  - MariaDB 10.11+ (same container, or a sidecar on a per-job network);
  - WP-CLI 2.12, Composer;
  - Node 24, git;
  - Playwright + Chromium;
  - the PHP QA tools (section 6.3);
  - the agent entrypoint.
- The image is versioned, has an SBOM, and is rebuilt weekly for security patches.
- Runtime hardening:
  - `--cap-drop ALL`, `no-new-privileges`, default seccomp, non-root;
  - `--memory`, `--cpus`, `--pids-limit`, a disk quota, tmpfs `/tmp`;
  - no Docker socket.
- Network: an internal network only. Egress goes through an allowlist proxy: wordpress.org,
  api.wordpress.org, packagist.org, wpackagist.org, registry.npmjs.org, github.com, and the
  Anthropic API (through the key-injecting proxy), plus per-site allowlist entries that an
  admin approved.
- Inputs are **copied in** (repo checkout, DB snapshot with PII-scrubbing rules) and outputs
  are **copied out** (a diff/branch, reports, screenshots). Secrets never go in either
  direction.
- Each container is destroyed when its stage ends. A reaper kills any container older than
  its job's expiry.

### 5.5 Events, streaming and usage

- The worker appends agent events to `run_event` (monotonic `bigint` id, `run_id`, `type`,
  small JSON payload) and sends `NOTIFY run_events, '<run_id>'`. Only the id goes in the
  payload, because payloads are limited to about 8 KB.
- The app keeps **one** dedicated `pg` LISTEN client per instance and fans events out to
  SSE responses. The client reconnects with `Last-Event-ID`, and the server replays from
  the table.
- `run_usage` stores per-model input, output and cache tokens and the estimated USD from
  SDK `modelUsage`, deduplicated by message id. A nightly job reconciles it against the
  Anthropic Usage & Cost API, which is the billing source of truth.

## 6. Standards for generated WordPress code

These rules become the agents' instructions **and** CI gates in the sandbox. Targets as of
today:

- WordPress **7.1.3** (7.2 is due around December 2026; re-check this spec after its
  Beta 1).
- PHP floor **8.1** for new builds, **8.3+** recommended. Each site sets its own floor
  for PHPCompatibility.
- MySQL 8.0+ / MariaDB 10.11+.

### 6.1 Theme architecture

- **Default: a block theme.**
  - theme.json **v3**, with schema `https://schemas.wp.org/wp/7.1/theme.json` pinned.
  - HTML templates and template parts.
  - `patterns/*.php`.
  - `styles/*.json` for style variations and section styles.
- **Hybrid** (PHP templates + theme.json + blocks) only when WooCommerce or PHP-hook-based
  integrations, or an existing classic theme, need it. **Classic** only to maintain a
  legacy site.
- Rules:
  - Every visual token is a theme.json preset. No hardcoded colors, sizes or font stacks
    in CSS.
  - Repeated sections become **patterns**. Color-only variants become **section styles**,
    not duplicated patterns.
  - Use core blocks first. A custom block (`@wordpress/create-block`, `apiVersion: 3`) is
    added only when no core block plus style variation fits, and each one gets a written
    justification in the mapping manifest.
  - Dynamic fields use **Block Bindings** with registered post meta (`show_in_rest`), not
    custom blocks.
  - Use Block Hooks (`blockHooks`) to insert plugin blocks automatically. Don't edit
    templates for that.
  - Front-end interactivity uses the **Interactivity API** with script modules. No jQuery on
    the front end.
  - Editor code is iframe-safe: always-iframed since 7.1, so use `ownerDocument` /
    `defaultView`, never the global `document`.
- No page builders as generated output.

### 6.2 Plugins and build

- Composer with **PSR-4** autoloading under a vendor namespace, and a minimal main plugin
  file.
- Third-party PHP dependencies are prefixed with Strauss or PHP-Scoper **[tool versions
  unverified]**.
- `vendor/` ships built with `--no-dev --optimize-autoloader`.
- JS and CSS build with **`@wordpress/scripts` 37** (Node ≥ 24.15). Assets are registered
  through the generated `*.asset.php`. No hand-rolled webpack or Vite.
- Text domain = slug. Every user-facing string is wrapped (`__`, `esc_html__`, `_n`, `_x`).
  JS uses `wp_set_script_translations()`, and `wp i18n make-pot` runs in the build.

### 6.3 Code-quality gates (all must pass)

| Gate                        | Tool                                                                                    | Bar                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Style + security sniffs     | PHPCS **3.13.x** + **WPCS 3.4**                                                         | 0 errors. **Stay on PHPCS 3**; WPCS doesn't support PHPCS 4                        |
| PHP compatibility           | PHPCompatibilityWP **2.1.x**                                                            | `testVersion` = the site's PHP floor                                               |
| Static analysis             | PHPStan **2.3** + `szepeviktor/phpstan-wordpress` 2.0 + `php-stubs/wordpress-stubs` 7.1 | new code at **level 8** (6 is the minimum); legacy code at level 5 with a baseline |
| Plugin/theme review         | Plugin Check (`wp plugin check`) 2.1, Theme Check                                       | 0 errors                                                                           |
| JS/CSS lint                 | `wp-scripts lint-js`, `lint-style`                                                      | 0 errors                                                                           |
| Upgrades (maintenance only) | Rector 2.7                                                                              | output reviewed by a human; not part of the CI gate                                |

### 6.4 Security rules (written into the agents' instructions)

- **Escape late, at output:** `esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`, or
  `wp_kses` with an allowlist.
- **Sanitize early:** call `wp_unslash()` first, then `sanitize_*`, `absint`,
  `sanitize_key`.
- **Nonce + capability checks:** every state-changing request checks a nonce **and**
  `current_user_can()`.
- **REST routes:** each has a real `permission_callback` (never `__return_true` on writes)
  and an `args` schema with sanitize and validate callbacks.
- **SQL:** only `$wpdb->prepare()`, with `%i` for identifiers. No string interpolation.
- **Banned:** `eval`, `extract`, `unserialize` on user data, and file writes outside
  `WP_Filesystem`.

### 6.5 Accessibility and performance

- **WCAG 2.2 AA**, plus the theme handbook's accessibility-ready requirements: skip link,
  visible focus, keyboard navigation, 4.5:1 contrast, headings and landmarks, labels.
- Scripts load with the `defer`/`async` strategy or as script modules. Block CSS is loaded
  per block.
- Images use `wp_get_attachment_image` with `srcset`/`sizes` and `add_image_size` per
  design breakpoint. The LCP image gets `fetchpriority="high"` and is never lazy-loaded.
- Fonts are self-hosted through theme.json `fontFace`.
- Budgets, checked with Lighthouse CI on key templates: LCP < 2.5 s, INP < 200 ms,
  CLS < 0.1.

### 6.6 Tests for generated code

- PHPUnit **9.6** + `wp-phpunit` 7.1 + `yoast/phpunit-polyfills` for integration tests.
  Core's suite doesn't support PHPUnit 10+ yet (Trac #62004).
- Brain Monkey 2.7 (any PHPUnit version) for pure unit tests.
- JS unit tests run on Vitest through `wp-scripts test-unit-js`.
- E2E: Playwright + `@wordpress/e2e-test-utils-playwright` 3.1 against the sandbox WP
  (wp-env in CI).
- Accessibility: `@axe-core/playwright`. Fail on serious and critical violations (tags
  `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`).

## 7. Figma → WordPress pipeline

1. **Connect:** org-level Figma OAuth. Tokens are stored as credentials (4.7).
2. **Import:** the REST API fetches the node tree, components and styles.
   `GET /v1/images` exports reference PNGs (1x and 2x) per frame and per section.
3. **Tokens:**
   - Enterprise plans: the Variables REST API (`file_variables:read`) provides tokens.
   - Other plans: derived from the file's published styles (REST), or a DTCG JSON the
     user uploads (for example from Tokens Studio). MCP `get_variable_defs` is used only
     when the optional MCP provider is enabled (D7).
   - All sources are normalized to **DTCG 2025.10** JSON and stored per design version.
4. **Transform:** a Style Dictionary 5 custom format emits theme.json:
   - colors → `settings.color.palette`
   - spacing → `settings.spacing.spacingSizes`
   - type scale → `settings.typography.fontSizes`, with `fluid` min/max from the desktop
     and mobile modes
   - fonts → `fontFamilies` + `fontFace`
   - shadows → `settings.shadow.presets`
   - radii and other values → `settings.custom`
   - variable modes → `styles/*.json` style variations

   This step is **deterministic code, not an agent**.

5. **Structure:**
   - The agent plans the mapping per section from the REST node tree and the section's
     reference PNG (plus MCP `get_design_context` when the MCP provider is enabled):
     - auto-layout → Group/Row/Stack/Columns;
     - sections → patterns;
     - header and footer → template parts;
     - page types → templates;
     - variants → style variations;
     - and only as a last resort, custom blocks.
   - When MCP is used, instance values are cross-checked against REST data, because MCP
     has a known bug that returns pre-override values for instances.
6. **Mapping manifest:** a file maps each Figma node id to its pattern, block or token. It
   is committed with the theme and drives visual QA and later design updates.
7. **Visual QA:**
   - Screenshots are taken at the frame's viewport, with fonts loaded, animations off and
     dynamic content masked.
   - The diff runs **per section** with odiff or pixelmatch at threshold ≈ 0.1, ignoring
     anti-aliasing.
   - Defaults: **1% of pixels changed per section** and a layout-box check of **±2 px**,
     overridable per site. Tune them with real designs and record changes in the lessons.
   - When a section fails, it goes back to `implement-sections` with the diff image, **at
     most 3 times**. After that the run parks for a human decision.

## 8. Maintenance standards

- **Inventory:** a daily job records `wp core/plugin/theme list` for each site.
- **Vulnerabilities:** match the inventory against **Wordfence Intelligence v3**, the
  primary feed (free for commercial use). Patchstack is an optional paid feed for SLA
  clients; WPScan is a cross-check only. Each match becomes a finding and can trigger an
  update run.
- **Update run:**
  1. Clone production to staging (`wp db export/import`, `search-replace`).
  2. Take a baseline: screenshots, e2e results, PHP error log.
  3. Update **one component at a time**, then `wp core update-db`.
  4. Re-run the gates and the visual diff.
  5. Approval.
  6. Promote, with a backup taken immediately beforehand as the rollback point.
- Never update production first. Don't use dashboard auto-updates on managed sites.
- **Deploy model:**
  - Sites we build: Composer-managed **Bedrock** (PHP ≥ 8.3) with WPackagist, deployed
    from git by CI.
  - Inherited sites: git for the theme and custom plugins only; everything else through
    WP-CLI over SSH.
- **Multisite:**
  - Run `update-db --network` and `--url` per site.
  - Plugins check `is_multisite()` and network capabilities.
  - Test on at least two subsites.

## 9. Coding standards (platform TypeScript)

### 9.1 TypeScript

- `tsconfig.base.json` keeps `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax` and `isolatedModules`, and adds:
  - `noImplicitOverride`
  - `noFallthroughCasesInSwitch`
  - Not `exactOptionalPropertyTypes`: it fights MikroORM and Radix types and costs more
    than it catches.
- No `any`. Use `unknown` and narrow it with Zod or type guards. No non-null `!` except
  in tests.
- No `enum`. Use `as const` objects with union types.
- Exported functions get explicit return types.
- Prefer `type` over `interface` unless you need declaration merging.
- Use `import type` for type-only imports (lint enforces it).
- No default exports, except where Next.js requires them (pages, layouts, route files,
  configs).

### 9.2 Naming

| Thing                    | Convention                           | Example                     |
| ------------------------ | ------------------------------------ | --------------------------- |
| Files                    | kebab-case                           | `start-theme-build.ts`      |
| Types, classes, entities | PascalCase, singular entities        | `Site`, `AgentRun`          |
| Tables, columns          | snake_case (MikroORM default)        | `agent_run.organization_id` |
| Use-case services        | `VerbNoun` + `Service`               | `StartThemeBuildService`    |
| Server actions           | `verbNounAction`                     | `approveStageAction`        |
| Job names                | `module.verb-noun`                   | `runs.execute-stage`        |
| Error codes              | SCREAMING_SNAKE                      | `SITE_NOT_FOUND`            |
| Cache tags               | `org:<id>:<resource>[:<id>]`         | `org:42:sites`              |
| Env vars                 | SCREAMING_SNAKE, prefixed by concern | `DATABASE_POOL_MAX`         |

### 9.3 Lint and format rules

- typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`. These rules must be on:
  - `no-floating-promises`
  - `no-misused-promises` (with `checksVoidReturn.attributes: false`)
  - `switch-exhaustiveness-check`
  - `consistent-type-imports`
- `eslint-plugin-boundaries` encodes section 3 and `domain ↛ infrastructure`.
  `no-restricted-imports` bans `react`, `next` and `@mikro-orm/*` in `core`, and `next` and
  `react` in `domain` and `worker`.
- Prettier formats everything. ESLint has no formatting rules.
- Comments explain **why**, not what. No commented-out code. A TODO references an issue.

### 9.4 React and UI

- Server Components by default. `"use client"` goes only on the leaf components that need
  it.
- Admin uses shadcn components from `@wpas/ui/admin/*`. The site uses DaisyUI from
  `@wpas/ui/site/*` (AGENTS.md rules).
- Forms: one Zod schema shared by the RHF resolver and the server action, and the server
  always re-validates. Use shadcn `Field` components so labels and errors are linked with
  `aria-describedby`.
- Admin UI is WCAG 2.2 AA. Never remove `focus-visible` styles. axe (through agent-browser) runs on every admin page
  in the browser integration tests.
- Admin UI is English-only for now (i18n deferred, see 2.2).

### 9.5 Git

- Trunk-based: short-lived branches and PRs into `main`. Squash merges with a
  Conventional Commit title (`feat(db): …`, with the package name as the scope).
- Each PR links its spec in `.ai/specs/` and includes a migration when the schema changes.
  Never edit an applied migration.

## 10. Testing standards

### 10.1 Pyramid and targets

| Level                 | Tool                                                                                 | Scope                                                                                   | Target                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit                  | Vitest 5 (Node + jsdom)                                                              | all platform code                                                                       | **100% lines, branches, functions, statements**, enforced in CI (amended 2026-10-21) |
| Integration           | Vitest + Testcontainers Postgres                                                     | repositories, use cases, RLS tenant isolation (as the non-owner role), outbox → pg-boss | every repository and use case                                                        |
| Contract              | Vitest + MSW 3                                                                       | Figma, GitHub, WP REST, Anthropic clients                                               | every adapter                                                                        |
| Integration (browser) | Vitest + agent-browser against the built app on an ephemeral Testcontainers database | login, org switch, connect site, start run, approve, cancel; axe on every page          | happy paths + authz denials                                                          |
| Sandbox               | image smoke tests                                                                    | WP boots, QA tools run, egress blocked outside the allowlist                            | every image build                                                                    |

### 10.2 Rules

- Colocate tests as `*.test.ts`. Integration tests are named `*.int.test.ts`, which is a
  separate Vitest project.
- Every multi-tenant query gets a cross-tenant denial test.
- Async Server Components that can't render in a unit test get their logic extracted into tested functions; browser integration tests cover the page.
- No real network in unit or integration tests. LLM calls are stubbed at the adapter.

### 10.3 Bug fixes

Each bug fix starts with a failing test, and the lesson goes in `.ai/lessons.md`
(AGENTS.md).

### 10.4 Agent evals

- `packages/worker/evals/` holds an **eval suite**: fixed Figma fixtures and maintenance scenarios,
  scored by the deterministic gates (section 6.3) and the visual diff.
- It runs on any change to a prompt, model, SDK or sandbox image. Results are stored, and a
  regression blocks the merge.

## 11. Observability

- Logs:
  - pino JSON to stdout.
  - The singleton logger is registered in Awilix; scopes add child loggers with
    `requestId`, `orgId`, `userId`, `runId`, `stageId` and `traceId`.
  - Redact `*.password`, `*.apiKey`, `*.secret`, `authorization` and `cookie`.
- Traces:
  - OTel through `instrumentation.ts` (app) and `@opentelemetry/sdk-node` (worker),
    exported to an OTel collector.
  - Agent SDK telemetry goes to the same collector. Use GenAI semantic conventions, which
    are still in Development status, so keep attribute mappings in one module.
  - Prompt and tool-input logging stays **off** by default.
- Errors: Sentry SDK (enabled by `SENTRY_DSN`), plus `onRequestError` in `instrumentation.ts`.
- Health:
  - `/api/health` reports DB, queue and worker heartbeat.
  - The worker exposes its own liveness and readiness.
- Product metrics come from Postgres: run success rate per stage, gate failure reasons,
  cost per run, time to approval.

## 12. Security baseline

- Threat model: prompt injection from design text, plugin code or site content, followed by
  attempts to exfiltrate data or tamper with sites. Mitigations:
  - no credentials in the sandbox;
  - the egress allowlist;
  - host-side tools scoped to one org and one site;
  - approval gates;
  - gVisor where feasible.
- Authorization is checked at every boundary through `authorize()`, which is deny by
  default. Roles live in the Better Auth `access` statements: `owner`, `admin`,
  `developer`, `viewer`, plus API-key scopes.
- Inbound webhooks (GitHub, Figma) verify signatures. Every external input is validated
  with Zod.
- Every state change by a human or an agent writes an append-only `audit_log` row: actor,
  org, action, target, before/after reference.
- Data:
  - Site DB snapshots copied into sandboxes are **scrubbed by default**: user emails,
    names and password hashes anonymized; sessions and application passwords removed;
    comment author data, WooCommerce orders/customers and form-plugin entries removed or
    anonymized. Sites add rules; turning scrubbing off needs an org-admin approval.
  - Retention periods are set for transcripts and snapshots.
- No secrets under `.ai/`, in logs, in prompts, or in `run_event` payloads.

## 13. CI/CD

```
PR:   install (npm ci, cache) → [lint · typecheck · knip · unit · integration (Testcontainers)
      · build] → integration (Testcontainers DB + built app + agent-browser) → security (CodeQL, gitleaks,
      dependency-review, npm audit --omit=dev --audit-level=high)
main: all of the above → docker build (app, worker, sandbox) + SBOM (CycloneDX) → push
      → migrate (one-shot, DATABASE_MIGRATION_URL) → roll out app + worker
```

- Migrations are **expand → contract**, so each one stays compatible with the previous app
  version. They never run on app boot.
- The Docker images are:
  - app: `output: "standalone"`; copy `.next/static` and `public` into the image;
  - worker: bundled Node entrypoint;
  - sandbox: separate image with its own rebuild schedule.
- Renovate PRs pass the full pipeline. Agent SDK and sandbox-image bumps also run the eval
  suite.

## 14. Rollout (each phase gets its own spec)

| #   | Phase                 | Contents                                                                                                                                                                      |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tooling hardening     | Prettier, typescript-eslint type-checked, boundaries, tsconfig flags, Vitest + Testcontainers, lefthook + commitlint, GitHub Actions CI, Renovate, pino, env schema, AppError |
| 2   | Identity and tenancy  | Better Auth (schema `auth`, DDL in a MikroORM migration), organizations + RBAC, `authorize()`, RLS filter + two DB roles, audit log, `proxy.ts`                               |
| 3   | Sites and credentials | Site and environment entities, credential encryption + keyring, WP connection check, GitHub App + Figma OAuth                                                                 |
| 4   | Runs and jobs         | `@wpas/domain`, `@wpas/worker`, pg-boss, outbox relay, run/stage/event/approval/usage model, SSE stream, cancel                                                               |
| 5   | Sandbox               | sandbox image, dockerode manager, egress proxy, key-injecting proxy, reaper, smoke tests                                                                                      |
| 6   | Agents                | `worker/src/agents`, Agent SDK session runner, MCP host tools, policies + hooks, eval suite                                                                                   |
| 7   | Theme build           | Figma import, DTCG → theme.json, structure mapping, generated-code gates (section 6), visual QA, PR                                                                           |
| 8   | Maintenance           | inventory, Wordfence feed, update runs, visual diff, promote                                                                                                                  |

`AGENTS.md` and `README.md` were updated with this spec's approval: they list the approved
additions and say which phase adopts each one. Packages and tools are added only in the
phase that needs them, not ahead of time.

### Progress

| Phase | Spec                                                  | Status            |
| ----- | ----------------------------------------------------- | ----------------- |
| 1     | `implemented/2026-10-21-phase-1-tooling-hardening.md` | done (2026-10-21) |
| 2–8   | not written yet                                       | —                 |

## Acceptance criteria (for this spec)

- Every stack choice lists a version and at least one rejected alternative with a reason.
- Each rollout phase is small enough to become its own spec.
- The decisions below are recorded, and `AGENTS.md` and `README.md` match them.

## Decisions

Made on 2026-10-21. The guiding test for each: fewest moving parts, documented
mainstream practice, and code layout a human or an LLM can predict.

| #   | Decision                                                                                                                                                                              | Why                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | Add **two** packages, `@wpas/domain` and `@wpas/worker`, plus `sandbox/` (image only). Agent code lives in the worker                                                                 | app and worker share use cases; agent code has one consumer                                       |
| D2  | **Better Auth** with its own `pg.Pool` and an `auth` schema; DDL committed as MikroORM migrations                                                                                     | no MikroORM v7 adapter exists; writing one is ongoing maintenance                                 |
| D3  | **pg-boss**, one job per stage, pipeline state in our tables                                                                                                                          | simplest durable model on Postgres alone; DBOS is the fallback if stage-per-job proves too coarse |
| D4  | **Self-hosted Docker sandboxes** behind a `SandboxProvider` port                                                                                                                      | no extra vendor; the port keeps E2B/Daytona/Modal as drop-in fallbacks                            |
| D5  | **Pin TypeScript `~5.9`**                                                                                                                                                             | typescript-eslint doesn't support TS 7 yet                                                        |
| D6  | **Deployment: containers on Linux hosts with Docker + gVisor** (Docker Compose on one VM first; Kubernetes when we need more than one sandbox host). The app may run on the same host | sandboxes need a Docker host anyway, so one model for everything; not Vercel                      |
| D7  | **Figma: REST first; MCP optional** behind a port. Tokens: Variables API on Enterprise; otherwise derived from file styles, or a DTCG JSON the user uploads                           | the deterministic pipeline can't depend on per-user OAuth working headlessly                      |
| D8  | **No cross-process cache invalidation**: worker-written data is never cached                                                                                                          | removes a whole class of stale-data bugs                                                          |
| D9  | **No separate LLM-tracing service**; our run view is the trace UI, OTel export optional                                                                                               | one less service to run and secure                                                                |
| D10 | **Admin i18n deferred**; English-only until a second locale is needed                                                                                                                 | avoids an unverified integration and per-change catalog work                                      |
| D11 | Visual QA defaults 1% / ±2 px per section, max 3 automatic retries                                                                                                                    | sensible starting point; tunable per site                                                         |
| D12 | DB snapshots scrubbed of PII by default (section 12)                                                                                                                                  | sandbox data stays low-risk by default                                                            |

## Follow-ups

- Re-check sections 6 and 8 after WordPress 7.2 Beta 1 (December 2026 release).
- Prove MikroORM v7 RLS end to end in the identity/tenancy spec (phase 2).
- Prove the remote Figma MCP from a headless worker before enabling the MCP provider.
- Revisit TS 7 and ESLint 10 when typescript-eslint supports them.

## Sources

- Claude Agent SDK:
  - https://code.claude.com/docs/en/agent-sdk/overview
  - https://code.claude.com/docs/en/agent-sdk/hosting
  - https://code.claude.com/docs/en/agent-sdk/secure-deployment
  - https://code.claude.com/docs/en/agent-sdk/permissions
  - https://code.claude.com/docs/en/agent-sdk/cost-tracking
- Managed Agents: https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes
- pg-boss:
  - https://pgboss.io/api/queues
  - https://pgboss.io/api/jobs
  - https://pgboss.io/api/workers
- DBOS: https://docs.dbos.dev/typescript/tutorials/queue-tutorial
- Trigger.dev self-hosting: https://trigger.dev/docs/self-hosting
- Langfuse self-hosting: https://langfuse.com/self-hosting
- Figma:
  - https://developers.figma.com/docs/figma-mcp-server/
  - https://developers.figma.com/docs/rest-api/variables-endpoints
- WordPress:
  - https://api.wordpress.org/core/version-check/1.7/
  - https://wordpress.org/about/requirements/
  - https://make.wordpress.org/core/2026/08/05/wordpress-7-1-field-guide
  - https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/theme-json-living/
  - https://developer.wordpress.org/block-editor/reference-guides/block-api/block-bindings/
  - https://developer.wordpress.org/block-editor/reference-guides/block-api/block-api-versions/block-migration-for-iframe-editor-compatibility/
  - https://core.trac.wordpress.org/ticket/62004
  - https://developer.wordpress.org/playground/developers/local-development/wp-playground-cli/
- Wordfence Intelligence: https://www.wordfence.com/help/wordfence-intelligence/v3-accessing-and-consuming-the-vulnerability-data-feed/
- DTCG 2025.10: https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
- Better Auth:
  - https://www.better-auth.com/docs/adapters/postgresql
  - https://www.better-auth.com/blog/authjs-joins-better-auth
- MikroORM:
  - https://mikro-orm.io/docs/filters
  - https://mikro-orm.io/docs/row-level-security
- Vitest projects: https://vitest.dev/guide/projects
- shadcn forms: https://ui.shadcn.com/docs/forms
- Next.js 16.4 local docs (`node_modules/next/dist/docs/`):
  - `proxy.md`
  - `authentication-with-cache-components.md`
  - `data-security.md`
  - `updateTag.md`
  - `revalidateTag.md`
  - `open-telemetry.md`
  - `testing/vitest.md`
  - `output.md`
