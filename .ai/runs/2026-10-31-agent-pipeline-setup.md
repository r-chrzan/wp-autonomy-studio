# Agent pipeline setup

- **Goal:** configure the om-* agent skills pipeline (`om-setup-agent-pipeline`).
- **Spec:** none (tooling setup).

## Steps

1. Detected: GitHub remote `r-chrzan/wp-autonomy-studio`, default branch `main`, npm lockfile, CI jobs in `.github/workflows/ci.yml`. Skill coverage check: OK (all 61 skills under `.agents/skills/`).
2. User choices: validation mirrors CI (format:check, lint, typecheck, knip, test:coverage, test:integration), full label taxonomy, QA gate on, generate SDLC.md, CODE_REVIEW.md, BACKWARD_COMPATIBILITY.md.
3. Installed `.ai/trackers/github.md` and `.ai/browsers/agent-browser.md` from the shipped references.
4. Created 25 missing GitHub labels (`bug` and `documentation` already existed; nothing renamed or recolored).
5. Wrote `.ai/agentic.config.json`, the three root docs, `.gitkeep` for `.ai/analysis`, `.ai/scripts`, `.ai/qa`, and gitignored per-run QA state.

## Decisions

- `reviewChecklist` left `null`: `om-code-review` picks up root `CODE_REVIEW.md` automatically.
- No optional capability blocks (harness, platform, sessionShare): nothing in the repo evidences them.
- `.ai/specs` kept as the specs path; no discovery layer.

## Verification

- `npm run format:check` on the new files.
