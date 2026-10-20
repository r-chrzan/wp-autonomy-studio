@AGENTS.md

# Claude Code notes

`AGENTS.md` (imported above) is the source of truth for project rules, including the mandatory `.ai/` workflow. Summary of what Claude must do:

- **Start of task:** read `.ai/lessons.md`; read the relevant spec in `.ai/specs/` if one exists.
- **Specs:** `.ai/specs/YYYY-MM-DD-slug.md`; move to `implemented/` when done, `archive/` when obsolete.
- **Autonomous runs:** log to `.ai/runs/YYYY-MM-DD-slug.md`.
- **After a bug fix or notable finding:** record it in `.ai/lessons.md` (details in `.ai/lessons/YYYY-MM-DD-slug.md`).
- Do not edit the `BEGIN/END:nextjs-agent-rules` block in `AGENTS.md`; `next dev` regenerates it. Add project rules outside it.
