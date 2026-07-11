# Agent Handoff

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

`outputs/task-board.html` is generated from `src/` by `scripts/build-task-board.mjs` and implements the full agreed scope: nested outline editing with undo and drag/drop (mouse and long-press touch), versioned schema (v2) with migration, Markdown clipboard interchange, alias/reference placements, configurable Completed/Trash lifecycle with `task > group > global` policy overrides, optional scheduling (date, start time, planned minutes, reminders, day Timeline with drag rescheduling and Alt+arrow nudging), planned-versus-actual focus variance, a collapsible sidebar with Views/Groups navigation and phone drawer, dark-mode group tints, help panel, favicon, and "Restore example board" with confirmation.

Verification as of 2026-07-11: 54 tests in `tests/task-board.static.test.mjs` pass; `tests/task-board.browser.smoke.mjs` is a reusable Playwright smoke workflow that skips cleanly when no Playwright runtime is installed (none is currently installed here — real-browser acceptance ran through the Chrome DevTools MCP instead, at 1440x900 and 390x844, light and dark, covering editing, keyboard navigation, alias sync, Markdown paste, lifecycle restore, feature-flag invisibility, timeline drag rescheduling, sidebar collapse/drawer, focus timing persistence, reload persistence, and console/overflow checks).

Do not encode mutable placement into task IDs; aliases/references, lifecycle history, and scheduling all rely on stable task identity.

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
