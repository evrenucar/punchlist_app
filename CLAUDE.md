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
- **Never write while he's mid-edit** — his browser pushes whole-state every 2 s and will clobber you (this happened 2026-07-17), and your write reloads his view mid-typing. Wait until the file's mtime is >8 s old, write on top of the fresh state, verify your ids survive ~6 s later, retry if raced (pattern: the quiet-write loop; a wrapper-applied patch queue is the upgrade if this ever livelocks).
- **Braindump order is priority order** (Evren's rule, 2026-07-17): items at the top get treated with higher importance and urgency during intake.
- **Queue insertion** (decided 2026-07-17 via card): new priority items go into Agent_Active immediately AFTER the current active item — next up, not top, not end — and get `"inserted": true`, which renders them on the graph as an open branch hanging below the active node (side-attached lines, no merge back; left branch drops a row on collision when that case ever exists).
- **Intake per item** (Evren's flow, 2026-07-17): classify the lane (`"lane": "dev"`/`"app"`, ask a card when unsure) and check whether it was mentioned before — name any duplicate and its earlier item in the chat summary instead of silently merging. After finishing work, kill the heartbeat PROCESS first, then deregister. On Windows, TaskStop only kills the shell wrapper and leaves the node child beating as an orphan that re-registers every 30 s (seven were found running 2026-07-17 — that was the real ghost-dots cause): `wmic process where "commandline like '%agent-heartbeat%'" get processid` → `taskkill //F //PID <pid>`, THEN `node status/agent-heartbeat.mjs <name> --stop`.
- **Braindump is private until intake.** Never read, triage, or act on `group-braindump` contents until `status/chat.jsonl` shows a `"Braindump intake requested"` system message you haven't processed yet. On intake: triage every item into the right group at the right priority position, dedup against the whole board first — classify each duplicate as already-tracked-issue, already-tracked-idea, or already-shipped, and merge into the existing item instead of adding — then delete the processed items from Braindump and post a placement summary to chat.
- **`group-inbox` is titled "Agent_Active"**: what is being worked on right now. Add an item when you start something and set `"active": true` on it — that field drives the purple ACTIVE bar at the top of the page (click-to-jump) and the glowing purple backdrop on the row. When you finish: set `active` false, mark it done, and move it under the collapsed "Completed" task (`task-agent-completed`) inside the same group — only actionable items stay at top level. Evren adds items there too — treat his as direct instructions.
- **Intake is visible.** While triaging a braindump, write `status/status-board.json` in stages (a section at a time, a few seconds apart) — the intake button shows "Intaking braindump…" with a purple glow until the group is empty, and staged writes let Evren watch items leave. Braindump items can carry embedded images (`node status/extract-images.mjs <substring> <outdir>` dumps them for viewing — always check before deleting items) and links (WebFetch them when context matters).
- **Authorship tags color the rows** (legend in the page header). Every task you create gets `"by": "agent"` (blue backdrop). Browser-created tasks are auto-tagged `"by": "user"` (green backdrop) by the wrapper. Active = purple glow. Original content is `"by": "seed"` (no backdrop). Never strip these fields.
- **Layer contract (decided 2026-07-17):** `status/` never copies or patches app code. It embeds the built `website/task-board.html` and decorates from outside through three DOM hooks: `data-task-row`, `data-group-title`, `data-sidebar-toggle`. Renaming any of those in `src/` requires updating the wrapper injector in the same commit. Anything that changes app behavior lands in `src/` with the full test/rebuild discipline; the status board inherits it on the next build.
- **Always name the layer.** When telling Evren about a change or writing board items, make explicit whether it's the app (`src/`, ships to users) or the development interface (`status/`, this tooling). Ambiguous mentions get a suffix like "(for the development interface)".
- **All work reflects on the board, whatever channel it came through.** Requests made in the terminal count the same as chat or board input: update Agent_Active (with `active` flags) while working, and rebake + republish the artifact at the end of any session that materially changed status. The board and artifact must never lag behind what actually happened.
- **Chat**: the page has a chat panel backed by `status/chat.jsonl` (gitignored). Read it for `from:"user"` messages; reply with `node status/say.mjs "<message>"` (style: [[punchlist-chat-style]] memory — humanizer rules, no em-dashes, short). Ask decisions with buttons: `node status/ask.mjs [--multi] "Question" "Opt 1" "Opt 2"` — answers come back as user messages with `answerTo`. When ending a turn during active collaboration, arm a Monitor on `status/chat.jsonl` so browser chat and intake presses wake you.
- **Execution graph** (Graph button; spec = grill Q14–Q20 in the grill-decisions memory): a live thread of completed → active → queued work, derived from Agent_Active order then the Direction A P1→P4 backlog, on ONE flowchart (a two-lane layout was built and reverted same day, 2026-07-17 — Evren prefers a single thread). Each node carries a bottom tag from the item's `"lane"` field: yellow "app" / blue "development interface" — set it on every item you create. Every piece of work gets a board item — nothing happens off-graph.
- **Grill design decisions before building them.** Evren's standing ask (2026-07-17): interface/design choices for either layer get a grill (chat question cards work well) so decisions are made together. Tentative phrasing from him ("maybe", a question mark) is a grill trigger, not a spec. While working, run `node status/agent-heartbeat.mjs <name> <taskId> [status text]` in the background so a named chip rides your node and the chat header shows a live runtime clock plus your status note (re-run with new status text mid-task — the clock survives; entries self-expire 90 s after beats stop; `--stop` deregisters). Update the status note at EVERY phase change (investigate → code → test → verify), and during long tasks drop one-line phase notes into chat — Evren watches the board, not the terminal, and silence there reads as nothing happening (his feedback 2026-07-17). Token counts are NOT displayable — local scripts can't see Claude's usage; never fake a number. Open item: bake a static SVG of the thread into the artifact.
- The wrapper and server both strip `state.identity` (signing keypair) before the file is written — keep it that way; the file is tracked in git.
- The file is single-line JSON after browser edits; edit it with `node -e` JSON parse/stringify, not by hand.
- Keep the hosted snapshot fresh: `node status/build-status-artifact.mjs <out.html>`, then republish to artifact `841c27ed-6bd3-43a7-b63d-20e3f79ae3fe`. (The ACTIVE bar replaced the old flow diagram, 2026-07-17; it renders itself from `active` flags — no manual upkeep.)

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
