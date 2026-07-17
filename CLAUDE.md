# Punchlist (repo: scheduling & task management)

Single-file, local-first task board. One HTML file, zero dependencies, no server. Everything a new agent needs is in four documents — read them in this order before changing anything:

1. `docs/AGENT_HANDOFF.md` — purpose, constraints, full current state, **Hard-won working notes** (real traps that already bit once), and known rough edges.
2. `docs/DIRECTIONS.md` — the CURRENT priority (as of 2026-07-16: mobile/touch refinement from Evren's friction list; funnel declared done-for-now), ranked directions with to-do lists, ponytail audit, and which skills fit the work.
3. `docs/ROADMAP.md` — status and what remains, including the deferred research backlog.
4. `README.md` — user-facing summary, commands, product rules.

## Commands

```powershell
node scripts/build-task-board.mjs          # src/ -> outputs/task-board.html (+ website copy)
node --test tests/task-board.static.test.mjs   # 83 tests; must pass before any commit
```

## Live status board (hard rule)

A SessionStart hook (`.claude/settings.json`) runs `node status/ensure-server.mjs` so the board at **http://localhost:4173/** is up every session. It embeds the real app (`website/task-board.html`, so it improves with every rebuild) under a flow-diagram header (`status/index.html`), seeded from `status/status-board.json`.

- That JSON file is **two-way**: Evren's edits in the browser land in it within ~2 s, and your edits to it appear in his browser within ~2 s. Always re-read it before writing — his changes may have landed since your last read.
- **Braindump is private until intake.** Never read, triage, or act on `group-braindump` contents until `status/chat.jsonl` shows a `"Braindump intake requested"` system message you haven't processed yet. On intake: triage every item into the right group at the right priority position, dedup against the whole board first — classify each duplicate as already-tracked-issue, already-tracked-idea, or already-shipped, and merge into the existing item instead of adding — then delete the processed items from Braindump and post a placement summary to chat.
- **`group-inbox` is titled "Agent_Active"**: what is being worked on right now. Add an item when you start something, mark it done when you finish. Evren adds items there too — treat his as direct instructions.
- **Authorship tags color the rows.** Every task you create gets `"by": "agent"` (green stripe). Browser-created tasks are auto-tagged `"by": "user"` (blue stripe) by the wrapper. Original content is `"by": "seed"` (no stripe). Never strip these fields.
- **Chat**: the page has a chat panel backed by `status/chat.jsonl` (gitignored). Read it for `from:"user"` messages; reply with `node status/say.mjs "<message>"`. When ending a turn during active collaboration, arm a Monitor on `status/chat.jsonl` so browser chat and intake presses wake you.
- The wrapper and server both strip `state.identity` (signing keypair) before the file is written — keep it that way; the file is tracked in git.
- The file is single-line JSON after browser edits; edit it with `node -e` JSON parse/stringify, not by hand.
- Keep the flow diagram in `status/index.html` current when stages move, and keep the hosted snapshot fresh: `node status/build-status-artifact.mjs <out.html>`, then republish to artifact `841c27ed-6bd3-43a7-b63d-20e3f79ae3fe`.

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
