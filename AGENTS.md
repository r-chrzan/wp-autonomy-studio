<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
2. **Verify, don't assume.** Before calling work done, prove it: run `npm run lint` and `npm run build`, plus any relevant tests, and check the change in the running app when it affects UI or behavior. Report the commands and their results, including failures. Unverified work is not done.
3. **Prefer the clean fix.** If a fix works but is hacky, revisit it with what you now know and replace it with the simpler, well-structured solution before finishing.
4. **Fix bugs autonomously.** Given a bug report, failing check or log, find the root cause and fix it without waiting for step-by-step direction. Ask only when a decision belongs to the user.
5. **Use subagents for heavy lifting.** Delegate broad searches, research and independent subtasks to subagents to keep the main context focused. Run independent work in parallel.
6. **Turn repetition into tooling.** If the same workflow comes up repeatedly, propose a committed skill or slash command for it.
