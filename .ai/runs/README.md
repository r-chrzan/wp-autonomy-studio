# Runs

One log file per autonomous AI run.

## Naming

`YYYY-MM-DD-slug.md` — date the run started, lowercase kebab-case slug.
If the same slug is used twice on one day, append `-2`, `-3`, ….

## Template

```markdown
# Run: <title>

- **Date:** YYYY-MM-DD
- **Spec:** .ai/specs/<file>.md (or "none")
- **Outcome:** success | partial | failed | abandoned

## Goal
## Steps taken
## Decisions & assumptions
## Files changed
## Verification (commands run + results)
## Follow-ups
## Lessons recorded (links to .ai/lessons.md entries)
```
