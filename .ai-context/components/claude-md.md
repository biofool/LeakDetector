# Component: CLAUDE.md

## Responsibility

Project guidance file for Claude Code. Contains a skeleton template (overview,
environment, commands, architecture, conventions) plus a **mirrored** copy of
the global conventions from `AGENTS.md`. This is NOT canonical — `AGENTS.md` is.

## Files

- `CLAUDE.md` (78 lines)

## Structure

| Section | Lines | Content |
|---------|-------|---------|
| Version stamp | 1-2 | `2026-07-25` config version (matches AGENTS.md) |
| Project Overview | 5-7 | Empty placeholder for project-specific content |
| Environment | 9-11 | Empty placeholder |
| Commands | 13-16 | Empty placeholder |
| Architecture | 18-21 | Empty placeholder |
| Conventions | 23-26 | Empty placeholder |
| Global conventions | 28-78 | Mirrored copy of AGENTS.md rules (condensed) |

## Interfaces

- **Input**: none (static document)
- **Output**: rules consumed by Claude Code at session start
- **Mirror source**: `AGENTS.md` (canonical)

## Dependencies

- **Mirrors**: `AGENTS.md` §rules 1-10 + cloud strategy (condensed form)
- **References**: `AGENTS.md` for full text ("See AGENTS.md for the full text of each rule")

## Consumers

- Claude Code (primary reader)
- Downstream biofool repos (via template clone)

## State/Data

None — static Markdown document. Project-specific sections are empty placeholders
to be filled in after cloning.

## Boundaries

- Global conventions (mirrored from AGENTS.md) vs. project-specific sections (empty placeholders)
- The mirror is **condensed** — full text lives only in AGENTS.md

## Change Guidance

**Before modifying CLAUDE.md:**
1. If changing a **global convention**: edit `AGENTS.md` first (canonical), then mirror here
2. **MUST** keep version stamp in sync with AGENTS.md
3. If changing **project-specific sections** (overview, environment, commands, etc.): these are placeholders — downstream repos fill them in, so changes here only affect new clones
4. The mirror must cover all 10 rules + cloud strategy — do not drop any

## Evidence

- OBSERVED: 78-line Markdown file with empty placeholder sections + mirrored global conventions
- OBSERVED: version stamp `2026-07-25` at line 1 (matches AGENTS.md)
- DECLARED: "The canonical home for cross-project rules is AGENTS.md" (line 28)
- DECLARED: "If you edit one, edit both" (line 30)
