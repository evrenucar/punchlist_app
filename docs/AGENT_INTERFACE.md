# The development interface (aide-board), as Punchlist uses it

> **The tool is a separate checkout as of 2026-07-27.** Its MECHANICS — endpoints, every script's flags, the page route, the board-pane vendoring contract, the layout — are documented once, in **`../aide-board/README.md`**. Read that for how the thing works.
>
> This file is the other half: the CONVENTIONS Evren expects on *this* project. Node authoring, braindump and intake, auto mode, chat conduct, the mobile probe loop, verification discipline. None of it ships with the tool, and a second project would want its own.
>
> Scripts live at `../aide-board/`, data lives at `punchlist_app/status/`. If a path below looks wrong, that is the rule to check it against.

Operating the live board at **http://localhost:4173/**. AGENTS.md holds the six hard rules. Agent-agnostic: wherever a name is needed, use your own agent/model name.

## Where things live

Scripts: `../aide-board/`. Data this project owns: `status/` — `status-board.json`, `chat.jsonl`, `prefs.json`, `ctx.json`, `archive.json`, `review-specs.json`, and every `<name>.html` review page. `status/board.html` is the board pane, re-pinned by every `node scripts/build-task-board.mjs` and gitignored, which is what keeps the pane on the current build instead of the older copy vendored with the tool.

Endpoints, script flags, the page route and the vendoring contract are all in `../aide-board/README.md`. Not repeated here — one copy, one place to fix.

At session start, open the wrapper as a normal (non-isolated) tab in the agent-controlled browser — for Claude Code the Chrome DevTools MCP window — never Evren's default browser (his request, 2026-07-18). He uses that window; open links you want to show him as new tabs there. Keep destructive/app testing in isolated contexts; his tab is live data.

**ONE WINDOW (his request, 2026-07-28): "make sure all tabs you open in a session are on a single chrome automated one window, and keep all together".** Every page he is meant to read is a normal tab in that one window. An `isolatedContext` opens a SEPARATE window, so treat it as a scratch space with a lifetime: open it, test, `close_page` it. Never leave one parked at the end of a step. The same goes for a non-isolated tab on the built app file — it loads his real `file://` board, so close it once the check is done and leave only the pages he asked for.

## Presence discipline (the one script rule that is ours, not the tool's)

`node ../aide-board/agent-heartbeat.mjs <name> <taskId> [status...]`. Re-run with new status text at every phase change; the runtime clock survives.

**Before ending ANY turn, kill the beat processes and verify `GET /agents` returns `[]`.** A beating orphan between turns shows Evren a running agent that is not running (this has bitten twice, 2026-07-17). TaskStop only kills the shell wrapper on Windows, so kill the node child by PID and then `--stop`. On this machine the reliable form is PowerShell, because the old `wmic` one-liner matches its own pipeline:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*agent-heartbeat*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Trust `GET /agents` = `[]` as ground truth, never the kill command's own output.

## Board protocol

- The JSON file is two-way (~2 s each direction). ALWAYS re-read before writing. NEVER write while Evren is mid-edit: wait until the file's mtime is >8 s old, write on top of fresh state, verify your ids survive ~6 s later, retry (the quiet-write loop). Write through `../aide-board/board-write.mjs` (`readBoard`/`writeBoard`) — it enforces the quiet window AND logs your edit to the app's History panel attributed to the agent device, like another user sharing the board (Evren's spec, 2026-07-19). Pass a short human-readable summary as the history text on every write. Since 2026-07-19 your writes apply IN PLACE inside his iframe (`applyExternalState` — selection and scroll survive, no reload); full wrapper-PAGE reloads still flash and stay quiet-window-only, and remote updates still defer up to 60 s while his caret sits in an editable.
- Task fields the wrapper understands: `by` (`agent`/`user`/`seed` — authorship colors; never strip), `lane` (`dev`/`app` — the yellow/blue node tags; set on every item you create), `active` (purple glow + ACTIVE bar + graph anchor; keep truthful), `inserted` (priority-insertion marker for board ordering; the graph no longer special-cases it).
- The graph is the F+ STAIRCASE (Evren's pick, 2026-07-19): one horizontal trunk = the timeline (compacted older done → last three done → active → queue → friction buckets), and ONE staircase of children stepping down-right under the selected trunk node, sibling stacks capped behind +N pills. Blue dots mark items created since his last graph open. He walks it with arrows (←→ siblings, ↓ deeper, ↑ back, Enter descend, J jump) — so keep item TEXT front-loaded (the first line is what a trunk node shows) and keep children meaningful: they are the steps he reads.
- Agent_Active (`group-inbox`) holds actionable items only. New priority items go immediately AFTER the current active item, with `inserted: true`. Finished items: `done` + `completedAt`, `active: false`, moved UNDER `task-agent-completed` at the TOP (latest first). Finished `inserted` items stay visible as gray nodes on their branch.
- Every piece of work gets a board item — nothing happens off-graph. Work arriving via terminal counts the same as chat or board input.

## Node authoring convention (Evren's ask, 2026-07-20 — the graph is only as honest as its nodes)

Half of "the graph doesn't reflect intent and state" is authoring, not layout. Rules for every agent, every session:

1. **Mark active the moment work starts.** Set `active: true` on the board item BEFORE the first tool call of that work, not after. One active item per agent at a time; clear it (`active: false`) the moment you move on. A beat without an active node, or an active node nobody is beating on, both read as lies.
2. **Decompose visibly.** Multi-part work gets children on its board item, one child per real subtask, added when you start (not retroactively). The parent→children fan IS the intent display; a monolithic node hides everything.
3. **Close promptly.** The moment something ships: `done: true`, `completedAt`, `completedBy: "agent"`, `active: false`, move under `task-agent-completed` (top). Never batch closures at session end; stale open nodes make the queue unreadable.
4. **Front-load node text.** The first line is what the graph shows; lead with the point ("Sync 409 fixed: re-GET sha and retry" not "Investigated the issue where…").
5. **Position is priority.** Top of a group (and of a sub-group) is highest priority. Work the queues top-down, and insert new items at their true rank, not the bottom. To-do-group items must not rot un-attended: sweep them without being re-told.
6. **He restated it? You probably have it.** Search the board JSON for a matching item before reacting to a restated request; answer with the item's ID and status instead of acting confused or creating a duplicate.
7. **Every node maps to a board item.** Heartbeat `taskId`s must be real board item IDs so the chip pins to a node. Duration and authorship ride the item (`focusSeconds` machinery in the app; `completedBy`/history on the board), so keep IDs stable.
8. **Closing is part of shipping** (Evren, 2026-07-21, after a 28-item rot sweep). When he marks something "done" or "drop" in a review/priority pass, close it on the board THAT session, with a one-line note when he asked for confirmation. A shipped fix whose ticket stays open reads as unshipped, erodes the queue, and makes him re-state things. When a "Top" pick turns out already shipped, say so and close it rather than re-doing it.

## Mobile bugs: the ?probe loop (Evren's standing method, 2026-07-21)

iOS layout bugs routinely do NOT reproduce in DevTools emulation (text-size-adjust, URL-bar collapse, visual-viewport panning). Do not ship guesses. The method:

1. The app has a disposable on-device instrument: open the hosted app with `?probe` (`…/task-board.html?probe`). A fixed overlay reports innerWidth vs document scrollWidth, visualViewport width/offset/scale, `main.scrollLeft`, main's and the first group's rect + computed padding/margin, and names elements crossing the viewport edge.
2. His phone caches hard: give him a cache-busting query (`?probe&fresh=N`) and check the sidebar version matches the latest build before trusting a "still broken".
3. He screenshots the overlay into chat; the numbers name the culprit (real overflow vs viewport pan vs asymmetric padding). Fix from data, then have him re-probe.
4. Extend the probe's readout rather than inventing a new instrument, and keep it gated behind the flag (zero UI otherwise). It is throwaway tooling: delete it when the bug class is closed, revive it from git when needed.

## Braindump and intake

Private until the Intake button posts `"Braindump intake requested"` into chat. Top of the braindump = highest priority. On intake: view any embedded images FIRST, fetch links when context matters, classify each item's lane (card when unsure), check whether it was mentioned before and NAME the duplicate in the summary, triage in STAGED quiet-writes a few seconds apart (the button glows "Intaking braindump…" until the group empties), preserve his task objects (move, never retype), never silently delete non-empty leftovers, and post a placement summary in chat.

## Preferences and auto mode

`status/prefs.json` (gitignored; `GET/POST /prefs`) holds Evren's toggles from the chat's gear menu. `preferParallel` (default true when absent): when true, spawn named subagents for cleanly splittable work and give each a presence beat under its own name (`claude-sub1` style — POST /agents directly for one-shot beats) so he sees them on the graph; when false, work single-threaded. `notifications` is page-side (desktop notifications when input is needed, an agent message lands, or a run completes — only while the tab is hidden). **`fullAuto` changes YOUR behavior**: when true, keep working through the queue without waiting for "continue" — finish an item, pick up the next, announce transitions in chat. Do NOT end a turn asking "which item next?" — that is stopping (he corrected exactly this, 2026-07-19). Pick by priority and go; post cards for real design forks and keep working on something else while they wait. Still stop for the things that always need him: grill-worthy design decisions (card + wait), destructive or outward-facing actions, and anything ponytail says is a big call. Check the file at every natural pause point; when false, pause after each item as usual. Restarting the server yourself: use `node ../aide-board/ensure-server.mjs --quiet` so it does not false-announce a new session.

## Chat wake-up (2026-07-18, after two missed-message complaints)

Between turns nothing reads the chat, so his messages sit unseen until he types in the terminal. Arm a watcher at session start, BEFORE settling into work, and re-arm it whenever you end a turn while still on duty: watch `status/chat.jsonl` for appended lines containing `"from":"user"` OR the Intake button's system line — the button posts `Braindump intake requested` as `"from":"system"`, and a user-only filter sleeps straight through it (this happened, 2026-07-18, 45 minutes lost). Claude Code: `Monitor` tool, persistent, with `tail -n 0 -f status/chat.jsonl | grep -E --line-buffered '"from":"user"|Braindump intake requested'`. Other harnesses: whatever file-watch wakes you; if none exists, say so in chat so he knows typed chat will not reach you until the next terminal prompt.

## Pause and stop (chat header buttons, 2026-07-19)

The ⏸ and ⏹ buttons post user messages ("⏸ PAUSE …", "⏹ STOP …") that arrive through the same watcher as any chat line. On PAUSE: finish the tool step in flight, acknowledge in chat, deregister the heartbeat, and start NO new work until he writes resume (or anything else that is an instruction). On STOP: post a short state log (what shipped, what is mid-flight, where it is written down), deregister, verify `/agents` is `[]`, and end the session's work — he is closing the laptop. Neither can interrupt a step already running; say so in the ack if the gap was noticeable.

## Notes become board items in the same turn (his complaint, 2026-07-28)

"I feel like we seem to forget previous items I note down." He was right. His best thinking arrives in the `(note: ...)` half of a test-round reply or trailing a chat message, and those were being answered conversationally and then lost when the turn ended.

**Rule: every note inside a chat message or a review-page reply becomes a board item BEFORE any code is written that turn.** Not after shipping, not "if it still matters" — first, in his words, quoted. A note that is already covered still gets a reply saying which item covers it. `/batch` renders every open item on the board grouped and counted, so he can check nothing is sitting unboarded without asking.

## Chat conduct

Style: humanizer rules — no em-dashes, short sentences, concrete facts, a few lines per message (see the chat-style memory). Name the layer of every change: the app (`src/`) or the development interface (`status/`); ambiguous mentions get "(for the development interface)". During long tasks, update the heartbeat status at every phase change and drop one-line phase notes in chat — silence reads as nothing happening. Grill design decisions before building; tentative phrasing ("maybe", "?") is a grill trigger, not a spec. Token counts are not visible to local scripts — never fake a number.

## Verification discipline

Never run destructive probes (create/delete/edit) on the live status board — it is Evren's real data. App changes get verified in isolated browser contexts (`new_page` with `isolatedContext`) against the built file; the status board inherits app fixes on rebuild. The layer contract: `status/` never copies app code, and the coupling is 14 strings the wrapper reaches for inside the board iframe (nine DOM hooks, three CSS classes it paints, `applyExternalState`). Both sides check the list — `BOARD_HOOKS` in `../aide-board/refresh-board.mjs`, and the app suite in `tests/task-board.static.test.mjs` — so rename one and update both in the same commit. `../aide-board/README.md` documents the tool as a standalone thing, including how the board pane stays in step with Punchlist builds.
