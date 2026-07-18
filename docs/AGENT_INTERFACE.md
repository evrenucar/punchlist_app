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

- The JSON file is two-way (~2 s each direction). ALWAYS re-read before writing. NEVER write while Evren is mid-edit: wait until the file's mtime is >8 s old, write on top of fresh state, verify your ids survive ~6 s later, retry (the quiet-write loop). Your writes reload his iframe, so also avoid wrapper-page reloads outside quiet windows; remote updates already defer up to 60 s while his caret sits in an editable.
- Task fields the wrapper understands: `by` (`agent`/`user`/`seed` — authorship colors; never strip), `lane` (`dev`/`app` — the yellow/blue node tags; set on every item you create), `active` (purple glow + ACTIVE bar + graph anchor; keep truthful), `inserted` (renders on the open branch below the active/idle node).
- Agent_Active (`group-inbox`) holds actionable items only. New priority items go immediately AFTER the current active item, with `inserted: true`. Finished items: `done` + `completedAt`, `active: false`, moved UNDER `task-agent-completed` at the TOP (latest first). Finished `inserted` items stay visible as gray nodes on their branch.
- Every piece of work gets a board item — nothing happens off-graph. Work arriving via terminal counts the same as chat or board input.

## Braindump and intake

Private until the Intake button posts `"Braindump intake requested"` into chat. Top of the braindump = highest priority. On intake: view any embedded images FIRST, fetch links when context matters, classify each item's lane (card when unsure), check whether it was mentioned before and NAME the duplicate in the summary, triage in STAGED quiet-writes a few seconds apart (the button glows "Intaking braindump…" until the group empties), preserve his task objects (move, never retype), never silently delete non-empty leftovers, and post a placement summary in chat.

## Preferences and auto mode

`status/prefs.json` (gitignored; `GET/POST /prefs`) holds Evren's toggles from the chat's gear menu. `notifications` is page-side (desktop notifications when input is needed, an agent message lands, or a run completes — only while the tab is hidden). **`fullAuto` changes YOUR behavior**: when true, keep working through the queue without waiting for "continue" — finish an item, pick up the next, announce transitions in chat. Still stop for the things that always need him: grill-worthy design decisions (card + wait), destructive or outward-facing actions, and anything ponytail says is a big call. Check the file at every natural pause point; when false, pause after each item as usual. Restarting the server yourself: use `node status/ensure-server.mjs --quiet` so it does not false-announce a new session.

## Chat wake-up (2026-07-18, after two missed-message complaints)

Between turns nothing reads the chat, so his messages sit unseen until he types in the terminal. Arm a watcher at session start, BEFORE settling into work, and re-arm it whenever you end a turn while still on duty: watch `status/chat.jsonl` for appended lines containing `"from":"user"` and treat each hit as an instruction to handle. Claude Code: `Monitor` tool, persistent, with `tail -n 0 -f status/chat.jsonl | grep --line-buffered '"from":"user"'`. Other harnesses: whatever file-watch wakes you; if none exists, say so in chat so he knows typed chat will not reach you until the next terminal prompt.

## Chat conduct

Style: humanizer rules — no em-dashes, short sentences, concrete facts, a few lines per message (see the chat-style memory). Name the layer of every change: the app (`src/`) or the development interface (`status/`); ambiguous mentions get "(for the development interface)". During long tasks, update the heartbeat status at every phase change and drop one-line phase notes in chat — silence reads as nothing happening. Grill design decisions before building; tentative phrasing ("maybe", "?") is a grill trigger, not a spec. Token counts are not visible to local scripts — never fake a number.

## Verification discipline

Never run destructive probes (create/delete/edit) on the live status board — it is Evren's real data. App changes get verified in isolated browser contexts (`new_page` with `isolatedContext`) against the built file; the status board inherits app fixes on rebuild. The layer contract: `status/` never copies app code; the whole coupling is three DOM hooks (`data-task-row`, `data-group-title`, `data-sidebar-toggle`) guarded by a test in the app suite — rename a hook, update the wrapper in the same commit.
