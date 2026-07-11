# Static Task Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a minimal, responsive, single-file task organizer with reliable outline editing, portable Markdown/JSON data, configurable lifecycle, aliases/references, daily scheduling, reminders, and planned-versus-actual focus timing.

**Architecture:** Author native HTML/CSS/JavaScript in three focused source files and inline them with a zero-dependency Node build script into `outputs/task-board.html`. Keep JSON as the versioned canonical state, derive outline/timeline/completed/trash views from it, and migrate the existing nested state without data loss.

**Tech Stack:** HTML, CSS, browser JavaScript, Node.js standard library, Node test runner, Playwright CLI/MCP.

---

## File map

- Create `src/task-board.html`: semantic app shell and build insertion markers.
- Create `src/task-board.css`: responsive outline, sidebar, dark mode, touch, lifecycle, and timeline styles.
- Create `src/task-board.js`: seed, schema migration, editor commands, persistence, rendering, lifecycle, linking, scheduling, and timers.
- Create `scripts/build-task-board.mjs`: inline CSS/JS into one standalone output.
- Modify `outputs/task-board.html`: generated distributable; never hand-edit after the split.
- Modify `tests/task-board.static.test.mjs`: pure state and generated-output regression tests.
- Create `tests/task-board.browser.smoke.mjs`: optional local Playwright smoke workflow using an installed Playwright runtime when available.
- Modify `README.md`, `docs/AGENT_HANDOFF.md`, and `docs/ROADMAP.md`: final commands, schema, status, and deferred research.

### Task 1: Establish the zero-dependency source/build contract

**Files:**
- Create: `src/task-board.html`
- Create: `src/task-board.css`
- Create: `src/task-board.js`
- Create: `scripts/build-task-board.mjs`
- Modify: `tests/task-board.static.test.mjs`
- Generate: `outputs/task-board.html`

- [x] **Step 1: Write a failing build-contract test**

Add assertions that the source files and build script exist, the generated file contains no insertion markers, contains exactly one app stylesheet/script, and its inline script parses with `vm.Script`.

```js
test("build emits one standalone task board", async () => {
  const output = await readFile(path.join(root, "outputs/task-board.html"), "utf8");
  assert.equal(output.includes("TASK_BOARD_STYLES"), false);
  assert.equal(output.includes("TASK_BOARD_SCRIPT"), false);
  assert.match(output, /<style data-task-board-styles>/);
  assert.match(output, /<script data-task-board-script>/);
});
```

- [x] **Step 2: Run the focused test and confirm the source contract is missing**

Run: `node --test --test-name-pattern="build emits" tests/task-board.static.test.mjs`

Expected: FAIL because `src/` and the build markers do not exist.

- [x] **Step 3: Split the current file mechanically and add the build script**

The build script must use only `node:fs/promises` and exact markers:

```js
const output = template
  .replace("<!-- TASK_BOARD_STYLES -->", `<style data-task-board-styles>\n${css}\n</style>`)
  .replace("<!-- TASK_BOARD_SCRIPT -->", `<script data-task-board-script>\n${js}\n</script>`);
await writeFile(outputPath, output, "utf8");
```

- [x] **Step 4: Build and run the complete baseline suite**

Run: `node scripts/build-task-board.mjs`

Expected: `Built outputs/task-board.html`.

Run: `node --test tests/task-board.static.test.mjs`

Expected: all baseline and build-contract tests pass.

- [x] **Step 5: Commit the source split**

```powershell
git add src scripts/build-task-board.mjs outputs/task-board.html tests/task-board.static.test.mjs
git commit -m "build: generate standalone task board"
```

### Task 2: Version and migrate the canonical state safely

**Files:**
- Modify: `src/task-board.js`
- Modify: `tests/task-board.static.test.mjs`

- [x] **Step 1: Write failing tests for schema defaults and legacy migration**

Cover immutable task creation metadata, settings defaults, old task preservation, and the research task insertion:

```js
test("legacy state migrates without losing hierarchy or focus time", () => {
  const migrated = api.migrateState(legacyState);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.groups[0].tasks[0].text, "Existing task");
  assert.equal(migrated.groups[0].tasks[0].focusSeconds, 125);
  assert.ok(migrated.groups[0].tasks[0].createdAt);
});
```

- [x] **Step 2: Run migration tests and confirm missing APIs/defaults fail**

Run: `node --test --test-name-pattern="migrat|schema" tests/task-board.static.test.mjs`

Expected: FAIL because schema version 2 and migration helpers are absent.

- [x] **Step 3: Implement migration and validation**

Add one migration entry point that normalizes version 1 and malformed optional fields. Preserve task IDs when valid; generate missing immutable IDs and creation metadata. Add settings with conservative defaults:

```js
const DEFAULT_SETTINGS = Object.freeze({
  dailyPlanning: false,
  timelineView: false,
  reminders: false,
  browserNotifications: false,
  focusTiming: true,
  metadata: false,
  policyOverrides: false,
  pasteMode: "alias",
  completionRetentionSeconds: 604800,
  deleteMode: "trash",
  trashRetentionSeconds: null,
  exportCompleted: true,
  exportTrash: false,
  sidebarCollapsed: false
});
```

- [x] **Step 4: Verify migration, persistence, and all existing tests**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs`

Expected: PASS with no lost seed or legacy fields.

- [x] **Step 5: Commit the schema**

```powershell
git add src/task-board.js outputs/task-board.html tests/task-board.static.test.mjs
git commit -m "feat: add versioned task metadata"
```

### Task 3: Make the outline editor and drag model deterministic

**Files:**
- Modify: `src/task-board.js`
- Modify: `src/task-board.css`
- Modify: `tests/task-board.static.test.mjs`

- [x] **Step 1: Add one failing regression test per reported editor bug**

Test caret-zero insertion, middle splitting, Shift+Tab focus preservation, selected-link paste, focus entry without automatic text focus, top group drop, and long-press arming.

```js
test("enter at caret zero inserts before the selected task", () => {
  const result = api.splitTaskAtOffset("task-a", 0);
  assert.equal(result.position, "before");
});
```

- [x] **Step 2: Run the focused regressions and confirm each fails for its missing behavior**

Run: `node --test --test-name-pattern="caret|Shift.Tab|link paste|focus entry|top group|long.press" tests/task-board.static.test.mjs`

Expected: FAIL for the new expectations, not test setup errors.

- [x] **Step 3: Route keyboard actions through one command handler**

Handle task splitting from caret offsets, use `preventDefault()` before indent/outdent, preserve the selected placement after render, render Markdown links as anchors, and never focus Focus-mode text on entry.

- [x] **Step 4: Fix mouse and touch dragging at the shared drop-instruction layer**

Add a full-width before-first-group drop zone, visible insertion line, edge auto-scroll, and pointer long-press arming. Cancel touch drag when movement indicates normal scrolling before the hold threshold.

- [x] **Step 5: Build, run all tests, and commit**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs`

Expected: all tests pass.

```powershell
git add src outputs/task-board.html tests/task-board.static.test.mjs
git commit -m "fix: stabilize outline editing and dragging"
```

### Task 4: Add Markdown interchange, aliases, and references

**Files:**
- Modify: `src/task-board.js`
- Modify: `src/task-board.html`
- Modify: `src/task-board.css`
- Modify: `tests/task-board.static.test.mjs`

- [x] **Step 1: Write failing pure tests for Markdown trees and linked placements**

```js
test("selected nested tasks serialize as portable markdown", () => {
  assert.equal(api.tasksToMarkdown(selection), "- Parent\n  - Child\n    - Grandchild");
});

test("editing an alias updates the original entity", () => {
  api.pastePlacements(["task-a"], target, "alias");
  api.updateTaskText("task-a", "Shared text");
  assert.equal(api.resolvePlacement(aliasId).text, "Shared text");
});
```

- [x] **Step 2: Verify focused failures**

Run: `node --test --test-name-pattern="markdown|alias|reference|clipboard" tests/task-board.static.test.mjs`

Expected: FAIL because parsing/serialization and placement modes are missing.

- [x] **Step 3: Implement clean Markdown and internal clipboard identity**

Serialize checkbox state and indentation without hidden IDs. Parse external indented bullets into new tasks. Keep an internal clipboard record containing task IDs and cut/copy mode; use Settings to select alias/reference/duplicate/ask behavior.

- [x] **Step 4: Render linked placements and reject cycles**

Aliases render shared task content; references render compact links. Both expose origin through accessible labels/tooltips. Reject any paste that would place an ancestor beneath its descendant and show a small non-modal status message.

- [x] **Step 5: Verify and commit**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs`

Expected: all tests pass.

```powershell
git add src outputs/task-board.html tests/task-board.static.test.mjs
git commit -m "feat: add markdown clipboard and task links"
```

### Task 5: Add configurable Completed and Trash views

**Files:**
- Modify: `src/task-board.js`
- Modify: `src/task-board.html`
- Modify: `src/task-board.css`
- Modify: `tests/task-board.static.test.mjs`

- [x] **Step 1: Write failing lifecycle and policy-inheritance tests**

Cover custom seconds, immediate hiding, indefinite visibility, soft delete, permanent delete, timed trash purge, completed-and-deleted identity, restore location, export inclusion, and precedence `task > group > global`.

- [x] **Step 2: Verify the lifecycle tests fail**

Run: `node --test --test-name-pattern="completed|trash|retention|policy|restore" tests/task-board.static.test.mjs`

Expected: FAIL because timestamps and derived views are absent.

- [x] **Step 3: Implement timestamp-driven derived views**

Use `completedAt` and `deletedAt`; do not destructively move completion records. Put deleted subtrees in restorable trash snapshots unless permanent deletion is selected. Evaluate retention at load and on a lightweight interval only when a finite seconds-based policy exists.

- [x] **Step 4: Add global settings and hidden optional overrides**

Expose duration value/unit controls and export inclusion. Add group/task override controls only when Advanced policy overrides are enabled.

- [x] **Step 5: Verify and commit**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs`

Expected: all tests pass.

```powershell
git add src outputs/task-board.html tests/task-board.static.test.mjs
git commit -m "feat: add completed and trash lifecycle"
```

### Task 6: Add scheduling, reminders, and effort comparison

**Files:**
- Modify: `src/task-board.js`
- Modify: `src/task-board.html`
- Modify: `src/task-board.css`
- Modify: `tests/task-board.static.test.mjs`

- [x] **Step 1: Write failing tests for scheduling and effort calculations**

Cover date-only scheduling, time blocks, unscheduled tasks, duration fallback, focus accumulation, variance formatting, reminder due state, and feature-flag invisibility.

```js
test("effort variance compares actual focus with planned minutes", () => {
  assert.deepEqual(api.getEffortVariance({ plannedMinutes: 30, focusSeconds: 2400 }), {
    seconds: 600,
    label: "+10m"
  });
});
```

- [x] **Step 2: Verify focused failures**

Run: `node --test --test-name-pattern="schedule|timeline|effort|reminder" tests/task-board.static.test.mjs`

Expected: FAIL because schedule helpers and controls are absent.

- [x] **Step 3: Add optional task details and reminders**

Use native date/time/number controls in a compact task details panel. Keep every scheduling/reminder surface absent while its feature flag is disabled. Browser notifications require explicit permission and only fire while the page is open.

- [x] **Step 4: Add List/Timeline projection for the Day Plan group**

Render configurable day hours, current-time line, nested headings, duration-sized blocks, compact unknown-duration blocks, and unscheduled items at the bottom. Reuse task editor commands and shared selection state. Dragging a block updates date/time; keyboard navigation follows visual order.

- [x] **Step 5: Verify and commit**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs`

Expected: all tests pass.

```powershell
git add src outputs/task-board.html tests/task-board.static.test.mjs
git commit -m "feat: add daily planning and effort tracking"
```

### Task 7: Finish the minimal responsive shell and help

**Files:**
- Modify: `src/task-board.html`
- Modify: `src/task-board.css`
- Modify: `src/task-board.js`
- Modify: `tests/task-board.static.test.mjs`
- Modify: `README.md`

- [x] **Step 1: Write failing output-contract assertions**

Assert collapsible sidebar controls, Views navigation, help content, favicon, Restore example board wording, no total/done counters, dark theme group tokens, and phone/touch CSS.

- [x] **Step 2: Verify focused failures**

Run: `node --test --test-name-pattern="sidebar|help|favicon|Restore example|dark|phone" tests/task-board.static.test.mjs`

Expected: FAIL for the new shell contract.

- [x] **Step 3: Implement the restrained responsive UI**

Use one outline column, a collapsible desktop sidebar, phone drawer, 44px phone controls, theme-aware group tints, no decorative card grid, and no total/done counters. Add a data-URI task-board favicon and concise Markdown-derived help.

- [x] **Step 4: Clarify destructive and storage behavior**

Rename Reset seed to Restore example board; explain replacement and request confirmation. Explain local browser isolation, JSON backup, clean Markdown, notification limits, linking, and touch drag in Settings.

- [x] **Step 5: Verify and commit**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs`

Expected: all tests pass.

```powershell
git add src outputs/task-board.html tests/task-board.static.test.mjs README.md
git commit -m "feat: polish responsive task board shell"
```

### Task 8: Run real-browser acceptance and close documentation

**Files:**
- Create: `tests/task-board.browser.smoke.mjs`
- Modify: `docs/AGENT_HANDOFF.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Check Playwright prerequisites**

Run: `Get-Command npx`

Expected: an `npx` command path. If the CLI wrapper cannot run, use the already-active Playwright MCP and record that the reusable smoke script was not executed.

- [ ] **Step 2: Exercise desktop and phone acceptance flows**

Open the absolute file URL, then verify outline editing, sidebar collapse/drawer, light/dark screenshots, focus entry, keyboard selection, top dragging, long-press touch drag, Markdown paste, alias synchronization, lifecycle restore, feature toggles, and Timeline drag scheduling.

- [ ] **Step 3: Inspect runtime quality**

Capture desktop and phone screenshots, assert no horizontal overflow or overlapping controls, inspect browser console errors, and verify the board remains nonblank after reload.

- [ ] **Step 4: Run the final verification ladder**

Run: `node scripts/build-task-board.mjs`

Run: `node --test tests/task-board.static.test.mjs tests/task-board.browser.smoke.mjs`

Run: `git diff --check`

Expected: build exit 0, all runnable tests pass, and no diff-check errors.

- [ ] **Step 5: Update handoff and roadmap status, then commit**

Document the exact test count, browser viewports, any platform-limited behavior, and deferred JSON sync/research work.

```powershell
git add tests docs README.md src scripts outputs/task-board.html
git commit -m "test: verify static task board workflows"
```
