# Static Task Board Design

## Product thesis

Build a fast personal outline that can become a day planner when requested. The default surface should feel as direct as editing Markdown: groups, bullets, indentation, selection, and immediate typing. Advanced scheduling, reminders, timing metadata, aliases, lifecycle policy overrides, and timeline visuals are opt-in.

## Visual thesis

Quiet utilitarian minimalism. Use a neutral paper-like light theme and genuinely dark surfaces in dark mode, one restrained action accent, crisp dividers, compact typography, and minimal animation. The interface is a working tool rather than a dashboard or landing page.

The signature interaction is continuity: the same task can be seen in its project, Day Plan, alias placement, and Focus view without becoming duplicate data.

## Architecture

Use native HTML, CSS, and JavaScript. Author the application as focused source files and use a tiny Node standard-library build script to inline them into one `outputs/task-board.html`. The output must work from `file://` with no build or server needed by the user.

JSON is the canonical complete representation. Local storage holds the working JSON snapshot. JSON export/import is lossless. Markdown is a clean interchange format for selected subtrees, groups, and board exports; it does not carry hidden IDs or schedule metadata.

## State model

Use a versioned state envelope with migrations. Stable entities and placements are separate concepts:

- Task entity: immutable identity, Markdown text, completion, schedule, reminder, planned effort, actual focus time, creation metadata.
- Placement: location in a group/tree, ordering, collapse state, and mode (`original`, `alias`, or `reference`).
- Group: identity, title, color, collapse state, optional role, placement tree, optional policy overrides.
- Trash record: deleted placement subtree, deletion time, prior completion state, and restore location.
- Settings: feature flags, lifecycle defaults, optional override enablement, export policy, paste behavior, theme, sidebar state, and timeline preferences.

Never put a mutable group or parent identifier inside a task ID. Creation context is immutable metadata; current placement is separate.

## Outline editor

- Arrow keys browse every visible group and task.
- Shift+Arrow extends contiguous selection.
- Alt+Arrow moves all selected placements while preserving relative order.
- Ctrl+Up/Down collapses or expands selected nodes.
- Enter splits at the caret: at offset zero it inserts above; at end it inserts below.
- Shift+Enter inserts a line break.
- Tab and Shift+Tab indent/outdent synchronously and keep editing focus.
- Backspace deletes selected text first; on an already-empty task it removes the task and selects the logical previous row.
- Delete/Backspace outside text editing applies the configured deletion action to selected rows.
- Ctrl+Z reverses board mutations.

Raw URLs render as links. Pasting a URL over selected text stores Markdown link syntax. Link clicks must not accidentally begin editing or dragging.

## Linking and clipboard

Clipboard export always writes clean indented Markdown. The app also remembers copied task IDs internally for same-board paste. Paste behavior is configurable as alias, reference, duplicate, or ask; alias is default. Cut/paste moves placements. External Markdown paste parses indentation into new task trees.

Aliases render the task normally and synchronize edits, completion, schedule, and timing. References render compactly and navigate to the original. Both show a link indicator and origin information on hover/focus. Cyclic placement ancestry must be rejected.

## Completion and deletion

Completion and deletion use timestamps and derived views rather than destructive relocation whenever possible.

Completion visibility supports indefinitely, immediately, or a custom duration in seconds. Hidden completed tasks appear in Completed and can be restored to active state. Delete policy supports permanent deletion, indefinite Trash, or custom Trash retention. Trash preserves enough context to restore a subtree. A task completed before deletion remains identifiable as completed-and-deleted.

Policies resolve in this order: task override, group override, global setting. Group and task overrides are unavailable until explicitly enabled in Advanced Settings.

## Scheduling, reminders, and timing

Day Plan is an ordinary group by default. Scheduling a task adds a reference/alias view without removing the original project placement.

Optional Daily Planning adds List/Timeline switching. Timeline includes:

- Configurable visible day range and time increment.
- Current-time line.
- Duration-sized scheduled blocks.
- Compact blocks when planned effort is absent.
- Nested group/subgroup headings.
- Unscheduled tasks at the bottom.
- Drag rescheduling, inline editing, and keyboard traversal.

Reminders always support an in-app due state. Optional browser notifications operate only while the board is open. Background reminders are deferred until an optional server/PWA mode exists.

Focus sessions accumulate actual seconds on the task. Planned-versus-actual variance is derived. Entering Focus never focuses the editable text automatically; a click or explicit edit command starts editing.

## Settings and help

Settings uses progressive disclosure. Disabled capabilities disappear completely from the primary UI. Advanced policy inheritance is nested under one explicit enable switch.

The help content is concise Markdown rendered inside Settings. It defines groups, tasks, aliases, references, Day Plan, Focus, Completed, Trash, export formats, and keyboard/touch behavior. “Reset seed” becomes “Restore example board” and explains that it replaces the current board after confirmation.

## Responsive and touch behavior

Laptop layout uses a collapsible left sidebar and one main outline column. Phone layout uses the same content model with the sidebar as a drawer, no horizontal page scrolling, and minimum 44px interactive targets where practical.

Touch dragging begins only after a long press and visible armed state. Normal swipes continue scrolling. While dragging, proximity to viewport edges auto-scrolls; drop indicators show before, inside, and after targets, including an easy full-width target above the first group.

## Data safety and errors

- Validate imports before replacing state.
- Push undo state before every mutation.
- Keep the previous local snapshot if migration or import fails.
- Explain storage and cross-browser limitations in Settings.
- Never claim Markdown is a lossless backup; direct users to JSON for that purpose.
- Avoid silent permanent deletion unless that policy was explicitly selected.

## Testing

Use the Node standard test runner for pure state, migration, Markdown, lifecycle, linking, scheduling, and keyboard command functions. Keep static assertions for the standalone output contract.

Use Playwright against the file URL for desktop and phone workflows:

- Existing-state migration and reload persistence.
- Light/dark rendering and sidebar behavior.
- Keyboard selection, movement, indentation, splitting, undo.
- Mouse and long-press touch drag/drop, including top insertion and auto-scroll.
- Markdown and JSON clipboard/import/export behavior.
- Alias/reference synchronization and navigation.
- Completion, Trash, restore, and policy timing.
- Focus timer persistence and no initial caret.
- List/Timeline switching, current-time marker, and drag scheduling.
- Console-error check and viewport screenshots.

## Explicitly deferred

- Required server, database, account, or cloud synchronization.
- Reliable notifications while the app is closed.
- Calendar-provider integration.
- Rich-text formatting beyond links and line breaks.
- Automatic product expansion based on research findings.
