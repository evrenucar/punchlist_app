# Punchlist (repo: scheduling & task management)

Canonical instructions for EVERY agent, whatever the harness — Claude Code arrives here via `CLAUDE.md`, others directly. Single-file, local-first task board: one HTML file, zero dependencies, no server.

## Session start (every agent, every harness)

Run `node status/ensure-server.mjs` (Claude Code automates this via a SessionStart hook; other harnesses run it by hand — same command, same result). It brings the development interface up at **http://localhost:4173/**, announces your session in its chat, and prints next steps. Introduce yourself there by your own agent name; every presence feature takes whatever name you register.

Then open http://localhost:4173/ as a normal tab in the browser YOU control (Claude Code: the Chrome DevTools MCP window), never Evren's default browser — his request, 2026-07-18. He works in that window, so test links you want him to see open as new tabs right next to the board. App testing still happens in isolated contexts, not in his tab.

Then read, in this order, before changing anything:

1. `docs/AGENT_HANDOFF.md` — purpose, constraints, full current state, **Hard-won working notes** (real traps that already bit once), and known rough edges.
2. `docs/DIRECTIONS.md` — the CURRENT priority (as of 2026-07-16: mobile/touch refinement from Evren's friction list; funnel declared done-for-now), ranked directions with to-do lists, ponytail audit, and which skills fit the work.
3. `docs/ROADMAP.md` — status and what remains, including the deferred research backlog.
4. `README.md` — user-facing summary, commands, product rules.
5. `docs/AGENT_INTERFACE.md` — full mechanics of the development interface (board protocol, chat, graph, presence).

## Commands

```powershell
node scripts/build-task-board.mjs          # src/ -> outputs/task-board.html (+ website copy)
node --test tests/task-board.static.test.mjs   # full suite; must pass before any commit
```

## Development interface (hard rules — mechanics in `docs/AGENT_INTERFACE.md`)

1. **Board first.** Every piece of work gets a board item with truthful `by`/`lane`/`active`/`inserted` fields; nothing happens off-graph, whatever channel the request came through.
2. **`status/status-board.json` is two-way and Evren edits it live.** Re-read before writing; only write in quiet windows (mtime >8 s) and verify the write survived. `state.identity` must never land in it.
3. **Braindump is private until the Intake signal**, top of it is highest priority, and intake is staged, visible, image-aware, and dedup-explicit.
4. **Decisions are made together.** Grill design choices before building (chat question cards); his tentative phrasing is a question, not a spec. His chat messages and Agent_Active additions are direct instructions. When `status/prefs.json` has `fullAuto: true`, keep working through the queue without waiting for "continue" — but big decisions still get a card.
5. **Stay visible while working.** Heartbeat with name + task + per-phase status; one-line phase notes in chat on long tasks; never fake numbers the page can't know (tokens).
6. **LOCAL ONLY — never publish or link claude.ai artifacts** ("VERY IMPORTANT", 2026-07-17). The localhost page is the artifact.

## Rules that override convenience

- Never hand-edit `outputs/task-board.html` or `website/task-board.html`; edit `src/` and rebuild.
- Never write `src/` files with PowerShell `-Encoding utf8` (BOM breaks the inlined CSS). Use `[System.IO.File]::WriteAllText` or an editor tool.
- Never rename the localStorage key `scheduling-task-management-board-v1` — the user's live board depends on it, and that board lives in THIS machine's browser under the `file://` origin. Browser testing mutates real data: snapshot and restore it, and revert every test task/image/history/trash/settings change.
- No frameworks, no npm dependencies, no server. Feature flags default off, and disabled features must render zero UI.
- Behavior changes ship with: a regression test, a full suite run, a rebuild, and a real-browser check (against the built file, in an isolated browser context) at desktop and phone widths.
- Prose follows `.claude/skills/no-ai-slop` + `rossmann-voice`; code follows `.claude/skills/ponytail`.

## Layout

- `src/` — task-board.html (shell), task-board.css, task-board.js (all logic)
- `scripts/build-task-board.mjs` — zero-dependency bundler
- `outputs/task-board.html` — the distributable (generated)
- `website/` — static landing page + fresh app copy (generated on build)
- `tests/` — static vm-based suite (real-browser acceptance runs through the Chrome DevTools MCP)
- `status/` — the development interface (wrapper, server, scripts) — never contains app code
- `docs/` — handoff, roadmap, agent interface, original spec and plan under `docs/superpowers/`

The user (Evren) gives feedback as voice-dictated batches; expect transcription noise and confirm anything that looks like a mangled name before renaming things broadly. Feedback email inside the app: evrenucar1999@gmail.com (Settings → Give feedback).
