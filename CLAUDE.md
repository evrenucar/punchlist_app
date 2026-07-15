# Punchlist (repo: scheduling & task management)

Single-file, local-first task board. One HTML file, zero dependencies, no server. Everything a new agent needs is in three documents — read them in this order before changing anything:

1. `docs/AGENT_HANDOFF.md` — purpose, constraints, full current state, **Hard-won working notes** (real traps that already bit once), and known rough edges.
2. `docs/ROADMAP.md` — status and what remains, including the deferred research backlog.
3. `README.md` — user-facing summary, commands, product rules.

## Commands

```powershell
node scripts/build-task-board.mjs          # src/ -> outputs/task-board.html (+ website copy)
node --test tests/task-board.static.test.mjs   # 77 tests; must pass before any commit
```

## Rules that override convenience

- Never hand-edit `outputs/task-board.html` or `website/task-board.html`; edit `src/` and rebuild.
- Never write `src/` files with PowerShell `-Encoding utf8` (BOM breaks the inlined CSS). Use `[System.IO.File]::WriteAllText` or an editor tool.
- Never rename the localStorage key `scheduling-task-management-board-v1` — the user's live board depends on it, and that board lives in THIS machine's browser under the `file://` origin. Browser testing mutates real data: snapshot and restore it, and revert every test task/image/history/trash/settings change.
- No frameworks, no npm dependencies, no server. Feature flags default off, and disabled features must render zero UI.
- Behavior changes ship with: a regression test, a full suite run, a rebuild, and a real-browser check (Chrome DevTools MCP against the built file) at desktop and phone widths.
- Prose follows `.claude/skills/no-ai-slop` + `rossmann-voice`; code follows `.claude/skills/ponytail`.

## Layout

- `src/` — task-board.html (shell), task-board.css, task-board.js (all logic)
- `scripts/build-task-board.mjs` — zero-dependency bundler
- `outputs/task-board.html` — the distributable (generated)
- `website/` — static landing page + fresh app copy (generated on build)
- `tests/` — static vm-based suite + optional Playwright smoke (skips without a runtime)
- `docs/` — handoff, roadmap, original spec and plan under `docs/superpowers/`

The user (Evren) gives feedback as voice-dictated batches; expect transcription noise and confirm anything that looks like a mangled name before renaming things broadly. Feedback email inside the app: evrenucar1999@gmail.com (Settings → Give feedback).
