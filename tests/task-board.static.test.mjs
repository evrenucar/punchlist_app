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

async function loadBoardApi(overrides = {}) {
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

  Object.assign(context, overrides);
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

test("caret-aware enter keeps start-of-text intact and splits mid-text", async () => {
  const api = await loadBoardApi();

  // Enter at the start of a NON-empty item pushes a fresh empty line ABOVE
  // (Evren 2026-07-19 PM, reversing the AM call): original keeps its text
  assert.equal(JSON.stringify(api.getTaskSplitPlan("Alpha", 0)), JSON.stringify({
    beforeText: "Alpha",
    afterText: "",
    position: "before",
  }));
  // a fully empty line is the exception: Enter there creates BELOW
  assert.equal(JSON.stringify(api.getTaskSplitPlan("", 0)), JSON.stringify({
    beforeText: "",
    afterText: "",
    position: "after",
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

test("expand chevron is hidden when a task's only children are completed-and-hidden", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((g) => g.id === "group-projects");
  const parent = group.tasks.find((t) => t.children && t.children.length > 0);
  parent.collapsed = false;
  api.state.settings.completionRetentionSeconds = 10;
  // Every child completed long ago, so isTaskHiddenFromActive hides them all.
  for (const child of parent.children) {
    child.done = true;
    child.completedAt = "2020-01-01T00:00:00.000Z";
    child.children = [];
  }
  const html = api.renderTask(parent, group.id, "");
  // A toggle over nothing must not render a chevron or an empty child list.
  assert.ok(html.includes(`class="chevron hidden" type="button" data-action="toggle-task" data-task-id="${parent.id}"`));
  assert.equal(/child-list/.test(html), false);
});

test("expand chevron shows when a task has a visible child", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((g) => g.id === "group-projects");
  const parent = group.tasks.find((t) => t.children && t.children.length > 0);
  parent.collapsed = false;
  // Guarantee one child is visible so the chevron has something to reveal.
  parent.children[0].done = false;
  parent.children[0].completedAt = null;
  const html = api.renderTask(parent, group.id, "");
  assert.ok(html.includes(`class="chevron " type="button" data-action="toggle-task" data-task-id="${parent.id}"`));
  assert.match(html, /child-list/);
});

test("focus outline respects collapse and hides the chevron on leaves", async () => {
  const api = await loadBoardApi();
  const parent = { id: "ffp", text: "parent", collapsed: false, children: [{ id: "ffc", text: "child", children: [] }] };
  const leaf = { id: "ffl", text: "leaf", children: [] };
  let html = api.renderFocusChildren([parent, leaf], 0, null);
  assert.ok(html.includes('data-focus-task-text="ffc"'), "expanded parent shows its child");
  assert.ok(html.includes('data-focus-chevron="ffp" aria-label="Collapse" aria-expanded="true"'), "parent chevron reads expanded");
  assert.ok(html.includes('class="focus-child-chevron hidden"'), "a leaf has no visible chevron");
  parent.collapsed = true;
  html = api.renderFocusChildren([parent, leaf], 0, null);
  assert.ok(!html.includes('data-focus-task-text="ffc"'), "collapsed parent hides its child");
  assert.ok(html.includes('data-focus-chevron="ffp" aria-label="Expand" aria-expanded="false"'), "parent chevron reads collapsed");
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
  assert.equal(JSON.parse(await api.serializeBoardState()).state.trash.length, 0);
  api.state.settings.exportTrash = true;
  assert.equal(JSON.parse(await api.serializeBoardState()).state.trash.length, 1);
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
  assert.equal(inserted.text, "");
  assert.equal(group.tasks[0].id, inserted.id);
  assert.equal(group.collapsed, false);
  assert.equal(api.state.groups.length, groupCount);
});

test("every task-creation path starts empty, ready to type", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((item) => item.id === "group-today");
  const viaGroupEnter = api.insertSiblingBelowNode({ kind: "group", id: group.id });
  const viaTaskEnter = api.insertSiblingBelowNode({ kind: "task", id: viaGroupEnter.id });
  const viaAddButton = api.addTask(group.id);
  const viaAddChild = api.addTask(group.id, viaTaskEnter.id);
  for (const created of [viaGroupEnter, viaTaskEnter, viaAddButton, viaAddChild]) {
    assert.ok(created);
    assert.equal(created.text, "", "new tasks never carry placeholder text (braindump 2026-07-17)");
  }
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

test("focus mode owns its keys: outline browsing, sibling moves, guarded board", async () => {
  const api = await loadBoardApi();
  const html = await readBoard();

  // Alt+arrows in the focus outline reorder within the sibling list and clamp at the edges
  const today = api.state.groups.find((group) => group.id === "group-today");
  const [first, second] = today.tasks;
  assert.equal(api.moveTaskAmongSiblings(first.id, 1), true);
  assert.equal(today.tasks[0].id, second.id);
  assert.equal(today.tasks[1].id, first.id);
  assert.equal(api.moveTaskAmongSiblings(first.id, -1), true);
  assert.equal(today.tasks[0].id, first.id);
  assert.equal(api.moveTaskAmongSiblings(first.id, -1), false, "top of the list clamps");

  // overlay arrows browse between editables, caret-aware, and never reach the board handler
  assert.match(html, /caretOnBoundaryLine\(overlayEditable, direction\)/);
  // while focus mode is open, the document handler must bail before driving board rows
  assert.match(html, /if \(focusModeTaskId \|\| focusModeGroupId\) \{[\s\S]{0,600}?\}\s*\n\s*const visible = getVisibleNodes\(\);/);
});

test("cut removes items immediately and undo restores them in place", async () => {
  const api = await loadBoardApi();
  const html = await readBoard();
  const today = api.state.groups.find((group) => group.id === "group-today");
  const victim = today.tasks[1];
  const countBefore = today.tasks.length;

  api.selectNode("task", victim.id);
  const clipboard = api.rememberInternalClipboard("cut");
  assert.equal(clipboard.detached.length, 1);
  assert.equal(clipboard.detached[0].id, victim.id);
  assert.equal(today.tasks.length, countBefore - 1, "cut item leaves the board at cut time");
  assert.equal(today.tasks.some((item) => item.id === victim.id), false);

  api.restoreUndoState();
  const restored = api.state.groups.find((group) => group.id === "group-today");
  assert.equal(restored.tasks.length, countBefore);
  assert.equal(restored.tasks[1].id, victim.id, "undo puts the cut item back where it was");

  // paste re-inserts the detached originals, skipping any undo already restored
  assert.match(html, /internalClipboard\.detached \|\| \[\]/);
});

test("ctrl+up on an element with nothing to collapse climbs to the enclosing toggle", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((g) => g.tasks.some((t) => (t.children || []).length > 0));
  const parent = group.tasks.find((t) => (t.children || []).length > 0);
  const leaf = parent.children[0];

  api.selectNode("task", leaf.id);
  api.toggleSelectedNodes(true);
  assert.equal(parent.collapsed, true, "collapsing a leaf collapses its parent toggle");
  assert.equal(JSON.stringify(api.getSelectedNodes()[0]), JSON.stringify({ kind: "task", id: parent.id }));

  api.toggleSelectedNodes(true);
  assert.equal(group.collapsed, true, "climbing past the last toggle collapses the group");
});

test("completed and trash rows indent one level under their section header", async () => {
  const html = await readBoard();
  assert.match(html, /\.lifecycle-list \{[^}]*padding-left/s);
});

test("deleting a subtree or multi-selection asks for confirmation first", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((g) => g.tasks.some((t) => (t.children || []).length > 0) && g.tasks.some((t) => !(t.children || []).length));
  const parent = group.tasks.find((t) => (t.children || []).length > 0);
  const leaf = group.tasks.find((t) => !(t.children || []).length);

  // a single childless task still deletes without any prompt
  const trashBefore = api.state.trash.length;
  api.selectNode("task", leaf.id);
  api.deleteSelectedNodes();
  assert.equal(api.pendingGroupDelete, null);
  assert.equal(api.state.trash.length, trashBefore + 1);

  // a task with sub-items asks, naming the subtree size
  api.selectNode("task", parent.id);
  api.deleteSelectedNodes();
  assert.ok(api.pendingGroupDelete, "subtree delete waits for confirmation");
  assert.match(api.pendingGroupDelete.label, /this task and its \d+ sub-item/);
  assert.equal(group.tasks.some((t) => t.id === parent.id), true, "nothing deleted before confirming");

  // confirming completes the delete
  api.deleteSelectedNodes(api.pendingGroupDelete.nodes, { confirmed: true });
  assert.equal(group.tasks.some((t) => t.id === parent.id), false);

  // a multi-selection asks too
  const [a, b] = api.state.groups.find((g) => g.tasks.length >= 2).tasks;
  api.selectNode("task", a.id);
  api.selectNode({ kind: "task", id: b.id }, null, { extend: true });
  api.deleteSelectedNodes();
  assert.ok(api.pendingGroupDelete);
  assert.match(api.pendingGroupDelete.label, /2 selected items/);
});

test("favicon renders single color, opposite of the browser scheme, checkmark cut out", async () => {
  const html = await readBoard();
  assert.match(html, /matchMedia\?\.\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(html, /faviconSvg\(darkSchemeQuery\?\.matches \? "#ffffff" : "#191b1a"\)/);
  assert.match(html, /<mask id='m'>/);
});

test("task images decode sync so re-renders never flash the background", async () => {
  // lazy+async (0e12d7b) made every add/delete blank the images for a few
  // frames — Evren's "back fill color flashes" report, confirmed 2026-07-19
  // via img.complete=false after a structural render. The stutter that change
  // chased was actually the per-keystroke full-state save, now debounced.
  const html = await readBoard();
  assert.match(html, /alt="Pasted image" draggable="false" decoding="sync"/);
  assert.doesNotMatch(html, /loading="lazy"/);
});

test("backspace at the start merges a task into the item above, children follow", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((g) => g.tasks.some((t) => (t.children || []).length > 0));
  const parent = group.tasks.find((t) => (t.children || []).length > 0);
  parent.collapsed = false;

  // first child merges into its parent; grandchildren keep their slot
  const firstChild = parent.children[0];
  firstChild.children = [{ id: "merge-grand", text: "grand", done: false, children: [] }];
  const parentText = parent.text;
  const childText = firstChild.text;
  assert.equal(api.mergeTaskIntoPrevious(firstChild.id), true);
  assert.equal(parent.text, parentText + childText);
  assert.equal(parent.children.some((t) => t.id === firstChild.id), false);
  assert.equal(parent.children[0].id, "merge-grand", "children take the merged item's place");

  // adjacent sibling merges into the previous one, which adopts the children
  const a = { id: "merge-a", text: "alpha", done: false, children: [], collapsed: false };
  const b = { id: "merge-b", text: "beta", done: false, collapsed: false,
    children: [{ id: "merge-adopted", text: "adopted", done: false, children: [] }] };
  group.tasks.push(a, b);
  assert.equal(api.mergeTaskIntoPrevious(b.id), true);
  assert.equal(a.text, "alphabeta");
  assert.equal(a.children.some((t) => t.id === "merge-adopted"), true);

  // undo restores the merged item
  api.restoreUndoState();
  const restored = api.state.groups.find((g) => g.id === group.id);
  assert.equal(JSON.stringify(restored).includes("beta"), true);
});

test("left arrow climbs task -> parent -> group header instead of jumping to the sidebar", async () => {
  const api = await loadBoardApi();
  const group = api.state.groups.find((g) => g.tasks.some((t) => (t.children || []).length > 0));
  const parent = group.tasks.find((t) => (t.children || []).length > 0);
  const child = parent.children[0];

  api.selectNode("task", child.id);
  assert.equal(api.selectHierarchicalParent(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes()[0])), { kind: "task", id: parent.id });

  assert.equal(api.selectHierarchicalParent(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes()[0])), { kind: "group", id: group.id });

  // from a group header there is no hierarchical parent; the sidebar takes over
  assert.equal(api.selectHierarchicalParent(), false);
});

test("swipe distance maps to hierarchy levels and applies indents in one undo step", async () => {
  const api = await loadBoardApi();
  const html = await readBoard();

  // distance -> levels: one level per 32px, clamped at 3, truncated not rounded
  assert.equal(api.getSwipeLevels(10), 0);
  assert.equal(api.getSwipeLevels(35), 1);
  assert.equal(api.getSwipeLevels(70), 2);
  assert.equal(api.getSwipeLevels(500), 3);
  assert.equal(api.getSwipeLevels(-35), -1);
  assert.equal(api.getSwipeLevels(-500), -3);

  // a two-level outdent surfaces a grandchild to the top level in one gesture
  const group = api.state.groups[0];
  const a = { id: "sw-a", text: "a", done: false, collapsed: false,
    children: [{ id: "sw-b", text: "b", done: false, collapsed: false,
      children: [{ id: "sw-c", text: "c", done: false, children: [] }] }] };
  group.tasks.push(a);
  assert.equal(api.applySwipeIndent("sw-c", -2), 2);
  assert.equal(group.tasks.some((t) => t.id === "sw-c"), true);

  // indent clamps at what the tree allows and reports what it applied
  assert.equal(api.applySwipeIndent("sw-c", 3) >= 1, true);

  // rows opt into pan-y so vertical scroll stays native while swipes feed the gesture
  assert.match(html, /\.task-row \{\s*touch-action: pan-y;/);
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
    "if (suppressFocusSelection || Date.now() < squelchTapUntil) return",
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
  assert.ok(api.pendingGroupDelete, "multi-delete waits for confirmation since 2026-07-17");
  api.deleteSelectedNodes(api.pendingGroupDelete.nodes, { confirmed: true });
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

test("enter on a parent item: expanded gets a first child, collapsed gets a sibling below", async () => {
  const api = await loadBoardApi();
  const projects = api.state.groups.find((group) => group.title === "Projects");
  const expandedParent = projects.tasks.find((item) => item.text === "Redesign the personal website");
  expandedParent.collapsed = false;
  const child = api.insertSiblingBelowNode({ kind: "task", id: expandedParent.id });
  assert.equal(expandedParent.children[0].id, child.id, "expanded parent: new item becomes its first child (Evren spec 2026-07-17)");
  assert.equal(child.createdUnderTaskId, expandedParent.id);

  const collapsedParent = projects.tasks.find((item) => item.text === "Plan a weekend trip");
  collapsedParent.collapsed = true;
  const sibling = api.insertSiblingBelowNode({ kind: "task", id: collapsedParent.id });
  const index = projects.tasks.findIndex((item) => item.id === collapsedParent.id);
  assert.equal(projects.tasks[index + 1].id, sibling.id, "collapsed parent: sibling right below at the same depth");
  assert.equal(sibling.createdUnderTaskId, null);

  // same rule through the editing path: Enter with the caret at the END
  const split = api.splitTaskAtOffset(expandedParent.id, expandedParent.text.length);
  assert.equal(expandedParent.children[0].id, split.item.id, "caret-at-end split on an expanded parent: first child");
  const collapsedSplit = api.splitTaskAtOffset(collapsedParent.id, collapsedParent.text.length);
  const collapsedIndex = projects.tasks.findIndex((item) => item.id === collapsedParent.id);
  assert.equal(projects.tasks[collapsedIndex + 1].id, collapsedSplit.item.id, "caret-at-end split on a collapsed parent: sibling below");
});

test("enter at the start of a non-empty item inserts a fresh empty line above at the same depth", async () => {
  const api = await loadBoardApi();
  const projects = api.state.groups.find((group) => group.title === "Projects");
  const target = projects.tasks.find((item) => item.text === "Plan a weekend trip");
  const targetIndex = projects.tasks.findIndex((item) => item.id === target.id);

  const split = api.splitTaskAtOffset(target.id, 0);
  assert.equal(projects.tasks[targetIndex].id, split.item.id, "new empty item lands at the target's old slot (above)");
  assert.equal(projects.tasks[targetIndex + 1].id, target.id, "original follows, untouched");
  assert.equal(split.item.text, "", "the line above starts empty for him to type into");
  assert.equal(target.text, "Plan a weekend trip", "his original text is never rewritten");
  assert.equal(split.position, "before");
});

test("undo keeps the selection where the user was instead of jumping to the top", async () => {
  const api = await loadBoardApi();
  const later = api.state.groups.find((group) => group.title === "Later");
  const moved = later.tasks[0];
  api.moveTask(moved.id, later.tasks[1].id, "after");
  api.restoreUndoState();
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [{ kind: "task", id: moved.id }],
    "selection survives undo when the node still exists (braindump 2026-07-17, Ctrl+Z jump)");

  const created = api.addTask(later.id);
  api.selectNode({ kind: "task", id: created.id });
  api.restoreUndoState();
  assert.equal(JSON.parse(JSON.stringify(api.getSelectedNodes())).length, 0,
    "when the selected node vanishes with the undo, selection clears instead of grabbing the top node");
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
  const exported = JSON.parse(await api.serializeBoardState());
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
  assert.equal(await api.importBoardStateFromJson(JSON.stringify({ state: importedState })), true);
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

  const exported = JSON.parse(await api.serializeBoardState());
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

test("demo mode isolates storage and always seeds; real key untouched", async () => {
  const api = await loadBoardApi();
  assert.equal(api.IS_DEMO, false);
  assert.equal(api.STORAGE_KEY, "scheduling-task-management-board-v1");

  const demo = await loadBoardApi({ location: { search: "?demo" } });
  assert.equal(demo.IS_DEMO, true);
  assert.equal(demo.STORAGE_KEY, "scheduling-task-management-board-v1-demo");
  assert.equal(demo.state.example, true);
  assert.equal(demo.state.groups.length, 3, "demo board is the trimmed example");
  assert.equal(demo.state.groups.map((group) => group.title).join(","), "Getting started,Today,Projects");
  assert.equal(demo.state.settings.sidebarCollapsed, true);

  const html = await readBoard();
  assert.match(html, /startDemoDriver/);
});

test("update check: numeric version compare, and only a downloaded copy checks", async () => {
  const api = await loadBoardApi();
  assert.equal(api.compareVersions("1.5.4", "1.5.3"), 1);
  assert.equal(api.compareVersions("1.5.3", "1.5.4"), -1);
  assert.equal(api.compareVersions("v1.5.4", "1.5.4"), 0, "a leading v is ignored");
  assert.equal(api.compareVersions("1.10.0", "1.9.9"), 1, "numeric, not string, compare");
  assert.equal(api.compareVersions("2.0", "1.9.9"), 1);
  assert.equal(api.compareVersions("1.5", "1.5.0"), 0, "missing parts count as zero");

  // Hosted copy (served over http/https, no file:// protocol): never checks.
  const hostedCalls = [];
  const hosted = await loadBoardApi({
    location: { protocol: "https:" },
    fetch: async (url) => { hostedCalls.push(String(url)); return { ok: false, status: 404, json: async () => ({}) }; },
  });
  assert.equal(hosted.updateChecksEnabled(), false, "the hosted copy never checks");
  await hosted.checkForUpdate();
  assert.equal(hostedCalls.length, 0, "the hosted copy makes no network call");

  // Demo mode, even from a file url: never checks.
  const demoCalls = [];
  const demo = await loadBoardApi({
    location: { protocol: "file:", search: "?demo" },
    fetch: async (url) => { demoCalls.push(String(url)); return { ok: false, status: 404, json: async () => ({}) }; },
  });
  assert.equal(demo.IS_DEMO, true);
  assert.equal(demo.updateChecksEnabled(), false, "demo mode never checks");
  await demo.checkForUpdate();
  assert.equal(demoCalls.length, 0, "demo mode makes no network call");

  // Downloaded copy with the setting on: exactly one request to the releases API.
  const localCalls = [];
  const local = await loadBoardApi({
    location: { protocol: "file:" },
    fetch: async (url) => { localCalls.push(String(url)); return { ok: true, status: 200, json: async () => ({ tag_name: "v" + api.APP_VERSION }) }; },
  });
  assert.equal(local.updateChecksEnabled(), true, "a downloaded copy with the setting on checks");
  localCalls.length = 0; // ignore the fire-and-forget boot call
  await local.checkForUpdate();
  assert.equal(localCalls.length, 1, "a downloaded copy makes exactly one request");
  assert.match(localCalls[0], /api\.github\.com\/repos\/evrenucar\/punchlist_app\/releases\/latest/);

  // Turning the setting off cuts the local file off entirely.
  local.updateSettings({ checkForUpdates: false });
  assert.equal(local.updateChecksEnabled(), false);
  localCalls.length = 0;
  await local.checkForUpdate();
  assert.equal(localCalls.length, 0, "with the setting off, no check ever runs");

  const html = await readBoard();
  assert.match(html, /data-updates-section/);
  assert.match(html, /data-check-updates/);
});

test("github sync: decision table and utf8 base64 roundtrip", async () => {
  const api = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob });

  assert.equal(api.syncDecision({ remoteExists: false, remoteSha: null, lastSha: null, dirty: true }), "create");
  assert.equal(api.syncDecision({ remoteExists: true, remoteSha: "a", lastSha: "a", dirty: false }), "none");
  assert.equal(api.syncDecision({ remoteExists: true, remoteSha: "a", lastSha: "a", dirty: true }), "push");
  assert.equal(api.syncDecision({ remoteExists: true, remoteSha: "b", lastSha: "a", dirty: false }), "pull");
  assert.equal(api.syncDecision({ remoteExists: true, remoteSha: "b", lastSha: "a", dirty: true }), "push", "divergence resolves local-wins; git history keeps the loser");

  const text = "Ünïcödé ✓ görev listesi 🎯";
  assert.equal(api.decodeBase64Utf8(api.encodeBase64Utf8(text)), text);
  const wrapped = api.encodeBase64Utf8(text).replace(/(.{8})/g, "$1\n");
  assert.equal(api.decodeBase64Utf8(wrapped), text, "GitHub newline-wrapped base64 decodes");
});

test("github sync payload is lossless; token stays out of exports; demo never syncs", async () => {
  const api = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob });

  api.updateSettings({ exportCompleted: false });
  const placement = api.state.groups[0].tasks[0];
  const item = api.resolveTaskItem(placement);
  api.setTaskCompleted(item.id, true);

  const payload = JSON.parse(api.getSyncPayload());
  assert.equal(payload.state.settings, undefined, "per-device settings never sync");
  const syncedTexts = JSON.stringify(payload.state.groups);
  assert.ok(syncedTexts.includes(item.id), "completed task still in the sync payload");
  const exported = JSON.stringify(JSON.parse(await api.serializeBoardState()).state.groups);
  assert.equal(exported.includes(item.id), false, "export filter still drops completed tasks");

  api.saveSyncConfig({ enabled: true, repo: "evren/punchlist-data", token: "github_pat_secret" });
  assert.equal(api.syncIsActive(), true);
  assert.equal((await api.serializeBoardState()).includes("github_pat_secret"), false, "token never lands in a board export");
  api.saveSyncConfig({ enabled: false });
  assert.equal(api.syncIsActive(), false);

  const demo = await loadBoardApi({ location: { search: "?demo" }, TextEncoder, TextDecoder, btoa, atob });
  demo.saveSyncConfig({ enabled: true, repo: "evren/punchlist-data", token: "github_pat_secret" });
  assert.equal(demo.syncIsActive(), false, "demo mode can never talk to GitHub");
});

test("github sync pull applies a remote board and keeps local settings", async () => {
  const api = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob });
  api.updateSettings({ username: "local-name" });

  const remote = JSON.parse(api.getSyncPayload());
  remote.state.groups = [{ id: "group-remote", title: "From the other device", tasks: [], collapsed: false }];
  api.applySyncedState(remote);

  assert.equal(api.state.groups.some((group) => group.title === "From the other device"), true);
  assert.equal(api.state.settings.username, "local-name", "pull never clobbers per-device settings");
});

test("sync ui, home-screen hint, and demo height reporter are wired into the build", async () => {
  const html = await readBoard();
  assert.match(html, /data-sync-section/);
  assert.match(html, /data-sync-token/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /punchlistDemoHeight/);
  assert.match(html, /maybeShowHomeScreenHint/);

  const site = await readFile(path.join(root, "website", "index.html"), "utf8");
  assert.match(site, /punchlistDemoHeight/);
});

test("device identity labels history entries and the synced roster", async () => {
  const api = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob });
  const device = api.getDeviceIdentity();
  assert.ok(device.id, "every board load has a device id");
  api.saveDeviceIdentity({ name: "laptop" });
  assert.equal(api.deviceDisplayName(device.id), "laptop");

  api.logHistory("Changed the board");
  const entry = api.state.history[api.state.history.length - 1];
  assert.equal(entry.deviceId, device.id, "history entries carry the writing device's id");

  api.touchDeviceRoster();
  assert.equal(api.state.devices[device.id].name, "laptop", "roster records this device");
  assert.match(api.renderDeviceRoster(), /laptop/);
  assert.match(api.renderDeviceRoster(), /this device/);

  api.state.devices["device-x9k2"] = { name: "phone", lastSeenAt: "2026-07-16T08:00:00.000Z" };
  assert.equal(api.deviceDisplayName("device-x9k2"), "phone", "other devices resolve through the roster");
  assert.equal(api.deviceDisplayName("device-a1b2"), "device a1b2", "unnamed devices fall back to an id suffix");

  const html = await readBoard();
  assert.match(html, /data-device-name/);
  assert.match(html, /data-identity-line/);
  assert.match(html, /data-sync-devices/);
  assert.match(html, /punchlist sync \(\$\{trigger\}/, "commit messages template still present");
  assert.match(html, /deviceDisplayName\(deviceIdentity\.id\)/, "commit messages name the device");
});

test("import trust verdict decision core", async () => {
  const api = await loadBoardApi();
  assert.equal(api.importTrustVerdict({ signed: false }), "unsigned");
  assert.equal(api.importTrustVerdict({ signed: true, valid: false }), "invalid");
  assert.equal(api.importTrustVerdict({ signed: true, valid: true, fingerprint: "a", ownFingerprint: "a" }), "self");
  assert.equal(api.importTrustVerdict({ signed: true, valid: true, fingerprint: "a", ownFingerprint: "b", knownContact: true }), "known");
  assert.equal(api.importTrustVerdict({ signed: true, valid: true, fingerprint: "a", ownFingerprint: null, knownContact: false }), "first-contact");
});

test("exports carry a signature but never the private key or contact book", async () => {
  const api = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto });
  const identity = await api.ensureSigningIdentity();
  assert.ok(identity?.fingerprint, "signing identity generated");
  api.state.contacts = { abcd1234: { name: "trusted-friend", firstSeenAt: "2026-07-16T08:00:00.000Z", lastSeenAt: "2026-07-16T08:00:00.000Z" } };

  const exported = await api.serializeBoardState();
  assert.equal(exported.includes("privateKeyJwk"), false, "private key never lands in an export");
  assert.doesNotMatch(exported, /"d"\s*:/, "JWK private member never lands in an export");
  assert.equal(exported.includes("contacts"), false, "the local trust book never lands in an export");
  assert.equal(exported.includes("trusted-friend"), false);
  assert.equal(exported.includes("checkForUpdates"), false, "the update setting stays out of board exports");
  assert.equal(exported.includes("update-dismissed"), false, "the dismissed-version marker never lands in an export");

  const payload = JSON.parse(exported);
  assert.equal(payload.sender.fingerprint, identity.fingerprint);
  assert.ok(payload.signature, "export is signed");

  const sync = JSON.parse(api.getSyncPayload());
  assert.ok(sync.state.identity.privateKeyJwk, "sync payload carries the full identity so the user's devices share one key");
});

test("signed exports verify on import and repeat senders are recognized", async () => {
  const sender = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto });
  sender.updateSettings({ username: "Evren" });
  await sender.ensureSigningIdentity();
  const exportedText = await sender.serializeBoardState();

  const recipient = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto });
  const first = await recipient.describeImportSender(JSON.parse(exportedText));
  assert.equal(first.verdict, "first-contact");
  assert.equal(first.name, "Evren");

  assert.equal(await recipient.importBoardStateFromJson(exportedText), true);
  assert.ok(recipient.state.contacts[first.fingerprint], "sender lands in the contact book");
  assert.equal(recipient.state.contacts[first.fingerprint].name, "Evren");
  const provenance = recipient.state.history[recipient.state.history.length - 1];
  assert.match(provenance.text, /Imported a board from JSON, signed by Evren \(/, "the import survives in the new board's history");

  const second = await recipient.describeImportSender(JSON.parse(exportedText));
  assert.equal(second.verdict, "known", "the same key is recognized on the next import");

  const tampered = JSON.parse(exportedText);
  tampered.state.groups[0].title = "Tampered";
  assert.equal((await recipient.describeImportSender(tampered)).verdict, "invalid", "any content change breaks the signature");

  const self = await sender.describeImportSender(JSON.parse(exportedText));
  assert.equal(self.verdict, "self", "a board recognizes its own key");
});

test("sync pull never wipes the local identity; older payloads keep the key", async () => {
  const api = await loadBoardApi({ TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto });
  const identity = await api.ensureSigningIdentity();

  const remote = JSON.parse(api.getSyncPayload());
  delete remote.state.identity;
  remote.state.groups = [{ id: "group-remote", title: "From an older build", tasks: [], collapsed: false }];
  api.applySyncedState(remote);

  assert.equal(api.state.groups.some((group) => group.title === "From an older build"), true);
  assert.equal(api.state.identity.fingerprint, identity.fingerprint, "pull from a pre-identity build keeps the local key");
});

test("built board keeps the DOM hooks the status-board wrapper depends on", async () => {
  const built = await readFile(boardPath, "utf8");
  for (const hook of ["data-task-row", "data-group-title", "data-sidebar-toggle"]) {
    assert.equal(built.includes(hook), true, `${hook} is part of the status/ layer contract (CLAUDE.md)`);
  }
  // the wrapper also applies board updates in place through the test API
  const api = await loadBoardApi();
  for (const hook of ["applyExternalState", "selectNode"]) {
    assert.equal(typeof api[hook], "function", `taskBoardTestApi.${hook} is part of the status/ layer contract`);
  }
});

test("applyExternalState swaps the board in place without history noise", async () => {
  const api = await loadBoardApi();
  api.state.identity = { privateKeyJwk: { k: "keep-me" }, publicKeyJwk: {} };
  const historyBefore = api.state.history.length;
  api.applyExternalState({
    version: 2,
    groups: [{ id: "g-ext", title: "From the wrapper", collapsed: false, tasks: [{ id: "t-ext", text: "swapped in", children: [] }] }],
    history: [],
    trash: [],
    settings: { exportTrash: true },
  });
  assert.equal(api.state.groups.length, 1, "the incoming board replaced the old one");
  assert.equal(api.state.groups[0].title, "From the wrapper");
  assert.equal(api.state.identity.privateKeyJwk.k, "keep-me", "a running identity survives an external apply");
  assert.equal(api.state.history.length, 0, "no synthetic history entry is logged (the writer already attributed its edit)");
  assert.notEqual(api.state.history.length, historyBefore + 1, "external applies never add pull-style noise");
  assert.throws(() => api.applyExternalState({ nope: true }), /groups/, "a malformed board is refused loudly");
});

test("demo mode signs nothing and keeps the roster empty", async () => {
  const demo = await loadBoardApi({ location: { search: "?demo" }, TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto });
  assert.equal(demo.signingAvailable(), false, "demo never signs");
  assert.equal(await demo.ensureSigningIdentity(), null);
  demo.updateSettings({ username: "demo-user" });
  assert.equal(Object.keys(demo.state.devices || {}).length, 0, "demo saves never touch the roster");
  const demoEntry = demo.state.history[demo.state.history.length - 1];
  assert.equal(demoEntry?.deviceId, undefined, "demo history entries carry no device id");
});

test("hold-select accumulates without duplicates and sweep fills the visible range", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  const [first, second, third] = today.tasks;

  api.selectNode({ kind: "task", id: first.id });
  api.addNodeToSelection({ kind: "task", id: third.id });
  api.addNodeToSelection({ kind: "task", id: third.id });
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [
    { kind: "task", id: first.id },
    { kind: "task", id: third.id },
  ], "a second hold adds once; holding the same row twice never duplicates");

  // a sweep from an anchor fills the whole range, including rows a fast finger skipped
  api.applySweepSelection([], { kind: "task", id: first.id }, { kind: "task", id: third.id });
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [
    { kind: "task", id: first.id },
    { kind: "task", id: second.id },
    { kind: "task", id: third.id },
  ], "a fast sweep takes the rows elementFromPoint skipped");

  // dragging back toward the anchor drops the rows the sweep grabbed
  api.applySweepSelection([], { kind: "task", id: first.id }, { kind: "task", id: first.id });
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [
    { kind: "task", id: first.id },
  ], "reversing the sweep back to the anchor deselects the rows it grabbed");

  // earlier holds (the base) persist even when this sweep shrinks to its anchor
  api.applySweepSelection([{ kind: "task", id: third.id }], { kind: "task", id: first.id }, { kind: "task", id: first.id });
  assert.deepEqual(JSON.parse(JSON.stringify(api.getSelectedNodes())), [
    { kind: "task", id: third.id },
    { kind: "task", id: first.id },
  ], "a prior hold stays selected when a reversed sweep shrinks past it");
});

test("ctrl+shift+v pastes a real unlinked copy", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  const source = today.tasks[0];
  const target = today.tasks[2];

  api.pasteTaskIds([source.id], { kind: "task", id: target.id }, "duplicate");
  const copies = today.tasks.filter((task) => task.text === source.text);
  assert.equal(copies.length, 2, "duplicate paste creates a second, independent task");
  const copy = copies.find((task) => task.id !== source.id);
  assert.equal(Boolean(copy.linkType), false, "the duplicate is not a linked placement");

  api.pasteTaskIds([source.id], { kind: "task", id: target.id }, "alias");
  const linked = today.tasks.find((task) => task.linkType === "alias");
  assert.ok(linked, "alias mode still links (the default is untouched)");

  const html = await readBoard();
  for (const hook of ["pasteLinkOverride = \"duplicate\"", "if (pasteLinkOverride) return pasteLinkOverride"]) {
    assert.match(html, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the ctrl+shift+v one-shot glue survives the build");
  }
});

test("typed text persists through the debounced save; flush loses nothing", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  const task = today.tasks[0];
  api.updateTaskTextFromEditable(task.id, "typed at full speed");
  api.flushPendingSave();
  const persisted = api.loadStateFromLocalStorage();
  const saved = persisted.groups.find((group) => group.title === "Today").tasks.find((t) => t.id === task.id);
  assert.equal(saved.text, "typed at full speed", "flush writes the latest keystroke state");
});

test("boards past the 1 MB contents cap pull through the blobs API", async () => {
  const calls = [];
  const payload = {
    version: 2,
    syncedAt: "2026-07-19T02:00:00.000Z",
    state: { groups: [{ id: "g-blob", title: "From the blob", tasks: [], collapsed: false }], history: [], trash: [] },
  };
  const base64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const fetchMock = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/git/blobs/")) {
      return { ok: true, status: 200, json: async () => ({ content: base64, encoding: "base64" }) };
    }
    return { ok: true, status: 200, json: async () => ({ sha: "bigsha", size: 2000000, content: "" }) };
  };
  const api = await loadBoardApi({ fetch: fetchMock, TextEncoder, TextDecoder, btoa, atob });
  api.saveSyncConfig({ enabled: true, repo: "evrenucar/punchlist-sync", token: "t", lastSha: "old", dirty: false });
  await api.syncNow("test");
  assert.equal(calls.some((u) => u.includes("/git/blobs/bigsha")), true, "an empty-content oversized read falls back to the blob endpoint");
  assert.equal(api.state.groups.some((g) => g.title === "From the blob"), true, "the oversized board pulled and applied instead of erroring");
});

test("scoped render keeps behavior identical and falls back safely", async () => {
  const api = await loadBoardApi();
  const today = api.state.groups.find((group) => group.title === "Today");
  const first = today.tasks[0];
  const second = today.tasks[1];

  api.selectNode({ kind: "task", id: second.id });
  api.indentTask(second.id);
  assert.equal(first.children.some((child) => child.id === second.id), true, "indent still mutates state through the scoped path");
  api.outdentTask(second.id);
  assert.equal(today.tasks.some((task) => task.id === second.id), true, "outdent restores through the scoped path");

  api.renderGroupInPlace(today.id);
  api.renderGroupInPlace("group-that-does-not-exist");

  const linked = api.pasteTaskIds([first.id], { kind: "task", id: second.id }, "alias");
  assert.equal(api.taskIsLinkFree(first), false, "an aliased original is never link-free");
  assert.equal(api.taskIsLinkFree(second), true, "an untouched task is link-free");
});

// Boots the board with a [data-board] element that records its event
// listeners, so tests can dispatch synthetic pointer sequences through the
// real gesture handlers. Timers are manual: flushTimers() fires pending holds.
async function loadGestureHarness() {
  const listeners = new Map();
  const setClassList = () => {
    const classes = new Set();
    return {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    };
  };
  const stubEl = () => ({
    innerHTML: "",
    textContent: "",
    value: "",
    dataset: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
    contains() {
      return false;
    },
    focus() {},
    scrollIntoView() {},
  });
  const boardEl = stubEl();
  boardEl.classList = setClassList();
  boardEl.addEventListener = (type, fn) => {
    const list = listeners.get(type) || [];
    list.push(fn);
    listeners.set(type, list);
  };
  const elements = new Map([
    ["[data-board]", boardEl],
    ["[data-section-nav]", stubEl()],
    ["[data-total-count]", stubEl()],
    ["[data-done-count]", stubEl()],
    ["[data-search]", stubEl({ value: "" })],
  ]);
  const timers = [];
  const flushTimers = () => {
    for (const timer of [...timers]) {
      if (!timer.cleared && !timer.fired) {
        timer.fired = true;
        timer.fn();
      }
    }
  };
  const scrollByCalls = [];
  const scroller = {
    scrollTop: 500,
    scrollHeight: 5000,
    clientHeight: 700,
    scrollBy({ top }) {
      scrollByCalls.push(top);
      this.scrollTop = Math.max(0, this.scrollTop + top);
    },
  };
  const api = await loadBoardApi({
    navigator: {},
    document: {
      activeElement: null,
      scrollingElement: scroller,
      querySelector(selector) {
        return elements.get(selector) || null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener() {},
      createRange() {
        return { collapse() {}, deleteContents() {}, insertNode() {}, selectNodeContents() {}, setStartAfter() {} };
      },
    },
    window: {
      innerHeight: 800,
      getSelection() {
        return { rangeCount: 0, addRange() {}, getRangeAt() { return null; }, removeAllRanges() {} };
      },
      setTimeout(fn) {
        timers.push({ fn, cleared: false, fired: false });
        return timers.length;
      },
      clearTimeout(id) {
        if (timers[id - 1]) timers[id - 1].cleared = true;
      },
    },
  });

  const taskId = api.state.groups[0].tasks[0].id;
  const row = {
    dataset: { taskRow: taskId, nodeKind: "task", nodeId: taskId, dragKind: "task" },
    classList: { add() {}, remove() {}, contains() { return false; } },
    style: {},
    setPointerCapture() {},
    matches() {
      return false;
    },
  };
  row.closest = (selector) =>
    selector.includes("data-task-row") || selector.includes("data-node-kind") || selector.includes("data-drag-kind") ? row : null;

  const fire = (type, event) => {
    for (const handler of listeners.get(type) || []) handler(event);
  };
  const touchEvent = (pointerId) => ({
    pointerType: "touch",
    pointerId,
    isPrimary: true,
    clientX: 0,
    clientY: 0,
    target: row,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  });
  const probe = () => {
    const menu = { target: row, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    fire("contextmenu", menu);
    const move = { cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    fire("touchmove", move);
    return { candidate: menu.defaultPrevented, armed: move.defaultPrevented };
  };

  const runLatestTimer = () => {
    const pending = timers.filter((timer) => !timer.cleared && !timer.fired);
    const latest = pending[pending.length - 1];
    if (!latest) return false;
    latest.fired = true;
    latest.fn();
    return true;
  };

  return { api, boardEl, row, fire, touchEvent, probe, flushTimers, timers, runLatestTimer, scroller, scrollByCalls };
}

test("a new primary touch press clears stale gesture candidates (dead-toggles guard)", async () => {
  // A render that replaces the pressed row mid-press swallows its pointerup
  // (implicit touch capture dies with the node). The 1.5s hold timer then
  // arms with no finger down, and because finishTouchSelect requires a
  // matching pointerId, the ghost either ate the next tap's click (iOS
  // reuses pointerIds) or every scroll forever. Invariant under test: any
  // new primary touch press resets all gesture candidates.
  const { boardEl, fire, touchEvent, probe, flushTimers } = await loadGestureHarness();

  // ghost press: the pointerup for id 41 never arrives, both hold timers fire
  fire("pointerdown", touchEvent(41));
  flushTimers();
  const ghost = probe();
  assert.equal(ghost.candidate, true, "the ghost candidate exists after the lost pointerup");
  assert.equal(ghost.armed, true, "the ghost armed with no finger down");

  // a fresh press must sweep the ghost; its own tap then finishes cleanly
  fire("pointerdown", touchEvent(53));
  fire("pointerup", touchEvent(53));
  const after = probe();
  assert.equal(after.candidate, false, "no gesture candidate survives a new press-and-release");
  assert.equal(after.armed, false, "no armed ghost eats touchmoves after a new press-and-release");
  assert.equal(boardEl.classList.contains("is-touch-selecting"), false, "the select mode class is gone");

  // the sweep must not kill the new press's own candidates
  fire("pointerdown", touchEvent(60));
  assert.equal(probe().candidate, true, "a live press still owns its candidates");
  fire("pointerup", touchEvent(60));
  assert.equal(probe().candidate, false, "release cleans up the live press");
});

test("touch presses suppress the native HTML5 drag; the mouse keeps it", async () => {
  // iOS long-press on a draggable row starts the OS drag (a text-snapshot
  // ghost, no drop indicators) and steals the stream from the pointer-based
  // long-press drag. Native dragstart must die for touch and survive for mouse.
  const { row, fire, touchEvent } = await loadGestureHarness();

  fire("pointerdown", touchEvent(80));
  const touchStart = { target: row, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, dataTransfer: { setData() {} } };
  fire("dragstart", touchStart);
  assert.equal(touchStart.defaultPrevented, true, "a dragstart born from a touch press is suppressed");
  fire("pointerup", touchEvent(80));

  const mouseDown = { ...touchEvent(1), pointerType: "mouse" };
  fire("pointerdown", mouseDown);
  const mouseStart = { target: row, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, dataTransfer: { setData() {} } };
  fire("dragstart", mouseStart);
  assert.equal(mouseStart.defaultPrevented, false, "a mouse drag still takes the native HTML5 path");
});

test("images offload to asset references and exports re-embed them losslessly", async () => {
  const api = await loadBoardApi();
  const task = api.state.groups[0].tasks[0];
  const pixel = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
  task.images = [{ id: "img-em1", src: pixel, width: 200, caption: "kept" }];

  const moved = api.offloadEmbeddedImages();
  assert.equal(moved, 1, "the embedded image moved to the asset store");
  const record = task.images[0];
  assert.equal(record.src, undefined, "board state sheds the bytes");
  assert.equal(typeof record.assetId, "string", "the reference stays");
  assert.equal(api.getAssetSrc(record), pixel, "the cache resolves the reference");
  assert.equal(api.assetIdsReferenced().has(record.assetId), true, "the asset counts as referenced");

  const exported = api.getExportState();
  const exportedImage = exported.groups[0].tasks[0].images[0];
  assert.equal(exportedImage.src, pixel, "exports re-embed the bytes (lossless, old builds can read them)");
  assert.equal(exportedImage.assetId, undefined, "exports drop the internal reference");
  assert.equal(task.images[0].src, undefined, "the live board keeps the slim reference");

  const payload = JSON.parse(api.getSyncPayload());
  assert.equal(payload.state.groups[0].tasks[0].images[0].src, undefined, "sync payloads stay slim");
});

test("sync uploads asset files before the board and never re-uploads", async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    if ((options.method || "GET") === "PUT") {
      return { ok: true, status: 200, json: async () => ({ content: { sha: "sha-after-put" } }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const api = await loadBoardApi({ fetch: fetchMock, TextEncoder, TextDecoder, btoa, atob });
  const task = api.state.groups[0].tasks[0];
  const pixel = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
  task.images = [{ id: "img-up1", src: pixel, width: 200, caption: "" }];
  api.offloadEmbeddedImages();
  const assetId = task.images[0].assetId;

  api.saveSyncConfig({ enabled: true, repo: "evrenucar/punchlist-sync", token: "t", dirty: true });
  await api.syncNow("test");

  const assetPut = calls.findIndex((call) => call.method === "PUT" && call.url.includes(`/contents/assets/${assetId}.webp`));
  const boardPut = calls.findIndex((call) => call.method === "PUT" && call.url.includes("/contents/punchlist-board.json"));
  assert.ok(assetPut >= 0, "the asset file uploads");
  assert.ok(boardPut >= 0, "the board uploads");
  assert.ok(assetPut < boardPut, "the asset lands before the board that references it");

  calls.length = 0;
  api.saveSyncConfig({ dirty: true, lastSha: null });
  await api.syncNow("test");
  assert.equal(calls.some((call) => call.url.includes("/contents/assets/")), false, "an uploaded asset never uploads twice");
});

test("a pulled board fetches the assets this device is missing", async () => {
  const pixel = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
  const remoteState = {
    version: 2,
    syncedAt: "2026-07-19T12:00:00.000Z",
    state: {
      groups: [{ id: "g-a", title: "From remote", collapsed: false, tasks: [
        { id: "t-a", text: "has a picture", images: [{ id: "img-a", assetId: "asset-remote1", width: 200, caption: "" }], children: [] },
      ] }],
      history: [],
      trash: [],
    },
  };
  const boardBase64 = Buffer.from(JSON.stringify(remoteState), "utf8").toString("base64");
  const fetchMock = async (url) => {
    const href = String(url);
    if (href.includes("/contents/punchlist-board.json")) {
      return { ok: true, status: 200, json: async () => ({ sha: "remote-sha", size: 500, content: boardBase64 }) };
    }
    if (href.includes("/contents/assets?") || href.endsWith("/contents/assets")) {
      return { ok: true, status: 200, json: async () => ([{ name: "asset-remote1.webp", sha: "blob-1", size: 64 }]) };
    }
    if (href.includes("/contents/assets/asset-remote1.webp")) {
      return { ok: true, status: 200, json: async () => ({ content: pixel }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const api = await loadBoardApi({ fetch: fetchMock, TextEncoder, TextDecoder, btoa, atob });
  api.saveSyncConfig({ enabled: true, repo: "evrenucar/punchlist-sync", token: "t", lastSha: "old", dirty: false });
  await api.syncNow("test");

  assert.equal(api.state.groups.some((group) => group.title === "From remote"), true, "the board pulled");
  const image = api.state.groups.find((group) => group.title === "From remote").tasks[0].images[0];
  assert.equal(image.assetId, "asset-remote1", "the reference survived normalization");
  assert.equal(api.getAssetSrc(image), `data:image/webp;base64,${pixel}`, "the missing asset arrived with the right mime");
});

test("drag auto-scroll steps evenly and never shoves past the top", async () => {
  // The old loop Math.ceil'd a linear ramp into integer px/frame and kept
  // calling scrollBy against the scroller's top edge, which reads as jag on
  // iOS rubber-banding — Evren's "a bit jagged, especially towards the top".
  const { fire, touchEvent, timers, runLatestTimer, scroller, scrollByCalls } = await loadGestureHarness();

  fire("pointerdown", touchEvent(70));
  timers[0].fired = true;
  timers[0].fn(); // the 420ms hold arms the drag; the 1.5s select timer stays pending

  // finger deep in the top band (clientY 10 of a 96px edge zone)
  fire("pointermove", { ...touchEvent(70), clientX: 40, clientY: 10 });
  assert.equal(runLatestTimer(), true, "a scroll frame is scheduled");
  runLatestTimer();
  runLatestTimer();
  assert.ok(scrollByCalls.length >= 3, "frames keep scrolling while the finger holds the edge");
  assert.ok(scrollByCalls.every((step) => step < 0), "top-edge scrolling moves up");
  const magnitudes = scrollByCalls.map((step) => Math.abs(step));
  const spread = Math.max(...magnitudes) - Math.min(...magnitudes);
  assert.ok(spread <= 1, `steps stay even (carry smoothing), got ${scrollByCalls.join(", ")}`);

  // at the very top the loop must stop scrolling instead of fighting the edge
  scroller.scrollTop = 0;
  const callsBefore = scrollByCalls.length;
  runLatestTimer();
  assert.equal(scrollByCalls.length, callsBefore, "no scrollBy against the top edge");

  // back to mid-viewport: velocity zeroes and the loop shuts down
  fire("pointermove", { ...touchEvent(70), clientX: 40, clientY: 400 });
  const scheduled = timers.filter((timer) => !timer.cleared && !timer.fired).length;
  fire("pointerup", touchEvent(70));
  assert.equal(timers.filter((timer) => !timer.cleared && !timer.fired).length <= scheduled, true, "no frame leak after release");
});
