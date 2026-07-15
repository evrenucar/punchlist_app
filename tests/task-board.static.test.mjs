import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const boardPath = path.join(root, "outputs", "task-board.html");

async function readBoard() {
  return readFile(boardPath, "utf8");
}

async function loadBoardApi() {
  const html = await readBoard();
  const script = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "expected inline board script");

  const elements = new Map();
  const makeElement = (extra = {}) => ({
    innerHTML: "",
    textContent: "",
    value: "",
    dataset: {},
    classList: {
      add() {},
      remove() {},
    },
    addEventListener() {},
    contains() {
      return false;
    },
    focus() {},
    scrollIntoView() {},
    ...extra,
  });

  const boardEl = makeElement();
  const navEl = makeElement();
  const totalCountEl = makeElement();
  const doneCountEl = makeElement();
  const searchEl = makeElement({ value: "" });
  elements.set("[data-board]", boardEl);
  elements.set("[data-section-nav]", navEl);
  elements.set("[data-total-count]", totalCountEl);
  elements.set("[data-done-count]", doneCountEl);
  elements.set("[data-search]", searchEl);

  const store = new Map();
  const context = {
    console,
    Event,
    localStorage: {
      getItem(key) {
        return store.get(key) || null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
    document: {
      activeElement: null,
      querySelector(selector) {
        return elements.get(selector) || null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
      createRange() {
        return {
          collapse() {},
          deleteContents() {},
          insertNode() {},
          selectNodeContents() {},
          setStartAfter() {},
        };
      },
    },
    window: {
      getSelection() {
        return {
          rangeCount: 0,
          addRange() {},
          getRangeAt() {
            return null;
          },
          removeAllRanges() {},
        };
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(script, context);
  return context.window.taskBoardTestApi;
}

test("build emits one standalone task board", async () => {
  const [template, css, script, build, output] = await Promise.all([
    readFile(path.join(root, "src", "task-board.html"), "utf8"),
    readFile(path.join(root, "src", "task-board.css"), "utf8"),
    readFile(path.join(root, "src", "task-board.js"), "utf8"),
    readFile(path.join(root, "scripts", "build-task-board.mjs"), "utf8"),
    readBoard(),
  ]);

  assert.match(template, /TASK_BOARD_STYLES/);
  assert.match(template, /TASK_BOARD_SCRIPT/);
  assert.ok(css.length > 1000);
  assert.ok(script.length > 1000);
  assert.match(build, /writeFile/);
  assert.equal(output.includes("TASK_BOARD_STYLES"), false);
  assert.equal(output.includes("TASK_BOARD_SCRIPT"), false);
  assert.match(output, /<style data-task-board-styles>/);
  assert.match(output, /<script data-task-board-script>/);
});

test("legacy state migrates to version two without losing task data", async () => {
  const api = await loadBoardApi();
  const legacy = {
    groups: [{
      id: "group-legacy",
      title: "Legacy",
      collapsed: false,
      tasks: [{
        id: "task-legacy",
        text: "Existing task",
        done: true,
        collapsed: false,
        focusSeconds: 125,
        children: [{ id: "task-child", text: "Child", done: false, children: [] }],
      }],
    }],
  };

  const migrated = api.migrateState(legacy, "2026-07-11T12:00:00.000Z");
  const existing = migrated.groups[0].tasks[0];
  const child = existing.children[0];

  assert.equal(migrated.version, 2);
  assert.equal(migrated.settings.dailyPlanning, false);
  assert.equal(migrated.settings.focusTiming, true);
  assert.equal(migrated.settings.pasteMode, "alias");
  assert.equal(migrated.trash.length, 0);
  assert.equal(existing.id, "task-legacy");
  assert.equal(existing.text, "Existing task");
  assert.equal(existing.focusSeconds, 125);
  assert.equal(existing.createdAt, "2026-07-11T12:00:00.000Z");
  assert.equal(existing.createdInGroupId, "group-legacy");
  assert.equal(existing.completedAt, "2026-07-11T12:00:00.000Z");
  assert.equal(child.createdUnderTaskId, "task-legacy");
  assert.equal(
    migrated.groups.some((group) => group.tasks.some((item) => item.text.includes("Research task management apps"))),
    true,
  );
});

test("new tasks retain immutable creation context", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  const parent = group.tasks[0];
  const child = api.addTask(group.id, parent.id);

  assert.ok(child.id);
  assert.equal(child.createdInGroupId, group.id);
  assert.equal(child.createdUnderTaskId, parent.id);
  assert.ok(child.createdAt);
});

test("caret-aware enter inserts before or splits task text", async () => {
  const api = await loadBoardApi();

  assert.equal(JSON.stringify(api.getTaskSplitPlan("Alpha", 0)), JSON.stringify({
    beforeText: "",
    afterText: "Alpha",
    position: "before",
  }));
  assert.equal(JSON.stringify(api.getTaskSplitPlan("Alpha", 2)), JSON.stringify({
    beforeText: "Al",
    afterText: "pha",
    position: "after",
  }));
  assert.equal(JSON.stringify(api.getTaskSplitPlan("Alpha", 5)), JSON.stringify({
    beforeText: "Alpha",
    afterText: "",
    position: "after",
  }));
});

test("task text renders clickable URLs and selected URL paste creates markdown links", async () => {
  const api = await loadBoardApi();
  const url = "https://example.com/docs";

  assert.equal(api.applyUrlPasteToText("Read docs", 0, 4, url), `[Read](${url}) docs`);
  assert.match(api.renderInlineMarkdown(`Read [the docs](${url})`), /<a[^>]+href="https:\/\/example\.com\/docs"[^>]*>the docs<\/a>/);
  assert.match(api.renderInlineMarkdown(`Open ${url}`), /data-auto-link="true"/);
});

test("touch drag requires a long press and the board exposes an easy top drop target", async () => {
  const api = await loadBoardApi();
  const html = await readBoard();

  assert.equal(api.shouldCancelLongPress(10, 10, 14, 16), false);
  assert.equal(api.shouldCancelLongPress(10, 10, 30, 10), true);
  assert.match(html, /data-board-top-drop/);
  assert.match(html, /pointerdown/);
});

test("focus mode waits for an explicit click before editing", async () => {
  const html = await readBoard();

  assert.match(html, /data-focus-task-text/);
  assert.doesNotMatch(html, /querySelector\("\[data-focus-task-text\]"\)\?\.focus\(\)/);
});

test("nested task selections serialize to and parse from clean markdown", async () => {
  const api = await loadBoardApi();
  const tree = [{
    id: "parent",
    text: "Parent",
    done: false,
    children: [{
      id: "child",
      text: "Child",
      done: true,
      children: [{ id: "grandchild", text: "Grandchild", done: false, children: [] }],
    }],
  }];

  const markdown = api.tasksToMarkdown(tree);
  assert.equal(markdown, "- Parent\n  - Child\n    - Grandchild");
  const parsed = api.parseMarkdownTasks(markdown, "group-import");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text, "Parent");
  assert.equal(parsed[0].children[0].text, "Child");
  assert.equal(parsed[0].children[0].children[0].text, "Grandchild");
});

test("aliases share task content while references retain a compact linked placement", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  const original = group.tasks[0];
  const alias = api.createLinkedTaskTree(original, "alias", "group-today");
  const reference = api.createLinkedTaskTree(original, "reference", "group-today");
  const today = api.state.groups.find((item) => item.id === "group-today");
  today.tasks.push(alias, reference);

  assert.equal(alias.linkType, "alias");
  assert.equal(reference.linkType, "reference");
  assert.equal(alias.targetTaskId, original.id);
  assert.equal(api.resolveTaskItem(alias).id, original.id);
  assert.equal(api.updateTaskTextFromEditable(alias.id, "Shared edit"), true);
  assert.equal(original.text, "Shared edit");
  assert.equal(api.resolveTaskItem(reference).text, "Shared edit");
  assert.equal(api.getLinkCount(original.id), 2);
});

test("internal paste mode creates aliases by default and cut paste moves originals", async () => {
  const api = await loadBoardApi();
  const kora = api.state.groups.find((item) => item.id === "group-projects");
  const today = api.state.groups.find((item) => item.id === "group-today");
  const original = kora.tasks[0];

  const linked = api.pasteTaskIds([original.id], { kind: "group", id: today.id }, "alias");
  assert.equal(linked.length, 1);
  assert.equal(linked[0].targetTaskId, original.id);
  assert.equal(kora.tasks.some((item) => item.id === original.id), true);

  const moved = api.pasteTaskIds([original.id], { kind: "group", id: today.id }, "move");
  assert.equal(moved.length, 1);
  assert.equal(kora.tasks.some((item) => item.id === original.id), false);
  assert.equal(today.tasks.some((item) => item.id === original.id), true);
});

test("linked paste rejects placing a task beneath its own descendant", async () => {
  const api = await loadBoardApi();
  const kora = api.state.groups.find((item) => item.id === "group-projects");
  const parent = kora.tasks.find((item) => item.children.length > 0);
  const child = parent.children[0];

  const result = api.pasteTaskIds([parent.id], { kind: "task", id: child.id }, "alias");
  assert.equal(result.length, 0);
  assert.equal(api.getLinkCount(parent.id), 0);
});

test("completion retention supports seconds and restores tasks", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  const item = group.tasks[0];
  api.state.settings.completionRetentionSeconds = 10;

  assert.equal(api.setTaskCompleted(item.id, true, "2026-07-11T12:00:00.000Z"), true);
  assert.equal(api.isTaskHiddenFromActive(item, group, Date.parse("2026-07-11T12:00:09.000Z")), false);
  assert.equal(api.isTaskHiddenFromActive(item, group, Date.parse("2026-07-11T12:00:10.000Z")), true);
  assert.equal(api.restoreCompletedTask(item.id), true);
  assert.equal(item.done, false);
  assert.equal(item.completedAt, null);
});

test("task and group lifecycle overrides take precedence over global settings", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  const item = group.tasks[0];
  api.state.settings.completionRetentionSeconds = 50;
  group.policyOverrides = { completionRetentionSeconds: 5 };
  item.policyOverrides = { completionRetentionSeconds: 1 };

  assert.equal(api.resolveLifecyclePolicy(item, group, "completionRetentionSeconds"), 1);
  item.policyOverrides = null;
  assert.equal(api.resolveLifecyclePolicy(item, group, "completionRetentionSeconds"), 5);
  group.policyOverrides = null;
  assert.equal(api.resolveLifecyclePolicy(item, group, "completionRetentionSeconds"), 50);
});

test("delete moves tasks to restorable trash or permanently removes them by policy", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  const first = group.tasks[0];
  const firstIndex = group.tasks.indexOf(first);
  api.state.settings.deleteMode = "trash";
  api.state.settings.trashRetentionSeconds = 300;

  const record = api.deleteTaskWithPolicy(first.id, "2026-07-11T12:00:00.000Z");
  assert.ok(record.id);
  assert.equal(record.kind, "task");
  assert.equal(record.source.groupId, group.id);
  assert.equal(api.state.trash.length, 1);
  assert.equal(group.tasks.some((item) => item.id === first.id), false);
  assert.equal(api.restoreTrashRecord(record.id), true);
  assert.equal(group.tasks[firstIndex].id, first.id);

  api.state.settings.deleteMode = "permanent";
  const second = group.tasks[1];
  assert.equal(api.deleteTaskWithPolicy(second.id, "2026-07-11T12:01:00.000Z"), null);
  assert.equal(api.state.trash.length, 0);
  assert.equal(group.tasks.some((item) => item.id === second.id), false);
});

test("trash retention purges expired records and export inclusion is configurable", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  api.state.settings.deleteMode = "trash";
  api.state.settings.trashRetentionSeconds = 5;
  api.deleteTaskWithPolicy(group.tasks[0].id, "2026-07-11T12:00:00.000Z");

  api.state.settings.exportTrash = false;
  assert.equal(JSON.parse(api.serializeBoardState()).state.trash.length, 0);
  api.state.settings.exportTrash = true;
  assert.equal(JSON.parse(api.serializeBoardState()).state.trash.length, 1);
  assert.equal(api.purgeExpiredTrash(Date.parse("2026-07-11T12:00:04.000Z")), 0);
  assert.equal(api.purgeExpiredTrash(Date.parse("2026-07-11T12:00:05.000Z")), 1);
  assert.equal(api.state.trash.length, 0);
});

test("completed and trash sections expose restore and purge controls", async () => {
  const html = await readBoard();
  for (const hook of [
    "data-completed-section",
    "data-trash-section",
    "restore-completed",
    "restore-trash",
    "purge-trash",
    "getCompletedEntries",
  ]) {
    assert.match(html, new RegExp(hook));
  }
});

test("settings configure lifecycle, export, paste, and optional policy overrides", async () => {
  const html = await readBoard();
  const api = await loadBoardApi();
  for (const hook of [
    "data-completion-mode",
    "data-completion-value",
    "data-delete-mode",
    "data-trash-mode",
    "data-export-completed",
    "data-export-trash",
    "data-paste-mode",
    "data-policy-overrides",
  ]) {
    assert.match(html, new RegExp(hook));
  }
  assert.equal(api.durationToSeconds(5, "minutes"), 300);
  assert.equal(JSON.stringify(api.secondsToDurationParts(300)), JSON.stringify({ value: 5, unit: "minutes" }));
  assert.equal(api.durationToSeconds(1, "days"), 86400);
});

test("tasks accept an optional schedule date, start time, planned minutes, and reminder", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const item = group.tasks[0];

  assert.equal(api.setTaskSchedule(item.id, { date: "2026-07-11" }), true);
  assert.equal(item.schedule.date, "2026-07-11");
  assert.equal(item.schedule.startTime, null);
  assert.equal(api.setTaskSchedule(item.id, { startTime: "09:30", plannedMinutes: 45 }), true);
  assert.equal(item.schedule.date, "2026-07-11");
  assert.equal(item.schedule.startTime, "09:30");
  assert.equal(item.plannedMinutes, 45);
  assert.equal(api.setTaskSchedule(item.id, { date: "not-a-date" }), false);
  assert.equal(item.schedule.date, "2026-07-11");
  assert.equal(api.setTaskSchedule(item.id, { reminderAt: "2026-07-11T09:00" }), true);
  assert.equal(item.reminderAt, "2026-07-11T09:00");
  assert.equal(api.setTaskSchedule(item.id, { date: null, startTime: null }), true);
  assert.equal(item.schedule, null);
  assert.equal(item.plannedMinutes, 45);
});

test("timeline projects scheduled blocks in time order and keeps unscheduled day tasks at the bottom", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const [first, second, third] = group.tasks;
  api.setTaskSchedule(first.id, { date: "2026-07-11", startTime: "09:30", plannedMinutes: 45 });
  api.setTaskSchedule(second.id, { date: "2026-07-11", startTime: "08:00" });
  api.setTaskSchedule(third.id, { date: "2026-07-11" });

  const entries = api.getTimelineEntries("2026-07-11");
  assert.equal(entries.scheduled.length, 2);
  assert.equal(entries.scheduled[0].item.id, second.id);
  assert.equal(entries.scheduled[0].startMinutes, 480);
  assert.equal(entries.scheduled[0].durationMinutes, null);
  assert.equal(entries.scheduled[1].item.id, first.id);
  assert.equal(entries.scheduled[1].startMinutes, 570);
  assert.equal(entries.scheduled[1].durationMinutes, 45);
  assert.equal(entries.unscheduled.length, 1);
  assert.equal(entries.unscheduled[0].item.id, third.id);
  assert.equal(api.getTimelineEntries("2026-07-12").scheduled.length, 0);
});

test("timeline drag offsets convert to snapped clock times inside the visible day", async () => {
  const api = await loadBoardApi();
  assert.equal(api.timelineTimeFromOffset(0), "06:00");
  assert.equal(api.timelineTimeFromOffset(210), "09:30");
  assert.equal(api.timelineTimeFromOffset(217), "09:30");
  assert.equal(api.timelineTimeFromOffset(224), "09:45");
  assert.equal(api.timelineTimeFromOffset(-30), "06:00");
  assert.equal(api.timelineTimeFromOffset(100000), "23:45");
});

test("effort variance compares actual focus with planned minutes", async () => {
  const api = await loadBoardApi();
  assert.equal(
    JSON.stringify(api.getEffortVariance({ plannedMinutes: 30, focusSeconds: 2400 })),
    JSON.stringify({ seconds: 600, label: "+10m" }),
  );
  assert.equal(
    JSON.stringify(api.getEffortVariance({ plannedMinutes: 30, focusSeconds: 1500 })),
    JSON.stringify({ seconds: -300, label: "-5m" }),
  );
  assert.equal(
    JSON.stringify(api.getEffortVariance({ plannedMinutes: 30, focusSeconds: 1800 })),
    JSON.stringify({ seconds: 0, label: "0m" }),
  );
  assert.equal(api.getEffortVariance({ plannedMinutes: null, focusSeconds: 2400 }), null);
});

test("reminders become due while the page is open and completion clears them", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const item = group.tasks[0];
  api.setTaskSchedule(item.id, { reminderAt: "2026-07-11T09:00" });

  assert.equal(api.isReminderDue(item, Date.parse("2026-07-11T08:59")), false);
  assert.equal(api.isReminderDue(item, Date.parse("2026-07-11T09:00")), true);
  api.state.settings.reminders = true;
  const due = api.getDueReminders(Date.parse("2026-07-11T09:05"));
  assert.equal(due.length, 1);
  assert.equal(due[0].item.id, item.id);
  assert.equal(api.getDueReminders(Date.parse("2026-07-11T09:06")).length, 0);
  api.setTaskCompleted(item.id, true);
  assert.equal(api.isReminderDue(item, Date.parse("2026-07-11T09:00")), false);
});

test("scheduling surfaces stay hidden until their feature flags are enabled", async () => {
  const api = await loadBoardApi();
  const html = await readBoard();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const item = group.tasks[0];

  for (const hook of [
    "data-feature-metadata",
    "data-feature-timeline",
    "data-feature-reminders",
    "data-feature-notifications",
    "data-view-list",
    "data-view-timeline",
    "data-timeline-date",
  ]) {
    assert.match(html, new RegExp(hook));
  }

  assert.equal(api.state.settings.metadata, false);
  assert.equal(api.renderTaskDetailsPanel(item.id), "");
  assert.equal(api.renderTimelineSection("2026-07-11"), "");

  api.state.settings.metadata = true;
  const details = api.renderTaskDetailsPanel(item.id);
  for (const hook of ["data-task-date", "data-task-start", "data-task-planned"]) {
    assert.match(details, new RegExp(hook));
  }
  assert.equal(details.includes("data-task-reminder"), false);
  api.state.settings.reminders = true;
  assert.match(api.renderTaskDetailsPanel(item.id), /data-task-reminder/);

  api.state.settings.timelineView = true;
  api.setTaskSchedule(item.id, { date: "2026-07-11", startTime: "09:30", plannedMinutes: 45 });
  const timeline = api.renderTimelineSection("2026-07-11");
  assert.match(timeline, /data-timeline\b/);
  assert.match(timeline, /data-timeline-block/);
  assert.match(timeline, /timeline-unscheduled/);
});

test("enter on a group creates a task at the top of that group instead of a new group", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const groupCount = api.state.groups.length;
  group.collapsed = true;

  const inserted = api.insertSiblingBelowNode({ kind: "group", id: group.id });
  assert.ok(inserted);
  assert.equal(inserted.text, "New task");
  assert.equal(group.tasks[0].id, inserted.id);
  assert.equal(group.collapsed, false);
  assert.equal(api.state.groups.length, groupCount);
});

test("copying selected groups includes their full contents even when collapsed", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-priorities");
  group.collapsed = true;

  api.selectNode("group", group.id);
  const clipboard = api.rememberInternalClipboard("copy");
  assert.ok(clipboard);
  assert.match(clipboard.markdown, /## Priorities/);
  assert.match(clipboard.markdown, /- Finish the slides for the Monday review/);
  assert.match(clipboard.markdown, /- Send the signed lease back/);

  const mixed = api.selectedNodesToMarkdown([
    { kind: "group", id: group.id },
    { kind: "task", id: group.tasks[0].id },
  ]);
  assert.equal(mixed.match(/Finish the slides for the Monday review/g).length, 1);
});

test("relative date labels describe today, tomorrow, and day offsets", async () => {
  const api = await loadBoardApi();
  const now = new Date(2026, 6, 11, 15, 0, 0);
  assert.equal(api.describeRelativeDate("2026-07-11", now), "today");
  assert.equal(api.describeRelativeDate("2026-07-12", now), "tomorrow");
  assert.equal(api.describeRelativeDate("2026-07-10", now), "yesterday");
  assert.equal(api.describeRelativeDate("2026-07-16", now), "in 5 days");
  assert.equal(api.describeRelativeDate("2026-07-08", now), "3 days ago");
  assert.equal(api.describeRelativeDate("nonsense", now), "");
  assert.equal(api.describeRelativeDateTime("2026-07-12T09:30", now), "tomorrow at 09:30");
});

test("details panel shows identity and location for tasks and groups", async () => {
  const api = await loadBoardApi();
  const html = await readBoard();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const item = group.tasks[0];
  api.state.settings.metadata = true;

  const details = api.renderTaskDetailsPanel(item.id);
  assert.match(details, /details-crumb/);
  assert.match(details, new RegExp(item.id));
  assert.match(details, /data-date-hint/);
  assert.match(details, /Today/);

  const groupDetails = api.renderGroupDetailsPanel(group.id);
  assert.match(groupDetails, /data-group-details/);
  assert.match(groupDetails, new RegExp(group.id));
  assert.match(groupDetails, /task/);

  api.selectNode("group", group.id);
  assert.match(api.renderDetailsPanel(), /data-group-details/);

  assert.match(html, /data-focus-clock/);
});

test("deleting a group requires confirmation before it reaches the trash", async () => {
  const api = await loadBoardApi();
  api.selectNode("group", "group-projects");
  api.deleteSelectedNodes();
  assert.equal(api.state.groups.some((group) => group.id === "group-projects"), true);
  assert.ok(api.pendingGroupDelete);
  assert.equal(api.pendingGroupDelete.groupId, "group-projects");
  api.deleteSelectedNodesConfirmed(api.pendingGroupDelete.nodes);
  assert.equal(api.state.groups.some((group) => group.id === "group-projects"), false);
  assert.equal(api.state.trash.some((record) => record.kind === "group"), true);
});

test("focus mode accepts groups and hides retention-hidden children", async () => {
  const api = await loadBoardApi();
  assert.equal(api.enterGroupFocusMode("group-projects"), true);
  assert.equal(api.toggleFocusMode(), false);

  const html = api.renderFocusChildren([
    { id: "a", text: "", children: [] },
    { id: "b", text: "Real child", children: [] },
  ]);
  assert.equal((html.match(/<li/g) || []).length, 2, "empty rows stay editable in focus mode");

  const group = api.state.groups.find((item) => item.id === "group-projects");
  api.state.settings.completionRetentionSeconds = 0;
  api.setTaskCompleted(group.tasks[0].id, true, "2020-01-01T00:00:00.000Z");
  const filtered = api.renderFocusChildren(group.tasks, 0, group);
  assert.equal(filtered.includes(`data-focus-task-text="${group.tasks[0].id}"`), false);
});

test("history records completions and deletions with task names", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const item = group.tasks[0];
  api.setTaskCompleted(item.id, true);
  assert.match(api.state.history.at(-1).text, /^Completed /);
  api.deleteTaskWithPolicy(group.tasks[1].id);
  assert.match(api.state.history.at(-1).text, /^Deleted /);
  assert.equal(api.state.history.length <= 50, true);
});

test("policy override menus name the current global policy", async () => {
  const api = await loadBoardApi();
  api.state.settings.completionRetentionSeconds = 7 * 24 * 60 * 60;
  assert.equal(api.describeGlobalCompletionPolicy(), "hide after 7 days");
  api.state.settings.completionRetentionSeconds = 0;
  assert.equal(api.describeGlobalCompletionPolicy(), "hide right away");
  api.state.settings.completionRetentionSeconds = null;
  assert.equal(api.describeGlobalCompletionPolicy(), "keep visible");
});

test("deleting the first task in a group selects the group header", async () => {
  const api = await loadBoardApi();
  const visible = api.getVisibleNodes();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const neighbor = api.getNeighborAfterDelete({ kind: "task", id: group.tasks[0].id }, visible);
  assert.equal(neighbor.kind, "group");
  assert.equal(neighbor.id, "group-today");
});

test("completed and trash sections are reachable as keyboard nodes", async () => {
  const api = await loadBoardApi();
  const visible = api.getVisibleNodes();
  assert.equal(visible.at(-2).kind, "section");
  assert.equal(visible.at(-2).id, "completed");
  assert.equal(visible.at(-1).kind, "section");
  assert.equal(visible.at(-1).id, "trash");
  const html = await readBoard();
  assert.match(html, /data-section-row="completed"/);
  assert.match(html, /data-sidebar-resizer/);
  assert.equal(html.includes('contenteditable="false"'), false);
});

test("task images become keyboard nodes and delete removes just the image", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const item = group.tasks[0];
  item.images = [{ id: "img-t1", src: "data:image/webp;base64,AA==", width: 200 }];

  const visible = api.getVisibleNodes();
  const taskIndex = visible.findIndex((node) => node.kind === "task" && node.id === item.id);
  assert.equal(visible[taskIndex + 1].kind, "image");
  assert.equal(visible[taskIndex + 1].id, "img-t1");
  assert.equal(visible[taskIndex + 1].taskId, item.id);

  assert.equal(api.findImageNode("img-t1").taskId, item.id);
  assert.equal(api.removeTaskImage(item.id, "img-t1"), true);
  assert.equal(item.images.length, 0);
  assert.equal(item.text.length > 0, true);
  assert.match(api.state.history.at(-1).text, /Removed an image/);
});

test("trash records describe their origin group and parent", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-projects");
  const parent = group.tasks.find((item) => item.children.length > 0);
  const child = parent.children[0];
  const record = api.deleteTaskWithPolicy(child.id, "2026-07-11T12:00:00.000Z");
  const origin = api.describeTrashOrigin(record);
  assert.match(origin, /^In Projects/);
  assert.match(origin, new RegExp(parent.text.slice(0, 10).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("alt arrows move a task through subtrees and across groups", async () => {
  const api = await loadBoardApi();
  const kora = api.state.groups.find((group) => group.id === "group-projects");
  const first = kora.tasks[0];
  const withChildren = kora.tasks[1];
  assert.ok(withChildren.children.length > 0);

  assert.equal(api.moveTaskVisually(first.id, 1), true);
  assert.equal(kora.tasks[0].id, withChildren.id);
  assert.equal(withChildren.children[0].id, first.id);

  assert.equal(api.moveTaskVisually(first.id, -1), true);
  assert.equal(kora.tasks[0].id, first.id);

  const priorities = api.state.groups.find((group) => group.id === "group-priorities");
  const projects = api.state.groups.find((group) => group.id === "group-projects");
  const last = priorities.tasks.at(-1);
  assert.equal(api.moveTaskVisually(last.id, 1), true);
  assert.equal(projects.tasks[0].id, last.id);
  assert.equal(api.moveTaskVisually(last.id, -1), true);
  assert.equal(priorities.tasks.at(-1).id, last.id);
});

test("tab indents and outdents every selected task at once", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.id === "group-today");
  const [anchor, second, third] = today.tasks;

  api.selectNode("task", second.id);
  api.selectNode({ kind: "task", id: third.id }, null, { extend: true });
  assert.equal(api.shiftSelectedDepth(false), true);
  assert.equal(anchor.children.at(-2).id, second.id);
  assert.equal(anchor.children.at(-1).id, third.id);

  api.selectNode("task", second.id);
  api.selectNode({ kind: "task", id: third.id }, null, { extend: true });
  assert.equal(api.shiftSelectedDepth(true), true);
  assert.equal(today.tasks[1].id, second.id);
  assert.equal(today.tasks[2].id, third.id);
});

test("board shell brands as Punchlist with a timeline pane and history tab", async () => {
  const html = await readBoard();
  for (const hook of [
    "<title>Punchlist</title>",
    "data-board-split",
    "data-timeline-pane",
    "data-history-menu",
    "data-history-list",
    "data-image-handle",
    "compressImageFile",
    "focus-child-text",
    "Ctrl\\+Enter",
    "Use global \\(",
  ]) {
    assert.match(html, new RegExp(hook));
  }
});

test("settings offers a feedback button that copies the author's email", async () => {
  const html = await readBoard();
  assert.match(html, /data-feedback/);
  assert.match(html, /Give feedback/);
  assert.match(html, /evrenucar1999@gmail\.com/);
});

test("shell provides a collapsible sidebar, views navigation, help, and a favicon", async () => {
  const html = await readBoard();
  for (const hook of [
    "data-sidebar-toggle",
    "data-sidebar-backdrop",
    "data-views-nav",
    "data-view-nav",
    "data-help",
    'rel="icon"',
    "data:image/svg\\+xml",
    "Restore example board",
    "stays in this browser",
    "Press and hold",
  ]) {
    assert.match(html, new RegExp(hook));
  }
  assert.equal(html.includes("data-total-count"), false);
  assert.equal(html.includes("data-done-count"), false);
  assert.equal(html.includes("Reset seed"), false);
});

test("dark theme derives group tints and phone layout keeps touch friendly controls", async () => {
  const html = await readBoard();
  assert.match(html, /--group-dark-bg/);
  assert.match(html, /body\[data-theme="dark"\] \.group-header/);
  assert.match(html, /@media \(max-width: 980px\)/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /sidebar-open/);
  assert.match(html, /sidebar-backdrop/);
});

test("task board file contains the seeded task groups and nested tasks", async () => {
  const html = await readBoard();

  for (const text of [
    "Getting started",
    "Today",
    "Priorities",
    "Projects",
    "Later",
    "Redesign the personal website",
    "Write the landing-page copy",
    "Compare train versus driving",
    "Compare Obsidian, ClickUp, Todoist, Things, and Notion workflows",
  ]) {
    assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("task board includes real editing, persistence, delete, collapse, keyboard, and drag/drop hooks", async () => {
  const html = await readBoard();

  for (const hook of [
    "contenteditable",
    "localStorage",
    "deleteTask",
    "toggleTask",
    "ArrowUp",
    "ArrowDown",
    "altKey",
    "dragstart",
    "dragover",
    "drop",
    "draggable",
  ]) {
    assert.match(html, new RegExp(hook));
  }
});

test("task board inline script parses as JavaScript", async () => {
  const html = await readBoard();
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

  assert.ok(scripts.length > 0, "expected at least one inline script");
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script));
  }
});

test("top-level categories have distinct color accents", async () => {
  const html = await readBoard();

  assert.match(html, /--group-color/);
  assert.match(html, /group-priorities[\s\S]*color/);
  assert.match(html, /group-projects[\s\S]*color/);
  assert.match(html, /group-later[\s\S]*color/);
});

test("main task board renders as a single column", async () => {
  const html = await readBoard();

  assert.match(html, /\.board\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.doesNotMatch(html, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("keyboard navigation includes groups and items with selected-node collapse handling", async () => {
  const html = await readBoard();

  for (const hook of [
    "selectedNode",
    "getVisibleNodes",
    "selectNode",
    "toggleSelectedNode",
    "data-group-row",
    "data-node-kind",
  ]) {
    assert.match(html, new RegExp(hook));
  }
});

test("selected items support direct typing and shift enter creates an editing line break", async () => {
  const html = await readBoard();

  for (const hook of [
    "focusEditableText",
    "startEditingSelectedNode",
    "insertEditingLineBreak",
    "insertSiblingBelowSelectedNode",
    "event.key === \"Enter\"",
    "event.shiftKey",
    "event.key.length === 1",
    "data-group-title",
    "data-task-text",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("ctrl arrows toggle selected nodes and alt arrows move every selected node level", async () => {
  const html = await readBoard();

  for (const hook of [
    "moveSelectedNodes",
    "moveNodeInList",
    "moveEntriesInList",
    "event.key === \"ArrowUp\" && event.ctrlKey && !event.altKey",
    "event.key === \"ArrowDown\" && event.ctrlKey && !event.altKey",
    "event.altKey && !event.ctrlKey",
    "moveTaskVisually(selection[0].id, direction)",
    "moveSelectedNodes(direction)",
    "toggleSelectedNodes(true)",
    "toggleSelectedNodes(false)",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("mouse drag supports visible task rows and draggable group reordering", async () => {
  const html = await readBoard();

  for (const hook of [
    "draggedNode",
    "getDropInstruction",
    "moveGroup",
    "data-group-card",
    "data-drag-kind=\"group\"",
    "data-drag-kind=\"task\"",
    "data-task-row",
    "data-group-row",
    "getBoundingClientRect",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("group drag can resolve a before-first-group board drop", async () => {
  const html = await readBoard();

  for (const hook of [
    "getBoardGroupDropInstruction",
    "data-board",
    "data-group-card",
    "targetKind: \"group\"",
    "position: \"before\"",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("multi-select supports delete move toggle and undo", async () => {
  const html = await readBoard();

  for (const hook of [
    "multiSelectedNodes",
    "selectionAnchorNode",
    "selectRangeToNode",
    "getSelectedNodes",
    "deleteSelectedNodes",
    "moveSelectedNodes",
    "toggleSelectedNodes",
    "pushUndoState",
    "restoreUndoState",
    "event.shiftKey",
    "event.key === \"Backspace\"",
    "event.key === \"Delete\"",
    "event.key.toLowerCase() === \"z\" && event.ctrlKey",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("programmatic focus does not collapse shift range selection", async () => {
  const html = await readBoard();

  for (const hook of [
    "suppressFocusSelection",
    "if (suppressFocusSelection) return",
    "selectNode(visible[Math.min(visible.length - 1, index + 1)], null, { extend: true })",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("selected ranges can be moved deleted and toggled", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  assert.ok(today);

  const first = today.tasks[0];
  const second = today.tasks[1];
  const third = today.tasks[2];
  const fourth = today.tasks[3];
  api.selectNode({ kind: "task", id: first.id });
  api.selectNode({ kind: "task", id: third.id }, null, { extend: true });
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [
    { kind: "task", id: first.id },
    { kind: "task", id: second.id },
    { kind: "task", id: third.id },
  ]);

  api.moveSelectedNodes(1);
  assert.equal(today.tasks[0].id, fourth.id);

  api.restoreUndoState();
  const projects = api.state.groups.find((group) => group.id === "group-projects");
  const projectDecision = projects.tasks.find((task) => task.text === "Redesign the personal website");
  api.selectNode({ kind: "task", id: projectDecision.id });
  api.toggleSelectedNodes(true);
  assert.equal(projectDecision.collapsed, true);

  api.restoreUndoState();
  const restoredToday = api.state.groups.find((group) => group.title === "Today");
  const deleteFirst = restoredToday.tasks[0];
  const deleteSecond = restoredToday.tasks[1];
  api.selectNode({ kind: "task", id: deleteFirst.id });
  api.selectNode({ kind: "task", id: deleteSecond.id }, null, { extend: true });
  api.deleteSelectedNodes();
  assert.equal(restoredToday.tasks.some((task) => task.id === deleteFirst.id), false);
  assert.equal(restoredToday.tasks.some((task) => task.id === deleteSecond.id), false);
});

test("top-level task operations mutate real group lists and undo", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  assert.ok(today);

  const first = today.tasks[0];
  const second = today.tasks[1];
  api.moveTask(second.id, first.id, "before");
  assert.equal(today.tasks[0].id, second.id);

  api.restoreUndoState();
  const restoredToday = api.state.groups.find((group) => group.title === "Today");
  assert.equal(restoredToday.tasks[0].id, first.id);

  api.deleteTask(first.id);
  assert.equal(restoredToday.tasks.some((task) => task.id === first.id), false);

  api.restoreUndoState();
  const undoToday = api.state.groups.find((group) => group.title === "Today");
  assert.equal(undoToday.tasks.some((task) => task.id === first.id), true);
});

test("groups have stable editable colors across reordering", async () => {
  const html = await readBoard();

  for (const hook of [
    "normalizeState",
    "changeGroupColor",
    "data-group-color",
    "color-picker",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const sidequests = api.state.groups.find((group) => group.id === "group-getting-started");
  const priorities = api.state.groups.find((group) => group.id === "group-priorities");
  assert.ok(sidequests);
  assert.ok(priorities);
  assert.equal(typeof sidequests.color, "string");

  const originalColor = sidequests.color;
  api.moveGroup(sidequests.id, priorities.id, "before");
  assert.equal(api.state.groups.find((group) => group.id === sidequests.id).color, originalColor);

  api.changeGroupColor(sidequests.id, "#112233");
  assert.equal(api.state.groups.find((group) => group.id === sidequests.id).color, "#112233");
});

test("markdown-style list commands insert indent and outdent tasks", async () => {
  const html = await readBoard();

  for (const hook of [
    "startEditingSelectedNode",
    "insertSiblingBelowSelectedNode",
    "insertSiblingBelowNode",
    "indentSelectedNode",
    "outdentSelectedNode",
    "event.key === \"Tab\"",
    "event.key.length === 1",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  assert.ok(today);
  const first = today.tasks[0];

  const inserted = api.insertSiblingBelowNode({ kind: "task", id: first.id });
  assert.equal(today.tasks[1].id, inserted.id);

  assert.equal(api.indentTask(inserted.id), true);
  assert.equal(first.children.at(-1).id, inserted.id);

  assert.equal(api.outdentTask(inserted.id), true);
  assert.equal(today.tasks[1].id, inserted.id);
});

test("empty task text deletes the item and selects the previous visible item", async () => {
  const html = await readBoard();

  for (const hook of [
    "deleteTaskAndSelectNeighbor",
    "deleteTaskIfEmpty",
    "getNeighborAfterDelete",
    "isEditableTextEmpty",
    "handleEditingBackspaceDelete",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  assert.ok(today);

  const first = today.tasks[0];
  const second = today.tasks[1];
  const deleted = api.deleteTaskIfEmpty(second.id, "");

  assert.equal(deleted, true);
  assert.equal(today.tasks.some((task) => task.id === second.id), false);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [{ kind: "task", id: first.id }]);
});

test("clearing selected task text keeps the empty item until the next delete key", async () => {
  const html = await readBoard();

  assert.match(html, /updateTaskTextFromEditable/);
  assert.doesNotMatch(html, /if \(deleteTaskIfEmpty\(textEl\.dataset\.taskText, textEl\)\) return;/);

  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  assert.ok(today);

  const first = today.tasks[0];
  const second = today.tasks[1];
  assert.equal(api.updateTaskTextFromEditable(second.id, ""), true);
  assert.equal(today.tasks.some((task) => task.id === second.id), true);
  assert.equal(second.text, "");

  assert.equal(api.deleteTaskIfEmpty(second.id, ""), true);
  assert.equal(today.tasks.some((task) => task.id === second.id), false);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [{ kind: "task", id: first.id }]);
});

test("ctrl z restores a deleted item even after editing focus", async () => {
  const html = await readBoard();

  for (const hook of [
    "lastUndoAction",
    "shouldUseBoardUndo",
    "pushUndoState(\"delete\")",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  assert.ok(today);
  const second = today.tasks[1];

  api.deleteTask(second.id);
  assert.equal(today.tasks.some((task) => task.id === second.id), false);
  assert.equal(api.shouldUseBoardUndo(true), true);

  api.restoreUndoState();
  const restoredToday = api.state.groups.find((group) => group.title === "Today");
  assert.equal(restoredToday.tasks.some((task) => task.id === second.id), true);
});

test("direct typing into a selected item appends to existing text", async () => {
  const html = await readBoard();

  assert.match(html, /insertTextAtSelection\(initialText, editable\)/);
  assert.doesNotMatch(html, /replaceEditableContents\(editable, initialText\)/);

  const api = await loadBoardApi();
  const editable = {
    textContent: "Existing",
    dispatchEvent() {},
  };

  api.insertTextAtSelection("!", editable);
  assert.equal(editable.textContent, "Existing!");
});

test("typing into a fully selected item replaces selected text", async () => {
  const html = await readBoard();

  for (const hook of [
    "selectionContainsEditableContents",
    "replaceEditableContents",
    "startEditingSelectedNode(initialText",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const editable = {
    textContent: "Original text",
    dispatchEvent() {},
  };
  const range = {
    commonAncestorContainer: editable,
    deleteContents() {
      editable.textContent = "";
    },
    insertNode(node) {
      editable.textContent += node.textContent;
    },
    setStartAfter() {},
    collapse() {},
  };

  assert.equal(api.selectionContainsEditableContents(editable, range), true);
  api.replaceEditableContents(editable, "N");
  assert.equal(editable.textContent, "N");
});

test("static task board supports export and import without server storage", async () => {
  const html = await readBoard();

  for (const hook of [
    "data-export-board",
    "data-import-board",
    "data-import-file",
    "serializeBoardState",
    "downloadBoardState",
    "importBoardStateFromJson",
    "handleImportFile",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const removedHook of [
    "SERVER_STORAGE_ENABLED",
    "STATE_ENDPOINT",
    "loadStateFromServer",
    "saveStateToServer",
    "syncFromServer",
  ]) {
    assert.doesNotMatch(html, new RegExp(removedHook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const exported = JSON.parse(api.serializeBoardState());
  assert.equal(exported.version, 2);
  assert.ok(Array.isArray(exported.state.groups));
  assert.equal(exported.state.groups.some((group) => group.title === "Projects"), true);

  const importedState = {
    groups: [
      {
        id: "group-imported",
        title: "Imported",
        collapsed: false,
        tasks: [
          { id: "task-imported", text: "Imported task", done: false, collapsed: false, children: [] },
        ],
      },
    ],
  };
  assert.equal(api.importBoardStateFromJson(JSON.stringify({ state: importedState })), true);
  assert.equal(api.state.groups.length, 1);
  assert.equal(api.state.groups[0].title, "Imported");
  assert.equal(api.state.groups[0].tasks[0].text, "Imported task");
});

test("task board can copy any task into Doing now without removing the original", async () => {
  const html = await readBoard();

  for (const hook of [
    "ensureDoingNowGroup",
    "cloneTaskTree",
    "copyTaskToDoingNow",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const kora = api.state.groups.find((group) => group.title === "Projects");
  assert.ok(kora);
  const source = kora.tasks[0];

  const copied = api.copyTaskToDoingNow(source.id);
  assert.ok(copied);

  const doingNow = api.state.groups.find((group) => group.title === "Doing now");
  assert.ok(doingNow);
  assert.equal(doingNow.tasks.at(-1).text, source.text);
  assert.notEqual(doingNow.tasks.at(-1).id, source.id);
  assert.equal(kora.tasks.some((task) => task.id === source.id), true);
});

test("dragging near viewport edges starts auto scroll", async () => {
  const html = await readBoard();

  for (const hook of [
    "AUTO_SCROLL_EDGE_PX",
    "MAX_AUTO_SCROLL_SPEED",
    "updateDragAutoScroll",
    "stopDragAutoScroll",
    "requestAnimationFrame",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("task board has a full-screen focus mode for the selected task", async () => {
  const html = await readBoard();

  for (const hook of [
    "data-focus-mode",
    "data-focus-button",
    "focusModeTaskId",
    "enterFocusMode",
    "exitFocusMode",
    "renderFocusMode",
    "toggleFocusMode",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("focus mode advertises Ctrl+Alt+F and left controls have hover explanations", async () => {
  const html = await readBoard();

  assert.equal(html.includes("Shift+F"), false, "old focus shortcut must be gone");
  for (const hook of [
    "Ctrl+Alt+F",
    "title=\"Create a new top-level group (Alt+A)\"",
    "title=\"Expand every group and task (Ctrl+Shift+Down)\"",
    "title=\"Collapse every group and task (Ctrl+Shift+Up)\"",
    "title=\"Open focus mode for the selected task (Ctrl+Alt+F)\"",
    "title=\"Download this board as a JSON backup\"",
    "title=\"Load a board from a JSON backup\"",
    "title=\"Replace the current board with the built-in example board\"",
    "title=\"Recent changes on this board\"",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("main page has a live 24 hour clock", async () => {
  const html = await readBoard();

  for (const hook of [
    "data-clock",
    "formatClockTime",
    "updateClock",
    "hour12: false",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  assert.equal(api.formatClockTime(new Date("2026-07-09T17:05:00")), "17:05");
});

test("settings menu toggles and persists dark mode", async () => {
  const html = await readBoard();

  for (const hook of [
    "data-settings-menu",
    "data-dark-mode",
    "THEME_STORAGE_KEY",
    "applyTheme",
    "toggleDarkMode",
    "dark",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  assert.equal(api.toggleDarkMode(true), true);
  assert.equal(api.loadTheme(), "dark");
  assert.equal(api.toggleDarkMode(false), false);
  assert.equal(api.loadTheme(), "light");
});

test("focus mode tracks and resumes accumulated task time", async () => {
  const html = await readBoard();

  for (const hook of [
    "data-focus-timer",
    "focusSeconds",
    "formatFocusSeconds",
    "getFocusElapsedSeconds",
    "addFocusElapsedSeconds",
    "stopFocusTimer",
  ]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const api = await loadBoardApi();
  const kora = api.state.groups.find((group) => group.title === "Projects");
  assert.ok(kora);
  const firstTask = kora.tasks[0];

  assert.equal(api.formatFocusSeconds(65), "01:05");
  assert.equal(api.formatFocusSeconds(3661), "01:01:01");
  assert.equal(firstTask.focusSeconds, 0);

  assert.equal(api.addFocusElapsedSeconds(firstTask.id, 1000, 66000), true);
  assert.equal(firstTask.focusSeconds, 65);

  assert.equal(api.addFocusElapsedSeconds(firstTask.id, 66000, 126000), true);
  assert.equal(firstTask.focusSeconds, 125);

  const exported = JSON.parse(api.serializeBoardState());
  const exportedKora = exported.state.groups.find((group) => group.title === "Projects");
  assert.equal(exportedKora.tasks[0].focusSeconds, 125);
});

test("seed board is marked example and start-own-board wipes it", async () => {
  const api = await loadBoardApi();
  assert.equal(api.state.example, true);

  api.startOwnBoard();
  assert.equal(api.state.example, false);
  assert.equal(api.state.groups.length, 1);
  assert.equal(api.state.groups[0].tasks.length, 0);
  assert.equal(api.state.trash.length, 0);

  const legacy = api.migrateState({ version: 2, groups: [] });
  assert.equal(legacy.example, false);

  api.reset();
  assert.equal(api.state.example, true);
});

test("app version is exposed and wired into the sidebar", async () => {
  const api = await loadBoardApi();
  assert.match(api.APP_VERSION, /^\d+\.\d+\.\d+$/);

  const html = await readBoard();
  assert.match(html, /data-app-version/);
  assert.match(html, /data-example-banner-host/);
  assert.match(html, /Get latest/);
});
