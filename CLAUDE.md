# Punchlist — instructions live in AGENTS.md

This project is agent-agnostic. ALL instructions — session start, reading order, commands, the development-interface hard rules, the override rules, layout — live in [`AGENTS.md`](AGENTS.md), the same file every other agent harness reads. Read it NOW and treat it as binding; nothing here overrides it.

(Claude Code specifics: the SessionStart hook in `.claude/settings.json` automates the `node status/ensure-server.mjs` step that AGENTS.md asks every agent to run.)
