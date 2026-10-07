# Component: Devin Skills (.devin/skills/)

## Responsibility

Bundled Brave Search API skill definitions for Devin CLI. Each skill is a
self-contained `SKILL.md` file documenting a Brave Search API endpoint,
its parameters, usage patterns, and example curl commands. Skills contain
no executable code — they are documentation that Devin reads to make API calls.

## Files

12 skill directories under `.devin/skills/`, each containing a `SKILL.md`:

| Skill | Lines | API Endpoint | Purpose |
|-------|-------|-------------|---------|
| `web-search` | 322 | `/web/search` | General web search (primary) |
| `news-search` | 183 | `/news/search` | News article search with freshness filters |
| `images-search` | 141 | `/images/search` | Image search with SafeSearch |
| `videos-search` | 178 | `/videos/search` | Video search with metadata |
| `suggest` | 99 | `/suggest` | Query autocomplete (<100ms) |
| `spellcheck` | 74 | `/spellcheck` | Spell correction |
| `local-pois` | 189 | `/local/pois` | Local business/POI details |
| `local-descriptions` | 107 | `/local/descriptions` | AI-generated POI descriptions |
| `llm-context` | 288 | `/llm-context` | RAG/LLM grounding, pre-extracted content |
| `answers` | 255 | `/chat/completions` | AI-grounded answers with citations |
| `bx` | 226 | All-in-one | Web search, research, RAG, browse |
| `search` | 226 | (same as bx) | Alias of bx skill |

**Note**: `search/SKILL.md` has `name: bx` in its frontmatter — appears to be
a duplicate/alias of the `bx` skill. (OBSERVED)

## Interfaces

- **Input**: `BRAVE_SEARCH_API_KEY` environment variable (required for live calls)
- **Output**: API call guidance consumed by Devin CLI
- **External API**: Brave Search API (https://api.search.brave.com)

## Dependencies

- **External**: Brave Search API (`BRAVE_SEARCH_API_KEY` env var)
- **None internal**: skills are self-contained Markdown files

## Consumers

- Devin CLI (reads SKILL.md to understand how to call Brave API)
- Downstream repos that keep the `.devin/skills/` directory after cloning

## State/Data

None — static Markdown documentation files.

## Boundaries

- Skills are optional — README says "Remove the directory if the project doesn't need web search"
- Skills document API usage but contain no executable code
- `bx` and `search` skills appear to be duplicates (OBSERVED — see Debt Register)

## Change Guidance

**Before modifying skills:**
1. Skills are Brave API documentation — verify against current Brave API docs before changing
2. Adding a skill: create `.devin/skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`)
3. Removing a skill: delete the directory; update AGENTS.md §Skills list and README.md
4. All skills require `BRAVE_SEARCH_API_KEY` — do not hardcode keys in SKILL.md files

## Evidence

- OBSERVED: 12 skill directories, each with a SKILL.md file
- OBSERVED: `search/SKILL.md` frontmatter has `name: bx` (duplicate of `bx` skill)
- DECLARED: "They require a BRAVE_SEARCH_API_KEY environment variable" (AGENTS.md line 204)
- DECLARED: "Remove the directory if the project doesn't need web search" (README.md line 70)
