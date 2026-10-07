# Components Index

| Component | File | Risk | Component Doc |
|-----------|------|------|---------------|
| AGENTS.md | `AGENTS.md` | High (canonical rules) | `agents-md.md` |
| CLAUDE.md | `CLAUDE.md` | Medium (mirror) | `claude-md.md` |
| Devin Skills | `.devin/skills/*/SKILL.md` | Low (self-contained) | `devin-skills.md` |
| .gitignore | `.gitignore` | Medium (secrets) | `gitignore.md` |
| Claude settings | `.claude/settings.json` | Low (empty scaffold) | — |
| README.md | `README.md` | Low (instructions) | — |
| TechnicalMarketingReadMe.md | `TechnicalMarketingReadMe.md` | Low (marketing) | — |

## Priority Order

1. **AGENTS.md** — highest traffic, highest risk; canonical rules source
2. **CLAUDE.md** — must mirror AGENTS.md; desync = agent behavior divergence
3. **.gitignore** — secrets prevention; removing entries = leak risk
4. **Devin Skills** — self-contained, low coupling
5. **README.md / TechnicalMarketingReadMe.md** — documentation only
6. **.claude/settings.json** — empty scaffold, no risk
