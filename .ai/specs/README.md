# Specs

Specifications for Spec-Driven Development (SDD). Write the spec first, then implement against it.

## Naming

`YYYY-MM-DD-slug.md` — date the spec was created, lowercase kebab-case slug.
Example: `2026-10-20-site-import-flow.md`

## Lifecycle

| Location                 | Meaning                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `.ai/specs/`             | Active / not yet implemented                                          |
| `.ai/specs/implemented/` | Fully implemented and verified. Move here with `git mv`.              |
| `.ai/specs/archive/`     | Abandoned, superseded, or obsolete. Add a one-line reason at the top. |

Filenames never change when a spec moves.

## Suggested template

```markdown
# Title

- **Status:** draft | approved | implemented | archived
- **Created:** YYYY-MM-DD

## Problem

## Goals / Non-goals

## Requirements

## Design

## Acceptance criteria

## Open questions
```
