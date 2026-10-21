# Run: Engineering standards and tech stack spec

- **Date:** 2026-10-21
- **Spec:** .ai/specs/2026-10-21-engineering-standards.md
- **Outcome:** success

## Goal

Research and write a spec covering the full tech stack, engineering standards, coding
standards and design patterns for WP Autonomy Studio (README.md): an agent platform that
builds and maintains WordPress sites from Figma designs.

## Steps taken

1. Read README.md, AGENTS.md, `.ai/lessons.md`, the implemented foundation spec.
2. Dispatched three parallel research subagents: agent runtime/orchestration, WordPress +
   Figma output pipeline, platform engineering standards for the Next.js app.
3. Merged the three reports into `.ai/specs/2026-10-21-engineering-standards.md` (status: draft).

## Decisions & assumptions

- Kept the foundation stack; only additions. Postgres-only infra (pg-boss, LISTEN/NOTIFY, no Redis).
- Agents run in per-job Docker sandboxes via the Claude Agent SDK; no credentials in the sandbox.
- Proposed new packages (`@wpas/domain`, `@wpas/agents`, `@wpas/worker`) — flagged as needing
  approval, since they change AGENTS.md package boundaries. AGENTS.md/README.md not edited yet.

## Files changed

- `.ai/specs/2026-10-21-engineering-standards.md` (new)
- `.ai/runs/2026-10-21-engineering-standards-spec.md` (new)
- `.ai/lessons.md` (one entry)

## Verification

Docs-only change; no code touched, so lint/typecheck/build not re-run. Versions verified by
research subagents via npm/Packagist/wordpress.org on 2026-10-21; unverified claims are marked in the spec.

## Follow-ups

- Approve/amend "Decisions needing approval" in the spec, then update AGENTS.md + README.md.
- Write the phase-1 spec (tooling hardening).

## Lessons recorded

- 2026-10-21 — Check peer ranges before taking new majors (TS 7 vs typescript-eslint; WPCS vs PHPCS 4).

## Update: decisions made (same day)

User asked the agent to make the key decisions itself, optimizing for easy to maintain,
scalable and readable by both humans and LLMs.

- Recorded D1–D12 in the spec's "Decisions" table and set its status to approved. Main
  simplifications compared with the draft:
  - two new packages instead of three (agent code moves into `@wpas/worker`);
  - no separate tracing service;
  - admin i18n deferred;
  - no cross-process cache invalidation (worker-written data is never cached);
  - Figma REST first, with MCP optional;
  - `exactOptionalPropertyTypes` dropped.
- Resolved the open questions:
  - deployment: Docker hosts + gVisor, Compose first;
  - visual-QA defaults;
  - PII scrubbing on by default.
- Updated `AGENTS.md`: approved additions by phase, planned packages and dependency
  direction, design-pattern rules, coding standards.
- Updated `README.md`: a target-architecture section. The user's uncommitted intro edit was
  kept.
- Verification: docs only; no code changed.
