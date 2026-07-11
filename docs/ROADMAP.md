# Product Roadmap

Priority is based on data safety, frequency of use, and dependency order.

## P0 - Trust and editing

- Preserve and migrate all existing local data into the expanded schema.
- Make dark-mode group surfaces and custom group colors theme-aware.
- Fix focus entry so no caret appears until task text is clicked.
- Make `Shift+Tab` deterministic while editing.
- Insert a new task before the current task when Enter is pressed at text start; split at a middle caret.
- Make raw URLs clickable and allow pasted URLs to wrap selected text as Markdown links.
- Improve group top-edge drop targeting and drag auto-scroll.
- Add long-press touch dragging without blocking normal page scrolling.
- Keep undo reliable for delete, move, link, completion, and paste operations.

## P1 - Portable organization

- Add stable IDs and immutable creation metadata.
- Add nested Markdown copy, paste, import, and export.
- Add alias/reference placements with visible link indicators and configurable paste behavior.
- Add Completed and Trash views with restore and configurable retention/purge policies.
- Add export inclusion settings for completed and deleted records.
- Add the task-management-app research task to the board.

## P2 - Daily planning

- Treat Day Plan as a regular group in default outline mode.
- Add dates, optional times, planned active effort, reminders, and actual focus totals.
- Add optional timeline with current-time marker, nested headings, duration blocks, unscheduled area, drag scheduling, and keyboard navigation.
- Show planned-versus-actual effort variance.
- Add in-app reminders and optional browser notifications while the board is open.

## P3 - Minimal responsive polish

- Replace the current sidebar browser with a useful views/groups overview.
- Make the sidebar collapsible on laptop and a dismissible drawer on phone.
- Remove total/done counters from the primary interface.
- Rename and explain “Reset seed” as “Restore example board,” with explicit data-loss warning.
- Add a task-board favicon and a consistent task icon.
- Add a clear Markdown-based help card in Settings.
- Verify every control, label, nested row, timeline block, and focus view at narrow phone widths.

## Research backlog

### Task-management workflow research

Compare Obsidian, ClickUp, Todoist, Things, Notion, and similar tools. Review official workflows plus recurring complaints and praise in public communities such as Reddit. Record:

- Capture and organization friction.
- Scheduling and rescheduling pain points.
- Recurring-task and reminder problems.
- Mobile editing and drag/drop failures.
- Over-configuration and visual clutter complaints.
- Data portability, lock-in, backup, and sync concerns.
- Features users repeatedly describe as indispensable.

The output should be a short evidence-backed Markdown report. It should inform later releases, not expand the current static scope automatically.
