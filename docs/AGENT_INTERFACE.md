# The development interface (status board)

Everything an agent needs to operate the live status board at **http://localhost:4173/**. CLAUDE.md holds the six hard rules; this file holds the mechanics. It is agent-agnostic: wherever a name is needed, use your own agent/model name.

## What it is

A wrapper page (`status/index.html`) embedding the real built app (`website/task-board.html`) in an iframe, seeded from `status/status-board.json`. A ~50-line zero-dependency server (`status/serve.mjs`, port 4173) mediates everything. A SessionStart hook runs `status/ensure-server.mjs` so it is always up; the hook also posts a "new agent session" line into chat — introduce yourself by name in your first chat message.

At session start, open the wrapper as a normal (non-isolated) tab in the agent-controlled browser — for Claude Code the Chrome DevTools MCP window — never Evren's default browser (his request, 2026-07-18). He uses that window; open links you want to show him as new tabs there. Keep destructive/app testing in isolated contexts; his tab is live data.

## Server endpoints

- `GET /` wrapper page · `GET /board` the built app · `GET /state` the board JSON
- `POST /state` full board JSON (validated; `state.identity` stripped — a signing keypair must NEVER land in this git-tracked file)
- `GET /chat` chat log (JSONL) · `POST /chat` `{from: user|agent|system, text, img?, question?, answerTo?}`
- `GET /agents` live registry `[{name, taskId, at, since, status}]` (entries expire 90 s after the last beat) · `POST /agents` heartbeat/deregister

## Scripts

- `node status/say.mjs [--img <path>] <message>` — chat as the agent. Links render clickable; `--img` attaches a png/jpg/webp (screenshots of the page are a good way to SHOW things).
- `node status/ask.mjs [--multi] "Question" "Opt 1" "Opt 2" [...]` — question cards with tappable answers; replies arrive as user messages with `answerTo`.
- `node status/agent-heartbeat.mjs <name> <taskId> [status...]` — presence: a named chip on the graph node plus task/runtime/status in the page header. Re-run with new status text at every phase change; the runtime clock survives. **Before ending ANY turn, kill the beat processes and verify `GET /agents` returns `[]`** — a beating orphan between turns shows Evren a running agent that is not running (this has bitten twice, 2026-07-17). Killing: TaskStop only kills the shell wrapper on Windows — kill the node child by PID (`wmic process where "commandline like '%agent-heartbeat%'" get processid`, which matches its own pipeline, so trust `GET /agents` = `[]` as ground truth), then `--stop`.
- `node status/extract-images.mjs <substring> <outdir>` — dump images embedded in board items to files so you can view them.
- `node status/build-status-artifact.mjs <out.html>` — hosted-snapshot bake. BANNED from routine use: local only, never publish or link claude.ai artifacts unless Evren explicitly asks.

## Board protocol

- The JSON file is two-way (~2 s each direction). ALWAYS re-read before writing. NEVER write while Evren is mid-edit: wait until the file's mtime is >8 s old, write on top of fresh state, verify your ids survive ~6 s later, retry (the quiet-write loop). Write through `status/board-write.mjs` (`readBoard`/`writeBoard`) — it enforces the quiet window AND logs your edit to the app's History panel attributed to the agent device, like another user sharing the board (Evren's spec, 2026-07-19). Pass a short human-readable summary as the history text on every write. Your writes reload his iframe, so also avoid wrapper-page reloads outside quiet windows; remote updates already defer up to 60 s while his caret sits in an editable.
- Task fields the wrapper understands: `by` (`agent`/`user`/`seed` — authorship colors; never strip), `lane` (`dev`/`app` — the yellow/blue node tags; set on every item you create), `active` (purple glow + ACTIVE bar + graph anchor; keep truthful), `inserted` (priority-insertion marker for board ordering; the graph no longer special-cases it).
- The graph is the F+ STAIRCASE (Evren's pick, 2026-07-19): one horizontal trunk = the timeline (compacted older done → last three done → active → queue → friction buckets), and ONE staircase of children stepping down-right under the selected trunk node, sibling stacks capped behind +N pills. Blue dots mark items created since his last graph open. He walks it with arrows (←→ siblings, ↓ deeper, ↑ back, Enter descend, J jump) — so keep item TEXT front-loaded (the first line is what a trunk node shows) and keep children meaningful: they are the steps he reads.
- Agent_Active (`group-inbox`) holds actionable items only. New priority items go immediately AFTER the current active item, with `inserted: true`. Finished items: `done` + `completedAt`, `active: false`, moved UNDER `task-agent-completed` at the TOP (latest first). Finished `inserted` items stay visible as gray nodes on their branch.
- Every piece of work gets a board item — nothing happens off-graph. Work arriving via terminal counts the same as chat or board input.

## Braindump and intake

Private until the Intake button posts `"Braindump intake requested"` into chat. Top of the braindump = highest priority. On intake: view any embedded images FIRST, fetch links when context matters, classify each item's lane (card when unsure), check whether it was mentioned before and NAME the duplicate in the summary, triage in STAGED quiet-writes a few seconds apart (the button glows "Intaking braindump…" until the group empties), preserve his task objects (move, never retype), never silently delete non-empty leftovers, and post a placement summary in chat.

## Preferences and auto mode

`status/prefs.json` (gitignored; `GET/POST /prefs`) holds Evren's toggles from the chat's gear menu. `preferParallel` (default true when absent): when true, spawn named subagents for cleanly splittable work and give each a presence beat under its own name (`claude-sub1` style — POST /agents directly for one-shot beats) so he sees them on the graph; when false, work single-threaded. `notifications` is page-side (desktop notifications when input is needed, an agent message lands, or a run completes — only while the tab is hidden). **`fullAuto` changes YOUR behavior**: when true, keep working through the queue without waiting for "continue" — finish an item, pick up the next, announce transitions in chat. Do NOT end a turn asking "which item next?" — that is stopping (he corrected exactly this, 2026-07-19). Pick by priority and go; post cards for real design forks and keep working on something else while they wait. Still stop for the things that always need him: grill-worthy design decisions (card + wait), destructive or outward-facing actions, and anything ponytail says is a big call. Check the file at every natural pause point; when false, pause after each item as usual. Restarting the server yourself: use `node status/ensure-server.mjs --quiet` so it does not false-announce a new session.

## Chat wake-up (2026-07-18, after two missed-message complaints)

Between turns nothing reads the chat, so his messages sit unseen until he types in the terminal. Arm a watcher at session start, BEFORE settling into work, and re-arm it whenever you end a turn while still on duty: watch `status/chat.jsonl` for appended lines containing `"from":"user"` OR the Intake button's system line — the button posts `Braindump intake requested` as `"from":"system"`, and a user-only filter sleeps straight through it (this happened, 2026-07-18, 45 minutes lost). Claude Code: `Monitor` tool, persistent, with `tail -n 0 -f status/chat.jsonl | grep -E --line-buffered '"from":"user"|Braindump intake requested'`. Other harnesses: whatever file-watch wakes you; if none exists, say so in chat so he knows typed chat will not reach you until the next terminal prompt.

## Pause and stop (chat header buttons, 2026-07-19)

The ⏸ and ⏹ buttons post user messages ("⏸ PAUSE …", "⏹ STOP …") that arrive through the same watcher as any chat line. On PAUSE: finish the tool step in flight, acknowledge in chat, deregister the heartbeat, and start NO new work until he writes resume (or anything else that is an instruction). On STOP: post a short state log (what shipped, what is mid-flight, where it is written down), deregister, verify `/agents` is `[]`, and end the session's work — he is closing the laptop. Neither can interrupt a step already running; say so in the ack if the gap was noticeable.

## Chat conduct

Style: humanizer rules — no em-dashes, short sentences, concrete facts, a few lines per message (see the chat-style memory). Name the layer of every change: the app (`src/`) or the development interface (`status/`); ambiguous mentions get "(for the development interface)". During long tasks, update the heartbeat status at every phase change and drop one-line phase notes in chat — silence reads as nothing happening. Grill design decisions before building; tentative phrasing ("maybe", "?") is a grill trigger, not a spec. Token counts are not visible to local scripts — never fake a number.

## Verification discipline

Never run destructive probes (create/delete/edit) on the live status board — it is Evren's real data. App changes get verified in isolated browser contexts (`new_page` with `isolatedContext`) against the built file; the status board inherits app fixes on rebuild. The layer contract: `status/` never copies app code; the whole coupling is three DOM hooks (`data-task-row`, `data-group-title`, `data-sidebar-toggle`) guarded by a test in the app suite — rename a hook, update the wrapper in the same commit.
