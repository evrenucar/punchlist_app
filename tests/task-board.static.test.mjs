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
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
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

test("task board file contains the seeded task groups and nested tasks", async () => {
  const html = await readBoard();

  for (const text of [
    "Priorities",
    "Kora",
    "Scaled Autonomy",
    "Today",
    "Work and reply",
    "Later / Trolling motor",
    "At oma / Scaled Autonomy focus",
    "Visa stuff",
    "Jetson Orin Nano Super 8GB",
    "Buy 3 patch antennas",
    "Make the bus servo rotate",
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
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

  assert.ok(scripts.length > 0, "expected at least one inline script");
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script));
  }
});

test("top-level categories have distinct color accents", async () => {
  const html = await readBoard();

  assert.match(html, /--group-color/);
  assert.match(html, /group-priorities[\s\S]*color/);
  assert.match(html, /group-kora[\s\S]*color/);
  assert.match(html, /group-scaled-autonomy[\s\S]*color/);
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
    "moveSelectedNodes(-1)",
    "moveSelectedNodes(1)",
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
  const kora = api.state.groups.find((group) => group.id === "group-kora");
  const koraDecision = kora.tasks.find((task) => task.text === "Kora CAD final decisions");
  api.selectNode({ kind: "task", id: koraDecision.id });
  api.toggleSelectedNodes(true);
  assert.equal(koraDecision.collapsed, true);

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
  const sidequests = api.state.groups.find((group) => group.id === "group-sidequests");
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
  assert.equal(exported.version, 1);
  assert.ok(Array.isArray(exported.state.groups));
  assert.equal(exported.state.groups.some((group) => group.title === "Kora"), true);

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
  const kora = api.state.groups.find((group) => group.title === "Kora");
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

test("focus mode advertises Shift F and left controls have hover explanations", async () => {
  const html = await readBoard();

  for (const hook of [
    "Shift+F",
    "title=\"Create a new top-level group\"",
    "title=\"Expand every group and task\"",
    "title=\"Collapse every group and task\"",
    "title=\"Open focus mode for the selected task (Shift+F)\"",
    "title=\"Download this board as a JSON backup\"",
    "title=\"Load a board from a JSON backup\"",
    "title=\"Restore the original seeded board\"",
    "title=\"Jump to",
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
  const kora = api.state.groups.find((group) => group.title === "Kora");
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
  const exportedKora = exported.state.groups.find((group) => group.title === "Kora");
  assert.equal(exportedKora.tasks[0].focusSeconds, 125);
});
