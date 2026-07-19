# Using the development interface in another repo

The status board is not packaged as a tool, on purpose: it has one user and one
installation. Copying it takes five minutes; an installer would take an evening
and rot. Build one only when a second repo actually runs this weekly
(`ponytail:` manual copy, installer when N≥2).

## Steps

1. Copy the whole `status/` folder into the target repo. It is self-contained:
   server, wrapper page, chat/ask/heartbeat scripts, `ensure-server.mjs`.
2. Give it a board to embed. `status/serve.mjs` serves `/board` from
   `../website/task-board.html` — either copy a built `task-board.html` to that
   path in the target repo, or edit that one line in `serve.mjs` to point
   anywhere else.
3. Delete `status/status-board.json` and `status/chat.jsonl` (they carry THIS
   project's state); the server recreates the chat file, and the board seeds
   empty. Keep `prefs.json` out of git (`.gitignore`: `status/prefs.json`).
4. Wire the session start. In the target repo's `AGENTS.md` (or CLAUDE.md):
   run `node status/ensure-server.mjs` at session start, introduce yourself in
   chat, arm the chat watcher (see "Chat wake-up" in
   `docs/AGENT_INTERFACE.md` here — copy that section across).
5. Port 4173 is hardcoded in `serve.mjs` and `index.html`; running two repos'
   boards at once means changing it in both files for the second repo.

That is the whole install. The board protocol, braindump/intake flow, and
presence rules travel with `docs/AGENT_INTERFACE.md` — copy it along.
