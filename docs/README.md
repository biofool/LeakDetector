# LeakDetector docs

Read these in order if you are new to the project.

| # | File | What it tells you |
|---|---|---|
| 1 | [`brief.md`](brief.md) | The original request: what the product owner asked for. |
| 2 | [`spec.md`](spec.md) | The **target design**: architecture, PostGIS data model, API, SLA rules, duplicate detection. §6 is the build guide for Windsurf SWE‑2 (`/backend` + `/frontend` monorepo, milestones M1–M11). |
| 3 | [`decisions.md`](decisions.md) | Every place `spec.md` **deviates from or adds to** the brief, and why. |
| 4 | [`spec-vs-mvp.md`](spec-vs-mvp.md) | How the **code in this repo today** (FastAPI + SQLite MVP) differs from `spec.md`, plus open decisions. |

## How these fit together

```
brief.md  ──(design + deviations: decisions.md)──▶  spec.md
                                                       │
                                     (gap analysis: spec-vs-mvp.md)
                                                       ▼
                                          app/ + static/ (MVP code)
```

- `spec.md` is where we are going. The MVP in `app/` and `static/` is where we are.
- If you change the design, update `spec.md` **and** add an entry to `decisions.md`.
- If you close a gap in the code, tick it off in `spec-vs-mvp.md`.
- Do not change the brief. It is the historical record of what was asked.
