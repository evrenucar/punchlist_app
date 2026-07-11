# Agent Handoff

The product is branded **Punchlist** (renamed 2026-07-11; file and repo names predate the branding). User-facing copy says "linked copy" for alias placements and "shortcut" for references; the internal schema keeps `alias`/`reference`.

## Purpose

This project is a personal task organizer optimized for fast capture, nested outlining, daily selection, scheduling, and focus. It is not a team project manager, cloud service, or general knowledge database.

The user routinely dumps unstructured work, then needs to:

1. Organize it into project groups and arbitrary subtask depth.
2. Select what matters now without removing project context.
3. Schedule work by date and optionally arrange a day timeline.
4. Compare planned active effort with actual focused time.
5. Export clean Markdown to Notion, Obsidian, or another editor.

## Non-negotiable constraints

- Keep the distributable app as one directly-openable static HTML file.
- Do not add a database or required server.
- Do not add a framework or package dependency without explicit evidence that native HTML/CSS/JavaScript cannot cover the behavior.
- Persist locally and provide lossless JSON import/export.
- Preserve existing browser data through schema migration.
- Keep the default UI minimal. Disabled features must have no visible controls, panels, badges, or prompts.
- Support laptop keyboard/mouse and phone touch interaction.
- Maintain undo for destructive board actions.

## Current state

`outputs/task-board.html` is generated from `src/` by `scripts/build-task-board.mjs` (which also refreshes `website/task-board.html`). Everything in the original scope shipped, plus several iteration rounds driven by the user's live usage:

- Outline editing with 40-step undo, mouse and long-press touch drag, caret-aware Enter, Shift+Enter line breaks (with an end-of-content `<br>` sentinel because `pre-wrap` swallows a trailing newline), Ctrl+Enter completes, Alt+A adds a group, Ctrl+Shift+Down/Up expands/collapses all.
- Markdown clipboard (groups copy as `## Heading` with full contents even when collapsed), linked copies (`alias`) and shortcuts (`reference`), external Markdown paste.
- Lifecycle: Completed/Trash as expandable rows (newest first) showing origin group/parent and time; `task > group > global` policy overrides whose "Use global (…)" options name the current global value; slide-away animation when completion hides a task.
- Planning (all behind flags, off by default): task details panel (also shows group info; date/reminder auto-fill with relative-date hints), day timeline docked as a right-hand pane (List and Timeline independently toggleable, one always on), reminders with toasts/notifications.
- Task images: paste attaches (canvas-compressed to max 800px WebP/JPEG), drag side-bars to resize, editable caption line under each image (typing/pasting text on a selected image goes to the caption; pasting an image anywhere in the block attaches separately), double-click opens a zoom/pan lightbox, images are arrow-selectable nodes and Delete removes one at a time.
- Focus mode: full editor (Enter on title creates a first child, Enter splits children, Tab/Shift+Tab indent, Backspace-on-empty deletes, square checkboxes toggle done); works for groups (editable title, adds tasks); hides retention-hidden tasks like the main view; shows the clock; empty-text rows render (they must — new tasks start empty).
- Shell: resizable sidebar (drag divider, 200–420px, persisted), collapsible Views/Settings/Help/History sections with rotating triangles, History panel with per-entry expansion and Restore buttons for deletions (exact via `entry.trashId`, fuzzy name-match fallback for older entries), search that expands everything non-destructively while typing, one-keyboard-zone-at-a-time navigation reaching sidebar, hamburger, topbar toggles, search, and the Completed/Trash sections.
- Settings sharing: username field + "Export settings" (`punchlist-settings-{user}-{date}.json`, kind `punchlist-settings`); the regular Import JSON button recognizes settings files and applies only settings. Board exports exclude settings; importing a board backup keeps local settings.

Verification as of retirement (2026-07-11 evening): 67 tests in `tests/task-board.static.test.mjs` pass; the Playwright smoke test skips (no runtime installed); browser acceptance ran continuously through the Chrome DevTools MCP against the built file at desktop and phone widths in both themes.

Do not encode mutable placement into task IDs; aliases/references, lifecycle history, and scheduling all rely on stable task identity.

## Hard-won working notes (read before touching code)

- **Never write `src/` files with PowerShell 5.1 `-Encoding utf8`** — it prepends a BOM, the build inlines it mid-document, the browser drops the `:root` rule, and every font falls back to serif. Use `[System.IO.File]::WriteAllText` (BOM-free) or the Write tool. This actually happened; the fix was stripping the BOM.
- **The user's live board is in this machine's browser localStorage under the `file://` origin** (key `scheduling-task-management-board-v1`). Any browser-based testing mutates their real data: revert every test mutation (tasks, images, history entries, trash records, settings) before ending a session.
- **The vm test harness** (`loadBoardApi` in the static test file) stubs a minimal DOM: no `document.body`, no `documentElement`, `document.querySelectorAll` returns `[]`. All new element access must be null-guarded; `window.setTimeout` may be absent. Objects returned across the vm boundary fail `assert.deepEqual` (realm prototypes) — compare via `JSON.stringify`.
- **Synthetic keyboard events targeted at `document` throw** in handlers that call `event.target.matches` — they are now `?.`-guarded, but when testing, dispatch on the focused element like real events do.
- **`renderSelection(forceFocus)`**: without `true` it will not steal focus from inputs/sidebar (that guard fixed search typing being hijacked); the deliberate "return to board" keyboard flows must pass `true`.
- **Keyboard zones**: the global keydown handler early-returns for events originating in `.sidebar` and for interactive elements outside the board — that is what keeps Enter working on the hamburger and stops dual-zone selection. Don't add global key handling above those guards without checking both.
- **`getVisibleNodes()` is the single source of keyboard order** and now yields four node kinds: `group`, `task`, `image` (with `taskId`), `section` (`completed`/`trash`). Every consumer must tolerate all kinds.
- **History**: `pushUndoState(action, detail)` logs to `state.history` (capped 50, persisted). Deletion entries carry `trashId` for precise restore. The `collapse` action logs nothing on purpose. History survives undo (log first, then snapshot).
- **Images** live on tasks as `{id, src(dataURL), width, caption}`. localStorage caps around 5 MB per origin — compressed screenshots run 50–200 KB, so warn the user before they hoard. `normalizeTask` drops non-`data:image/` sources.
- **Artifact hosting**: the built file is republished (same URL) by stripping the outer `doctype/html/head/body` wrapper and calling the Artifact tool with the same scratchpad path: https://claude.ai/code/artifact/df565bd3-dabf-4e57-af42-a2eef8e3a27f — its board data is a separate localStorage origin from the local file.
- **Website** (`website/index.html`): static landing page, zero external requests by design (claims so in its footer — keep it true). Copy follows the `no-ai-slop` + `rossmann-voice` skills in `.claude/skills/` (also `ponytail`). Email capture posts to `FORM_ENDPOINT` (empty → mailto fallback).

## Known rough edges

- Chrome DevTools flags two benign a11y issues: interactive buttons inside `<summary>` (lifecycle/history rows; activation is preventDefault-handled) and form fields without ids.
- Enter on a selected image is a no-op by choice; the user may later want it to create a sibling task.
- History restore fallback matches by displayed name; duplicate-named trash records may restore the wrong instance (fresh deletions always link precisely by `trashId`).
- On phones, task action buttons appear only on the selected row (deliberate de-clutter).
- Group focus mode has no timer (focus time stays a per-task concept).

## Agreed behavior

### Default experience

- Single-column outline with collapsible groups and tasks.
- Day Plan behaves like another normal group.
- Sidebar is collapsible and provides navigation to views and groups.
- Focus timing remains enabled.
- Timeline, reminders, browser notifications, task metadata UI, and per-group/per-task policy overrides begin disabled.

### Optional experience

Settings can enable each capability independently. Enabling advanced policy overrides exposes group and task controls with precedence `task > group > global`.

### Linking and clipboard

- An original task remains in its project group when scheduled or linked elsewhere.
- Alias is the default linked placement: edits and completion affect the one underlying task.
- Reference is a compact link that jumps to the original.
- `Ctrl+C` writes indented Markdown to the system clipboard and remembers stable task IDs internally.
- Internal paste uses the configured default: alias, reference, duplicate, or ask.
- `Ctrl+X` followed by paste moves placements.
- External Markdown paste creates new task trees.

### Lifecycle

- Completion visibility can be forever, immediate, or any custom duration.
- Hidden completed tasks appear in a Completed view and remain restorable.
- Delete policy can be permanent, Trash forever, or Trash for a custom duration.
- Trash records whether a task was complete before deletion and preserves original placement metadata.
- JSON/Markdown export can include or exclude completed and deleted records.

### Scheduling and timing

- Tasks may have an optional date, start time, planned active minutes, reminder time, and accumulated actual focus seconds.
- List view remains the minimal outline.
- Optional Timeline shows the whole day, a current-time marker, duration-sized blocks, nested headings, drag rescheduling, and unscheduled tasks at the bottom.
- Planned-versus-actual variance is derived, not separately edited.

## Data guidance

Every task needs an immutable ID and separate metadata such as:

```json
{
  "id": "task-immutable-id",
  "text": "Task text with [portable links](https://example.com)",
  "createdAt": "2026-07-11T12:00:00.000Z",
  "createdInGroupId": "group-id",
  "createdUnderTaskId": null,
  "completedAt": null,
  "plannedMinutes": null,
  "actualSeconds": 0,
  "schedule": null,
  "reminderAt": null
}
```

Current placement and original creation context are different facts. Moving a task must not rewrite its creation metadata. Alias/reference placements need their own placement IDs while pointing at one task ID.

## Verification expectations

Before staging or committing behavior changes:

1. Run the complete Node suite.
2. Build the static output when source files exist.
3. Run `git diff --check`.
4. Exercise file-URL workflows in Playwright at desktop and phone viewports.
5. Verify both light and dark themes, keyboard navigation, touch/drag behavior, focus mode, import/export, and data migration.
6. Inspect browser console errors and screenshots.

## Deferred work

- Optional JSON-file sync helper for sharing one board between browsers.
- Reliable reminders while the board is closed; this requires a PWA/server-capable mode.
- External calendar integration.
- Research task: compare Obsidian, ClickUp, Todoist, Things, Notion, and Reddit discussions to identify recurring task-management pain points and valuable workflows before expanding scope.
