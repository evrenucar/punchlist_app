# Scheduling & Task Management

A lightweight, local-first task organizer for capturing, structuring, scheduling, and completing work. The distributable app is a single static HTML file that opens directly in a browser; it has no database, required server, runtime dependencies, or account.

## Open the app

Open [`outputs/task-board.html`](outputs/task-board.html) in a browser.

Board data is saved in that browser's local storage. Use JSON export for a lossless backup and Markdown copy/export for portable task outlines. Different browsers do not share local storage; cross-browser sync is deliberately deferred to a future optional JSON-file helper.

## Development

The current implementation and its focused regression suite are:

- `outputs/task-board.html` - complete static application
- `tests/task-board.static.test.mjs` - Node tests for state and interaction behavior

Run the tests with:

```powershell
node --test tests/task-board.static.test.mjs
```

The planned source split keeps the delivered file static while making the code easier to maintain:

- `src/task-board.html` - semantic application shell
- `src/task-board.css` - responsive light/dark presentation
- `src/task-board.js` - state, editor, scheduling, and persistence
- `scripts/build-task-board.mjs` - zero-dependency bundler that emits `outputs/task-board.html`

## Product rules

- JSON is canonical and lossless; Markdown is clean interchange.
- Stable task IDs never encode mutable group or parent placement.
- The default interface is a minimal outline. Advanced capabilities stay absent until enabled in Settings.
- Day Plan is an ordinary group by default. Timeline is an optional view of the same tasks.
- Delete is configurable, but safe defaults preserve restorable records in Trash.
- Existing locally saved boards must migrate without losing text, hierarchy, completion, colors, or focus time.
- Desktop keyboard workflows and phone touch workflows are equal requirements.

See [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) for implementation context and [`docs/ROADMAP.md`](docs/ROADMAP.md) for prioritized work.
