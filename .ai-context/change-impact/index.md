# Change-Impact Index

## Relationships

See `relationships.yaml` for structured dependency map of all 6 components.

## Highest-Risk Changes

| Change | Impact | Risk Level |
|--------|--------|------------|
| Edit AGENTS.md global rules | All downstream repos; CLAUDE.md must mirror | **High** |
| Edit cloud strategy section | All repos + CloudManagement + downstream PRDs | **High** |
| Remove .gitignore secrets entries | Credential leak risk in all downstream repos | **High** |
| Edit CLAUDE.md mirror (without AGENTS.md) | Agent behavior divergence | **Medium** |
| Add/remove Devin skill | Downstream repos with skills dir | **Low** |
| Edit README.md | New clone experience only | **Low** |
