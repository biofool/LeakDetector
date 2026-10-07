# Component: `CLAUDE.md`

**Status**: OBSERVED — template global block + LeakDetector project section
(version stamp `2026-10-07`).

## Role

Claude Code's rules file: mirrors the AGENTS.md global conventions and adds
the project-specific guidance AGENTS.md lacks here:

- Project overview (citizen leak reporting for NZ councils)
- Commands: `pip3 install -r requirements.txt`,
  `STAFF_TOKEN=devtoken uvicorn app.main:app ...`, `pytest tests/ -q`
- MVP architecture notes (db.py seam, notify.py fallback, STAFF_TOKEN)
- The pivot notice: `docs/spec.md` target design vs MVP;
  `docs/decisions.md` + `docs/spec-vs-mvp.md` must be updated with
  design/code changes

## ⚠ Known staleness

The Commands/Architecture sections still describe the **pre-move** layout
(`app/`, `static/`, `tests/`, `requirements.txt` at root). After `0d2650f`
those live under `legacy/`. Same in `README.md`. Update both when the
`backend/`+`frontend/` monorepo lands so the files describe the real
commands (`npm run dev` in `backend/` etc.).
