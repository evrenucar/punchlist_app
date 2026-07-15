# Product Roadmap

Priority is based on data safety, frequency of use, and dependency order.

**Status (2026-07-11, end of first build day):** P0 through P3 shipped, plus six live-feedback iteration rounds (Punchlist branding, side-docked timeline, history panel with restore, task images with captions and lightbox, focus-mode editing parity, keyboard-zone navigation, settings export). 67 static tests pass; the optional Playwright smoke test skips when no runtime is installed. Browser acceptance ran through the Chrome DevTools MCP at 1440x900 and 390x844 in both themes. Remaining open work: the research backlog below, PWA/server-capable reminders, calendar integration, and the rough edges listed at the end of `docs/AGENT_HANDOFF.md`.

**Update (2026-07-15, v1.2.0):** GitHub sync v1 shipped — the first slice of the deferred vision below, deliberately scoped to Evren's own GitHub per the grill session (strangers get a gentler flow only if a later decision asks for one). The landing page gained Open-the-board + Download CTAs, the demo embed auto-sizes instead of cropping, and iOS Safari users get a one-time Add-to-Home-Screen nudge because Safari deletes site storage after 7 days unused. 77 static tests pass.

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

## Deferred vision - URL-hosted board with offline sync (noted 2026-07-15; first slice shipped same day)

Captured from Evren during a product grill session, initially deferred in full. Later that day he gave the go-ahead for a v1: GitHub sync via a private repo and a fine-grained token, built for his own use (see AGENT_HANDOFF "GitHub sync"). That covers "reachable over a URL", "offline-first", and "PC and phone connect to the same board" for one GitHub user. Everything below beyond that — strangers without accounts, sharing/linking sections, encryption, hashed identities — stays deferred; do not build it without a fresh go-ahead.

Context that produced it: success metric is "Punchlist is my daily driver"; the #1 daily-driver gap is phone capture; the 2026-07-15 research report names omnipresent low-friction capture as the space's most indispensable feature and warns against one-off "snowflake" sync infrastructure.

The vision, as stated:

- The board is reachable over a URL (e.g. GitHub Pages) yet stays a static app.
- Offline-first: fully usable and editable offline; edits are kept locally.
- When a device comes back online, conflicts ("interference") between devices get resolved somehow.
- PC, phone, and other devices all connect to the same board.
- People can easily host their own boards on GitHub; GitHub Actions does the machinery.
- Data stays private despite being hosted.
- Users can share data or sections with each other, and link/unlink them.
- Identity without accounts - or with just GitHub accounts, or hashed special usernames.

Open tensions to resolve before any of this is real: private data on a public host (encryption? private repos?), conflict-resolution model (CRDT? last-writer-wins? manual merge?), and whether GitHub-as-backend violates the no-server rule or satisfies it.

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
