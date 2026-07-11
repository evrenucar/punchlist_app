# Punchlist

Punchlist is a lightweight, local-first task organizer for capturing, structuring, scheduling, and completing work. The distributable app is a single static HTML file that opens directly in a browser; it has no database, required server, runtime dependencies, or account. (Repository name predates the branding.)

## Open the app

Open [`outputs/task-board.html`](outputs/task-board.html) in a browser.

Board data is saved in that browser's local storage. Use JSON export for a lossless backup and Markdown copy/export for portable task outlines. Different browsers do not share local storage; cross-browser sync is deliberately deferred to a future optional JSON-file helper.

## Features

- Nested outline editing with keyboard commands, multi-select, undo, and mouse or long-press touch drag.
- Markdown clipboard: copy tasks as clean indented Markdown, paste external Markdown as new tasks, and paste internally as aliases, references, or duplicates.
- Configurable lifecycle: completed tasks hide after a chosen duration into a Completed view, and deletes go to a restorable Trash by policy (`task > group > global` overrides available).
- Optional planning tools (off by default): per-task date, start time, planned minutes, reminders, a day Timeline with drag rescheduling, and planned-versus-actual focus comparison.
- Collapsible sidebar with Views/Groups navigation, phone drawer layout, light and dark themes, and a built-in Help panel.

## Development

Source files are authored in `src/` and inlined into the single distributable file by a zero-dependency build script:

- `src/task-board.html` - semantic application shell
- `src/task-board.css` - responsive light/dark presentation
- `src/task-board.js` - state, editor, scheduling, and persistence
- `scripts/build-task-board.mjs` - bundler that emits `outputs/task-board.html`
- `tests/task-board.static.test.mjs` - Node tests for state, lifecycle, scheduling, and output contract

Build and test with:

```powershell
node scripts/build-task-board.mjs
node --test tests/task-board.static.test.mjs
```

Never hand-edit `outputs/task-board.html`; change `src/` and rebuild.

## Website

`website/` holds a static landing page (`index.html`) plus a copy of the app that the build script refreshes on every build. Deploy the folder as-is to any static host. To collect emails server-side, set `FORM_ENDPOINT` near the bottom of `index.html` to a form service URL; until then the form falls back to a prefilled email draft.

## Product rules

- JSON is canonical and lossless; Markdown is clean interchange.
- Stable task IDs never encode mutable group or parent placement.
- The default interface is a minimal outline. Advanced capabilities stay absent until enabled in Settings.
- Day Plan is an ordinary group by default. Timeline is an optional view of the same tasks.
- Delete is configurable, but safe defaults preserve restorable records in Trash.
- Existing locally saved boards must migrate without losing text, hierarchy, completion, colors, or focus time.
- Desktop keyboard workflows and phone touch workflows are equal requirements.

See [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) for implementation context and [`docs/ROADMAP.md`](docs/ROADMAP.md) for prioritized work.
