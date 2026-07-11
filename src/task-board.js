    const STORAGE_KEY = "scheduling-task-management-board-v1";
    const THEME_STORAGE_KEY = "scheduling-task-management-theme-v1";
    const SCHEMA_VERSION = 2;
    const RESEARCH_TASK_TEXT = "Research task management apps and planning pain points";
    const DEFAULT_SETTINGS = Object.freeze({
      dailyPlanning: false,
      timelineView: false,
      reminders: false,
      browserNotifications: false,
      focusTiming: true,
      metadata: false,
      policyOverrides: false,
      pasteMode: "alias",
      completionRetentionSeconds: 7 * 24 * 60 * 60,
      deleteMode: "trash",
      trashRetentionSeconds: null,
      exportCompleted: true,
      exportTrash: false,
      sidebarCollapsed: false,
    });
    const AUTO_SCROLL_EDGE_PX = 96;
    const MAX_AUTO_SCROLL_SPEED = 18;
    const LONG_PRESS_MS = 420;
    const LONG_PRESS_MOVE_PX = 12;
    const GROUP_PALETTES = [
      { color: "#d9480f", bg: "#fff4ec", selected: "#ffe0cc", border: "#ffc2a3", ink: "#6d2b09" },
      { color: "#2f6f4e", bg: "#eef8f2", selected: "#d9f0e2", border: "#aed8bf", ink: "#1f5137" },
      { color: "#5f3dc4", bg: "#f3efff", selected: "#e4dbff", border: "#c8b8ff", ink: "#3d2791" },
      { color: "#0b7285", bg: "#ebf8fb", selected: "#d3f1f6", border: "#a6dbe4", ink: "#064b58" },
      { color: "#9c36b5", bg: "#fbf0ff", selected: "#f3d9fa", border: "#e0b1ec", ink: "#702682" },
      { color: "#1971c2", bg: "#edf6ff", selected: "#d7ebff", border: "#afd6ff", ink: "#11558f" },
      { color: "#c92a2a", bg: "#fff1f1", selected: "#ffd8d8", border: "#ffa8a8", ink: "#8f1f1f" },
      { color: "#2b8a3e", bg: "#effaf1", selected: "#d8f5dc", border: "#b2e8ba", ink: "#1f6b2f" },
      { color: "#e67700", bg: "#fff8e8", selected: "#ffecbf", border: "#ffd98a", ink: "#8a4b00" },
    ];
    const GROUP_COLORS = {
      "group-doing-now": { color: "#ef4444", bg: "#fff1f1", selected: "#ffd8d8", border: "#ffa8a8", ink: "#8f1f1f" },
      "group-priorities": GROUP_PALETTES[0],
      "group-today": GROUP_PALETTES[1],
      "group-kora": GROUP_PALETTES[2],
      "group-scaled-autonomy": GROUP_PALETTES[3],
      "group-work-replies": GROUP_PALETTES[4],
      "group-home-admin": GROUP_PALETTES[5],
      "group-trolling-motor": GROUP_PALETTES[6],
      "group-general-later": GROUP_PALETTES[7],
      "group-sidequests": GROUP_PALETTES[8],
    };
    const boardEl = document.querySelector("[data-board]");
    const navEl = document.querySelector("[data-section-nav]");
    const totalCountEl = document.querySelector("[data-total-count]");
    const doneCountEl = document.querySelector("[data-done-count]");
    const searchEl = document.querySelector("[data-search]");
    const exportBoardEl = document.querySelector("[data-export-board]");
    const importBoardEl = document.querySelector("[data-import-board]");
    const importFileEl = document.querySelector("[data-import-file]");
    const clockEl = document.querySelector("[data-clock]");
    const darkModeEl = document.querySelector("[data-dark-mode]");
    const focusModeEl = document.querySelector("[data-focus-mode]");
    const focusButtonEl = document.querySelector("[data-focus-button]");
    const focusExitEl = document.querySelector("[data-focus-exit]");
    const focusTaskEl = document.querySelector("[data-focus-task]");
    const focusTimerEl = document.querySelector("[data-focus-timer]");
    let selectedNode = null;
    let multiSelectedNodes = [];
    let selectionAnchorNode = null;
    let draggedNode = null;
    let focusModeTaskId = null;
    let focusModeStartedAt = null;
    let focusModeTimerFrame = null;
    let autoScrollFrame = null;
    let autoScrollVelocity = 0;
    let touchDrag = null;
    let undoStack = [];
    let undoActions = [];
    let lastUndoAction = null;
    let suppressFocusSelection = false;
    let state = loadState();

    function createId(prefix = "task") {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }

    function task(text, children = [], options = {}) {
      const createdAt = options.createdAt || new Date().toISOString();
      const done = Boolean(options.done);
      return {
        id: options.id || createId("task"),
        text,
        done,
        completedAt: options.completedAt || (done ? createdAt : null),
        collapsed: Boolean(options.collapsed),
        focusSeconds: Math.max(0, Math.floor(Number(options.focusSeconds) || 0)),
        plannedMinutes: Number(options.plannedMinutes) > 0 ? Number(options.plannedMinutes) : null,
        schedule: options.schedule || null,
        reminderAt: options.reminderAt || null,
        createdAt,
        createdInGroupId: options.createdInGroupId || null,
        createdUnderTaskId: options.createdUnderTaskId || null,
        children,
      };
    }

    function seedState() {
      return {
        version: SCHEMA_VERSION,
        settings: { ...DEFAULT_SETTINGS },
        trash: [],
        groups: [
          {
            id: "group-priorities",
            title: "Priorities",
            collapsed: false,
            tasks: [
              task("Askerlik"),
              task("Visa check"),
              task("Blue letters"),
            ],
          },
          {
            id: "group-today",
            title: "Today",
            collapsed: false,
            tasks: [
              task("Work on prosthetics things"),
              task("Send the updated flow5 file"),
              task("Work on your own website and make it presentable"),
              task("Work on cosmoboard and clean it out"),
              task("Buy", [
                task("Get an AirTag for your Strida and the cargo bike"),
              ]),
            ],
          },
          {
            id: "group-kora",
            title: "Kora",
            collapsed: false,
            tasks: [
              task("Kora CAD"),
              task("Kora CAD final decisions", [
                task("Placement and arrangement of sercos"),
              ]),
              task("Kora offset information for ArduPilot", [
                task("Distance of IMU island from the tip xyz"),
              ]),
              task("Look at Yigit STEP file"),
              task("Kora parts order"),
              task("Kora CAD finalize todo list"),
              task("Make Kora clean todo list"),
              task("Kora General todo"),
              task("Back lid and org"),
              task("CG distribution list again"),
              task("Jetson Orin Nano (ask Yigit if)", [
                task("Jetson Orin Nano Super 8GB (bunu al)"),
                task("SSD"),
                task("Wifi adaptor: WLE900VX https://www.codico.com/en/wle900vx"),
                task("Wifi antenna", [
                  task("Buy 3 patch antennas"),
                ]),
                task("GP904: https://www.amazon.com/s?k=HEIGPAN+GP904&crid=1M3RTB8ZI2290&sprefix=heigpan+gp904%2Caps%2C184&ref=nb_sb_noss"),
              ]),
              task("Buy beacon"),
              task("Get water bottles"),
              task("ESC"),
              task("Camera"),
              task("Make video storyboard"),
              task("Make plan for it"),
              task("Work on Kora things"),
              task("Buy elastic bands"),
              task("Buy other parts"),
              task("New aero PLA"),
              task("KORA CAD"),
            ],
          },
          {
            id: "group-scaled-autonomy",
            title: "Scaled Autonomy",
            collapsed: false,
            tasks: [
              task("Scaled autonomy notes collect together"),
              task("Make scaled autonomy todo list"),
              task("Scaled autonomy design update"),
              task("Make scaled autonomy plan"),
              task("Update the hardware design chat", [], { done: true }),
              task("Update the print bed files", [
                task("Maybe also top cap PETG units with the camera guard cap"),
              ], { done: true }),
              task("Scaled autonomy event planning + CAD model"),
              task("Scaled autonomy get the front module working (HOME)", [
                task("Even if with dumb servo"),
                task("Make the bus servo rotate"),
              ]),
              task("At oma / Scaled Autonomy focus", [
                task("Make sure the PCB model is correct"),
                task("Make the extra piece for the camera to be seated well"),
                task("Test thermal camera with Raspberry Pi"),
                task("Model the 7 inch / thin 8 inch frame"),
                task("Start print from PETG"),
              ]),
            ],
          },
          {
            id: "group-work-replies",
            title: "Work and reply",
            collapsed: false,
            tasks: [
              task("Can files update"),
              task("Aram files update"),
              task("Burak contact"),
              task("Merve contact"),
              task("Cansu contact"),
              task("Tuna contact"),
              task("Reaction molding machine"),
              task("Test thermal camera"),
              task("17:00 go test"),
              task("Locker empty out", [
                task("Figure out how to get back the contents"),
              ]),
              task("Log changes to be made"),
            ],
          },
          {
            id: "group-home-admin",
            title: "Home and admin",
            collapsed: false,
            tasks: [
              task("Home account billing things", [
                task("Send messages"),
                task("Send money into account so billing can be made"),
              ]),
              task("Amazon payment update evrenucr@gmail.com (Amazon)"),
              task("Kora CAD update"),
              task("Backup Fusion data"),
              task("Cut contact with TU email"),
              task("Braindump", [
                task("Wash clothes"),
                task("Wash sheets"),
              ]),
              task("Visa stuff", [], { done: true }),
              task("Setup iPhone"),
              task("Tax and business strategy ChatGPT chatting"),
            ],
          },
          {
            id: "group-trolling-motor",
            title: "Later / Trolling motor",
            collapsed: false,
            tasks: [
              task("Trolling motor update", [
                task("Teoman things"),
              ]),
              task("Work on trolling motor parts"),
              task("Trolling motor print start"),
              task("3D print trolling motor part"),
              task("Troll motor landing page create and share"),
              task("Teoman work on branding"),
            ],
          },
          {
            id: "group-general-later",
            title: "General and later",
            collapsed: false,
            tasks: [
              task("Make a Miro page for the story you're writing"),
              task("Make plan on selling items"),
              task("Oma electricals complete"),
              task("Order boxes"),
              task("Room org"),
              task("Plan week"),
              task(RESEARCH_TASK_TEXT, [
                task("Compare Obsidian, ClickUp, Todoist, Things, and Notion workflows"),
                task("Review recurring complaints and praise in public Reddit discussions"),
                task("Summarize capture, scheduling, mobile, configuration, portability, and sync pain points"),
              ]),
            ],
          },
          {
            id: "group-sidequests",
            title: "Sidequests",
            collapsed: false,
            tasks: [
              task("Look at Mateus things (car thing mount)"),
              task("Look at Yigit CAD"),
              task("Look at Aktunc tekstil things (cat mats)"),
            ],
          },
        ],
      };
    }

    function loadStateFromLocalStorage() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return migrateState(seedState());
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed.groups)) return migrateState(seedState());
        return migrateState(parsed);
      } catch {
        return migrateState(seedState());
      }
    }

    function saveStateToLocalStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function loadState() {
      return loadStateFromLocalStorage();
    }

    function saveState() {
      saveStateToLocalStorage();
    }

    function loadTheme() {
      return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
    }

    function applyTheme(theme = loadTheme()) {
      const normalized = theme === "dark" ? "dark" : "light";
      document.body?.setAttribute("data-theme", normalized);
      if (darkModeEl) darkModeEl.checked = normalized === "dark";
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
      return normalized;
    }

    function toggleDarkMode(enabled = !darkModeEl?.checked) {
      return applyTheme(enabled ? "dark" : "light") === "dark";
    }

    const CLOCK_FORMAT_OPTIONS = { hour: "2-digit", minute: "2-digit", hour12: false };

    function formatClockTime(date = new Date()) {
      return date.toLocaleTimeString([], CLOCK_FORMAT_OPTIONS);
    }

    function updateClock(date = new Date()) {
      if (!clockEl) return "";
      const value = formatClockTime(date);
      clockEl.textContent = value;
      return value;
    }

    function getBoardExportPayload() {
      return {
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        state,
      };
    }

    function serializeBoardState() {
      return JSON.stringify(getBoardExportPayload(), null, 2);
    }

    function importBoardStateFromJson(jsonText) {
      const payload = JSON.parse(jsonText);
      const importedState = payload?.state || payload;
      if (!importedState || !Array.isArray(importedState.groups)) {
        throw new Error("Imported file must contain a state.groups array.");
      }
      if (focusModeTaskId) exitFocusMode();
      pushUndoState();
      state = migrateState(importedState, new Date().toISOString(), { includeResearch: false });
      selectedNode = getVisibleNodes()[0] || null;
      multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
      selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      saveState();
      render();
      return true;
    }

    function downloadBoardState() {
      const blob = new Blob([serializeBoardState()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `task-board-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function handleImportFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          importBoardStateFromJson(String(reader.result || ""));
        } catch (error) {
          window.alert(error.message);
        }
      });
      reader.readAsText(file);
    }

    function pushUndoState(action = "board") {
      undoStack.push(JSON.stringify(state));
      undoActions.push(action);
      if (undoStack.length > 40) {
        undoStack.shift();
        undoActions.shift();
      }
      lastUndoAction = undoActions[undoActions.length - 1] || null;
    }

    function discardUndoState() {
      undoStack.pop();
      undoActions.pop();
      lastUndoAction = undoActions[undoActions.length - 1] || null;
    }

    function restoreUndoState() {
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      undoActions.pop();
      lastUndoAction = undoActions[undoActions.length - 1] || null;
      state = normalizeState(JSON.parse(snapshot));
      const visible = getVisibleNodes();
      selectedNode = visible[0] || null;
      multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
      selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      saveState();
      render();
    }

    function shouldUseBoardUndo(isEditingText = false) {
      return undoStack.length > 0 && (!isEditingText || lastUndoAction === "delete");
    }

    function countTasks(tasks) {
      return tasks.reduce((total, item) => total + 1 + countTasks(item.children || []), 0);
    }

    function countDone(tasks) {
      return tasks.reduce((total, item) => total + (item.done ? 1 : 0) + countDone(item.children || []), 0);
    }

    function findTask(id, tasks = null, parent = null, group = null) {
      if (!tasks) {
        for (const currentGroup of state.groups) {
          const found = findTask(id, currentGroup.tasks, parent, currentGroup);
          if (found) return found;
        }
        return null;
      }
      const list = tasks;
      for (let index = 0; index < list.length; index += 1) {
        const item = list[index];
        if (item.id === id) return { item, parent, group, list, index };
        const child = findTask(id, item.children || [], item, group);
        if (child) return child;
      }
      return null;
    }

    function findGroup(id) {
      return state.groups.find((group) => group.id === id);
    }

    function ensureDoingNowGroup() {
      let group = state.groups.find((item) => item.title.toLowerCase() === "doing now");
      if (group) return group;

      group = {
        id: "group-doing-now",
        title: "Doing now",
        collapsed: false,
        color: "#ef4444",
        tasks: [],
      };
      state.groups.unshift(group);
      return group;
    }

    function cloneTaskTree(item) {
      return {
        id: createId("task"),
        text: item.text,
        done: Boolean(item.done),
        collapsed: Boolean(item.collapsed),
        focusSeconds: Math.max(0, Math.floor(Number(item.focusSeconds) || 0)),
        children: (item.children || []).map(cloneTaskTree),
      };
    }

    function removeTask(id) {
      const found = findTask(id);
      if (!found) return null;
      const [removed] = found.list.splice(found.index, 1);
      return removed;
    }

    function isDescendant(source, targetId) {
      return (source.children || []).some((child) => child.id === targetId || isDescendant(child, targetId));
    }

    function insertTask(moved, targetId, position) {
      if (targetId.startsWith("group-")) {
        const group = findGroup(targetId);
        if (!group) return false;
        group.tasks.push(moved);
        return true;
      }

      const target = findTask(targetId);
      if (!target) return false;
      if (position === "child") {
        target.item.children = target.item.children || [];
        target.item.children.push(moved);
        target.item.collapsed = false;
        return true;
      }

      const offset = position === "after" ? 1 : 0;
      target.list.splice(target.index + offset, 0, moved);
      return true;
    }

    function copyTaskToDoingNow(taskId) {
      const found = findTask(taskId);
      if (!found) return null;
      pushUndoState();
      const group = ensureDoingNowGroup();
      const copy = cloneTaskTree(found.item);
      group.collapsed = false;
      group.tasks.push(copy);
      setSingleSelection({ kind: "task", id: copy.id });
      saveState();
      render();
      return copy;
    }

    function moveTask(sourceId, targetId, position) {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const source = findTask(sourceId);
      if (!source || isDescendant(source.item, targetId)) return;
      pushUndoState();
      const moved = removeTask(sourceId);
      if (!moved) {
        discardUndoState();
        return;
      }
      if (!insertTask(moved, targetId, position)) {
        source.list.splice(source.index, 0, moved);
        discardUndoState();
        return;
      }
      selectedNode = { kind: "task", id: moved.id };
      multiSelectedNodes = [{ ...selectedNode }];
      selectionAnchorNode = { ...selectedNode };
      saveState();
      render();
    }

    function moveGroup(sourceId, targetId, position) {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const sourceIndex = state.groups.findIndex((group) => group.id === sourceId);
      if (sourceIndex < 0) return;
      pushUndoState();
      const [group] = state.groups.splice(sourceIndex, 1);
      const targetIndex = state.groups.findIndex((item) => item.id === targetId);
      if (targetIndex < 0) {
        state.groups.splice(sourceIndex, 0, group);
        discardUndoState();
        return;
      }
      const insertIndex = targetIndex + (position === "after" ? 1 : 0);
      state.groups.splice(insertIndex, 0, group);
      selectedNode = { kind: "group", id: group.id };
      multiSelectedNodes = [{ ...selectedNode }];
      selectionAnchorNode = { ...selectedNode };
      saveState();
      render();
    }

    function deleteTask(id) {
      deleteTaskAndSelectNeighbor(id);
    }

    function getNeighborAfterDelete(node, visibleBeforeDelete = getVisibleNodes(), deletedKeys = new Set([nodeKey(node)])) {
      if (!node) return null;
      const index = visibleBeforeDelete.findIndex((item) => sameNode(item, node));
      if (index < 0) return null;

      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const candidate = visibleBeforeDelete[cursor];
        if (candidate.kind === "task" && !deletedKeys.has(nodeKey(candidate))) return candidate;
      }

      for (let cursor = index + 1; cursor < visibleBeforeDelete.length; cursor += 1) {
        const candidate = visibleBeforeDelete[cursor];
        if (candidate.kind === "task" && !deletedKeys.has(nodeKey(candidate))) return candidate;
      }

      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const candidate = visibleBeforeDelete[cursor];
        if (!deletedKeys.has(nodeKey(candidate))) return candidate;
      }

      for (let cursor = index + 1; cursor < visibleBeforeDelete.length; cursor += 1) {
        const candidate = visibleBeforeDelete[cursor];
        if (!deletedKeys.has(nodeKey(candidate))) return candidate;
      }

      return null;
    }

    function collectDeletedTaskKeys(item, deletedKeys) {
      deletedKeys.add(nodeKey({ kind: "task", id: item.id }));
      (item.children || []).forEach((child) => collectDeletedTaskKeys(child, deletedKeys));
    }

    function collectDeletedNodeKeys(nodes) {
      const deletedKeys = new Set();
      nodes.forEach((node) => {
        deletedKeys.add(nodeKey(node));
        if (node.kind === "group") {
          const group = findGroup(node.id);
          (group?.tasks || []).forEach((item) => collectDeletedTaskKeys(item, deletedKeys));
          return;
        }
        const found = findTask(node.id);
        if (found) collectDeletedTaskKeys(found.item, deletedKeys);
      });
      return deletedKeys;
    }

    function deleteTaskAndSelectNeighbor(id) {
      const found = findTask(id);
      if (!found) return false;
      const node = { kind: "task", id };
      const target = getNeighborAfterDelete(node, getVisibleNodes(), collectDeletedNodeKeys([node]));
      pushUndoState("delete");
      removeTask(id);
      if (target) {
        setSingleSelection(target);
      } else {
        selectedNode = null;
        multiSelectedNodes = [];
        selectionAnchorNode = null;
      }
      saveState();
      render();
      return true;
    }

    function toggleTask(id, force) {
      const found = findTask(id);
      if (!found || !(found.item.children || []).length) return;
      const nextCollapsed = typeof force === "boolean" ? force : !found.item.collapsed;
      if (found.item.collapsed === nextCollapsed) {
        selectNode("task", id);
        return;
      }
      pushUndoState();
      found.item.collapsed = nextCollapsed;
      saveState();
      render();
      selectNode("task", id);
    }

    function toggleGroup(id, force) {
      const group = findGroup(id);
      if (!group) return;
      const nextCollapsed = typeof force === "boolean" ? force : !group.collapsed;
      if (group.collapsed === nextCollapsed) {
        selectNode("group", id);
        return;
      }
      pushUndoState();
      group.collapsed = nextCollapsed;
      saveState();
      render();
      selectNode("group", id);
    }

    function toggleSelectedNode(collapsed) {
      toggleSelectedNodes(collapsed);
    }

    function moveNodeInList(list, index, direction) {
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return false;
      const [item] = list.splice(index, 1);
      list.splice(nextIndex, 0, item);
      return true;
    }

    function getContiguousIndexBlocks(indexes) {
      const blocks = [];
      indexes.forEach((index) => {
        const last = blocks[blocks.length - 1];
        if (last && index === last.end + 1) {
          last.end = index;
        } else {
          blocks.push({ start: index, end: index });
        }
      });
      return blocks;
    }

    function moveEntriesInList(list, entries, direction) {
      const indexes = [...new Set(entries.map((entry) => entry.index))]
        .filter((index) => index >= 0 && index < list.length)
        .sort((a, b) => a - b);
      const blocks = getContiguousIndexBlocks(indexes);
      const orderedBlocks = direction < 0 ? blocks : [...blocks].reverse();
      let moved = false;

      orderedBlocks.forEach((block) => {
        if (direction < 0) {
          if (block.start === 0) return;
          const [beforeBlock] = list.splice(block.start - 1, 1);
          list.splice(block.end, 0, beforeBlock);
          moved = true;
          return;
        }

        if (block.end >= list.length - 1) return;
        const [afterBlock] = list.splice(block.end + 1, 1);
        list.splice(block.start, 0, afterBlock);
        moved = true;
      });

      return moved;
    }

    function moveSelectedNode(direction) {
      moveSelectedNodes(direction);
    }

    function moveSelectedNodes(direction) {
      const nodes = getSelectedNodes();
      if (!nodes.length) return;
      pushUndoState();
      let moved = false;

      const groupEntries = nodes
        .filter((node) => node.kind === "group")
        .map((node) => ({ index: state.groups.findIndex((group) => group.id === node.id) }))
        .filter((entry) => entry.index >= 0);
      moved = moveEntriesInList(state.groups, groupEntries, direction) || moved;

      const taskLists = new Map();
      nodes.filter((node) => node.kind === "task").forEach((node) => {
        const found = findTask(node.id);
        if (!found) return;
        if (!taskLists.has(found.list)) taskLists.set(found.list, []);
        taskLists.get(found.list).push({ index: found.index });
      });

      taskLists.forEach((entries, list) => {
        moved = moveEntriesInList(list, entries, direction) || moved;
      });

      if (!moved) {
        discardUndoState();
        return;
      }
      saveState();
      render();
    }

    function deleteSelectedNodes() {
      const nodes = getSelectedNodes();
      if (!nodes.length) return;
      pushUndoState("delete");
      const visibleBeforeDelete = getVisibleNodes();
      const deletedKeys = collectDeletedNodeKeys(nodes);

      nodes.filter((node) => node.kind === "group").forEach((node) => {
        const index = state.groups.findIndex((group) => group.id === node.id);
        if (index >= 0) state.groups.splice(index, 1);
      });

      nodes.filter((node) => node.kind === "task").forEach((node) => {
        removeTask(node.id);
      });

      const target = getNeighborAfterDelete(nodes[0], visibleBeforeDelete, deletedKeys);
      if (target) {
        setSingleSelection(target);
      } else {
        selectedNode = null;
        multiSelectedNodes = [];
        selectionAnchorNode = null;
      }
      saveState();
      render();
    }

    function toggleSelectedNodes(collapsed) {
      const nodes = getSelectedNodes();
      if (!nodes.length) return;
      let changed = false;
      pushUndoState();

      nodes.forEach((node) => {
        if (node.kind === "group") {
          const group = findGroup(node.id);
          if (!group) return;
          const nextCollapsed = typeof collapsed === "boolean" ? collapsed : !group.collapsed;
          if (group.collapsed !== nextCollapsed) {
            group.collapsed = nextCollapsed;
            changed = true;
          }
          return;
        }

        const found = findTask(node.id);
        if (!found || !(found.item.children || []).length) return;
        const nextCollapsed = typeof collapsed === "boolean" ? collapsed : !found.item.collapsed;
        if (found.item.collapsed !== nextCollapsed) {
          found.item.collapsed = nextCollapsed;
          changed = true;
        }
      });

      if (!changed) {
        discardUndoState();
        renderSelection();
        return;
      }
      saveState();
      render();
    }

    function getVerticalDropPosition(event, element) {
      const rect = element.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    }

    function getBoardGroupDropInstruction(event) {
      if (draggedNode?.kind !== "group" || !boardEl.contains(event.target)) return null;
      const cards = [...boardEl.querySelectorAll("[data-group-card]")].map((card) => ({
        card,
        rect: card.getBoundingClientRect(),
      }));
      if (!cards.length) return null;

      cards.sort((first, second) => first.rect.top - second.rect.top || first.rect.left - second.rect.left);
      const first = cards[0];
      if (event.clientY <= first.rect.top + first.rect.height / 2) {
        return {
          targetKind: "group",
          targetId: first.card.dataset.groupCard,
          position: "before",
        };
      }

      const target = cards.find((item) => event.clientY < item.rect.top + item.rect.height / 2);
      if (target) {
        return {
          targetKind: "group",
          targetId: target.card.dataset.groupCard,
          position: "before",
        };
      }

      const last = cards[cards.length - 1];
      return {
        targetKind: "group",
        targetId: last.card.dataset.groupCard,
        position: "after",
      };
    }

    function getDropInstruction(event) {
      const zone = event.target.closest("[data-drop-target]");
      if (zone) {
        return {
          targetKind: zone.dataset.dropKind || (zone.dataset.position === "group" ? "group" : "task"),
          targetId: zone.dataset.dropTarget,
          position: zone.dataset.position === "group" ? "group" : zone.dataset.position,
        };
      }

      const taskRow = event.target.closest("[data-task-row]");
      if (taskRow) {
        return {
          targetKind: "task",
          targetId: taskRow.dataset.taskRow,
          position: getVerticalDropPosition(event, taskRow),
        };
      }

      const groupCard = event.target.closest("[data-group-card]");
      if (groupCard) {
        const position = draggedNode?.kind === "group"
          ? getVerticalDropPosition(event, groupCard)
          : "group";
        return {
          targetKind: "group",
          targetId: groupCard.dataset.groupCard,
          position,
        };
      }

      return getBoardGroupDropInstruction(event);
    }

    function clearDropIndicators() {
      document.querySelectorAll(".drop-zone.active, .drop-before, .drop-after, .drop-child").forEach((element) => {
        element.classList.remove("active", "drop-before", "drop-after", "drop-child");
      });
    }

    function stopDragAutoScroll() {
      autoScrollVelocity = 0;
      if (autoScrollFrame) {
        const cancelFrame = window.cancelAnimationFrame || window.clearTimeout;
        cancelFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
    }

    function runDragAutoScroll() {
      if (!autoScrollVelocity) {
        stopDragAutoScroll();
        return;
      }
      window.scrollBy({ top: autoScrollVelocity, behavior: "auto" });
      const nextFrame = window.requestAnimationFrame || window.setTimeout;
      autoScrollFrame = nextFrame(runDragAutoScroll, 16);
    }

    function updateDragAutoScroll(clientY) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      let nextVelocity = 0;

      if (clientY < AUTO_SCROLL_EDGE_PX) {
        nextVelocity = -Math.ceil(((AUTO_SCROLL_EDGE_PX - clientY) / AUTO_SCROLL_EDGE_PX) * MAX_AUTO_SCROLL_SPEED);
      } else if (clientY > viewportHeight - AUTO_SCROLL_EDGE_PX) {
        nextVelocity = Math.ceil(((clientY - (viewportHeight - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX) * MAX_AUTO_SCROLL_SPEED);
      }

      autoScrollVelocity = nextVelocity;
      if (autoScrollVelocity && !autoScrollFrame) {
        const nextFrame = window.requestAnimationFrame || window.setTimeout;
        autoScrollFrame = nextFrame(runDragAutoScroll, 16);
      }
      if (!autoScrollVelocity) stopDragAutoScroll();
    }

    function showDropInstruction(instruction) {
      clearDropIndicators();
      const selector = instruction.targetKind === "task"
        ? `[data-task-row="${instruction.targetId}"]`
        : `[data-group-card="${instruction.targetId}"]`;
      const target = document.querySelector(selector);
      if (!target) return;
      if (instruction.position === "before") target.classList.add("drop-before");
      if (instruction.position === "after") target.classList.add("drop-after");
      if (instruction.position === "child" || instruction.position === "group") target.classList.add("drop-child");
    }

    function canDropOn(instruction) {
      if (!draggedNode || !instruction) return false;
      if (draggedNode.kind === "group") {
        return instruction.targetKind === "group" && ["before", "after"].includes(instruction.position);
      }
      if (instruction.targetKind === "task") return true;
      return instruction.targetKind === "group" && instruction.position === "group";
    }

    function applyDropInstruction(instruction, event = null) {
      if (!canDropOn(instruction)) return;
      if (draggedNode.kind === "group") {
        moveGroup(draggedNode.id, instruction.targetId, instruction.position);
        return;
      }
      if (event?.ctrlKey && draggedNode.kind === "task") {
        const copied = copyTaskToDoingNow(draggedNode.id);
        if (copied && instruction.targetId) moveTask(copied.id, instruction.targetId, instruction.position);
        return;
      }
      moveTask(draggedNode.id, instruction.targetId, instruction.position);
    }

    function shouldCancelLongPress(startX, startY, clientX, clientY, threshold = LONG_PRESS_MOVE_PX) {
      return Math.hypot(clientX - startX, clientY - startY) > threshold;
    }

    function clearTouchDrag() {
      if (!touchDrag) return;
      if (touchDrag.timer) window.clearTimeout?.(touchDrag.timer);
      touchDrag.source?.classList.remove("touch-dragging");
      boardEl.classList.remove("is-dragging-group", "is-touch-dragging");
      clearDropIndicators();
      stopDragAutoScroll();
      draggedNode = null;
      touchDrag = null;
    }

    function armTouchDrag() {
      if (!touchDrag) return false;
      const source = touchDrag.source;
      const kind = source.dataset.dragKind;
      const id = kind === "group" ? source.dataset.groupRow : source.dataset.taskRow;
      if (!id) {
        clearTouchDrag();
        return false;
      }
      touchDrag.armed = true;
      touchDrag.timer = null;
      draggedNode = { kind, id };
      source.classList.add("touch-dragging");
      boardEl.classList.add("is-touch-dragging");
      if (kind === "group") boardEl.classList.add("is-dragging-group");
      selectNode(kind, id);
      return true;
    }

    function finishTouchDrag(event, cancelled = false) {
      if (!touchDrag) return false;
      const instruction = touchDrag.instruction;
      const shouldApply = touchDrag.armed && !cancelled && canDropOn(instruction);
      if (shouldApply) applyDropInstruction(instruction, event);
      clearTouchDrag();
      return shouldApply;
    }

    function setSingleSelection(node) {
      selectedNode = { ...node };
      multiSelectedNodes = [{ ...node }];
      selectionAnchorNode = { ...node };
    }

    function insertSiblingBelowNode(node = selectedNode) {
      if (!node) return null;
      pushUndoState();

      if (node.kind === "group") {
        const index = state.groups.findIndex((group) => group.id === node.id);
        if (index < 0) {
          discardUndoState();
          return null;
        }
        const group = {
          id: createId("group"),
          title: "New group",
          collapsed: false,
          color: GROUP_PALETTES[(index + 1) % GROUP_PALETTES.length].color,
          tasks: [],
        };
        state.groups.splice(index + 1, 0, group);
        setSingleSelection({ kind: "group", id: group.id });
        saveState();
        render();
        return group;
      }

      const found = findTask(node.id);
      if (!found) {
        discardUndoState();
        return null;
      }
      const item = task("New task", [], {
        createdInGroupId: found.group?.id || null,
        createdUnderTaskId: found.parent?.id || null,
      });
      found.list.splice(found.index + 1, 0, item);
      setSingleSelection({ kind: "task", id: item.id });
      saveState();
      render();
      return item;
    }

    function insertSiblingBelowSelectedNode() {
      const inserted = insertSiblingBelowNode(selectedNode);
      if (!inserted || !selectedNode) return inserted;
      if (selectedNode.kind === "group") {
        focusEditableText(document.querySelector(`[data-group-title="${inserted.id}"]`), true);
      } else {
        focusTaskText(inserted.id);
      }
      return inserted;
    }

    function indentTask(id) {
      const found = findTask(id);
      if (!found || found.index <= 0) return false;
      const newParent = found.list[found.index - 1];
      pushUndoState();
      const [item] = found.list.splice(found.index, 1);
      newParent.children = newParent.children || [];
      newParent.children.push(item);
      newParent.collapsed = false;
      setSingleSelection({ kind: "task", id });
      saveState();
      render();
      return true;
    }

    function outdentTask(id) {
      const found = findTask(id);
      if (!found || !found.parent) return false;
      const parent = findTask(found.parent.id);
      if (!parent) return false;
      pushUndoState();
      const [item] = found.list.splice(found.index, 1);
      parent.list.splice(parent.index + 1, 0, item);
      setSingleSelection({ kind: "task", id });
      saveState();
      render();
      return true;
    }

    function indentSelectedNode() {
      const node = selectedNode || getVisibleNodes()[0];
      if (!node || node.kind !== "task") return false;
      return indentTask(node.id);
    }

    function outdentSelectedNode() {
      const node = selectedNode || getVisibleNodes()[0];
      if (!node || node.kind !== "task") return false;
      return outdentTask(node.id);
    }

    function addTask(groupId, parentId = null) {
      const item = task("New task", [], {
        createdInGroupId: groupId,
        createdUnderTaskId: parentId,
      });
      if (parentId) {
        const parent = findTask(parentId);
        if (!parent) return null;
        parent.item.children = parent.item.children || [];
        parent.item.children.push(item);
        parent.item.collapsed = false;
      } else {
        const group = findGroup(groupId);
        if (!group) return null;
        group.tasks.push(item);
      }
      setSingleSelection({ kind: "task", id: item.id });
      saveState();
      render();
      focusTaskText(item.id);
      return item;
    }

    function addGroup() {
      const group = {
        id: createId("group"),
        title: "New group",
        collapsed: false,
        color: GROUP_PALETTES[state.groups.length % GROUP_PALETTES.length].color,
        tasks: [],
      };
      state.groups.push(group);
      setSingleSelection({ kind: "group", id: group.id });
      saveState();
      render();
      document.querySelector(`[data-group-title="${group.id}"]`)?.focus();
    }

    function setEveryCollapsed(collapsed) {
      function walk(tasks) {
        tasks.forEach((item) => {
          if ((item.children || []).length) item.collapsed = collapsed;
          walk(item.children || []);
        });
      }
      state.groups.forEach((group) => {
        group.collapsed = collapsed;
        walk(group.tasks);
      });
      saveState();
      render();
    }

    function getVisibleNodes() {
      const nodes = [];
      const query = searchEl.value.trim().toLowerCase();

      function walk(tasks) {
        tasks.forEach((item) => {
          if (taskMatchesFilter(item, query)) nodes.push({ kind: "task", id: item.id });
          if (!item.collapsed) walk(item.children || []);
        });
      }

      state.groups.forEach((group) => {
        const groupMatches = !query || group.title.toLowerCase().includes(query) || group.tasks.some((item) => taskMatchesFilter(item, query));
        if (!groupMatches) return;
        nodes.push({ kind: "group", id: group.id });
        if (!group.collapsed) walk(group.tasks);
      });
      return nodes;
    }

    function nodeKey(node) {
      return `${node.kind}:${node.id}`;
    }

    function sameNode(first, second) {
      return Boolean(first && second && first.kind === second.kind && first.id === second.id);
    }

    function nodeExists(node) {
      if (!node) return false;
      return node.kind === "group" ? Boolean(findGroup(node.id)) : Boolean(findTask(node.id));
    }

    function getNodeRow(node) {
      if (!node) return null;
      return document.querySelector(`[data-node-kind="${node.kind}"][data-node-id="${node.id}"]`);
    }

    function getSelectedNodes() {
      const source = multiSelectedNodes.length ? multiSelectedNodes : (selectedNode ? [selectedNode] : []);
      const seen = new Set();
      return source.filter((node) => {
        if (!node || !nodeExists(node)) return false;
        const key = nodeKey(node);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function renderSelection() {
      document.querySelectorAll(".selected").forEach((row) => row.classList.remove("selected"));
      getSelectedNodes().forEach((node) => getNodeRow(node)?.classList.add("selected"));

      const row = getNodeRow(selectedNode);
      if (row) {
        if (document.activeElement !== row && !row.contains(document.activeElement)) {
          suppressFocusSelection = true;
          row.focus({ preventScroll: true });
          suppressFocusSelection = false;
        }
        row.scrollIntoView({ block: "nearest" });
      }
    }

    function selectRangeToNode(node) {
      const visible = getVisibleNodes();
      const anchor = selectionAnchorNode || selectedNode || visible[0];
      const anchorIndex = visible.findIndex((item) => sameNode(item, anchor));
      const targetIndex = visible.findIndex((item) => sameNode(item, node));

      if (anchorIndex < 0 || targetIndex < 0) {
        selectedNode = { ...node };
        selectionAnchorNode = { ...node };
        multiSelectedNodes = [{ ...node }];
        renderSelection();
        return;
      }

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      selectedNode = { ...node };
      multiSelectedNodes = visible.slice(start, end + 1).map((item) => ({ ...item }));
      renderSelection();
    }

    function selectNode(kindOrNode, id = null, options = {}) {
      const node = typeof kindOrNode === "object" ? kindOrNode : { kind: kindOrNode, id };
      if (options.extend) {
        selectRangeToNode(node);
        return;
      }

      selectedNode = { ...node };
      selectionAnchorNode = { ...node };
      multiSelectedNodes = [{ ...node }];
      renderSelection();
    }

    function selectTask(id) {
      selectNode("task", id);
    }

    function isSelected(kind, id) {
      return getSelectedNodes().some((node) => node.kind === kind && node.id === id);
    }

    function focusEditableText(element, selectContents = false) {
      if (!element) return;
      element.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      if (!selectContents) range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function focusTaskText(id, selectContents = true) {
      const text = document.querySelector(`[data-task-text="${id}"]`);
      focusEditableText(text, selectContents);
    }

    function focusSelectedTextField() {
      const nodes = getVisibleNodes();
      const node = selectedNode || nodes[0];
      if (!node) return;
      selectedNode = node;
      const selector = node.kind === "group"
        ? `[data-group-title="${node.id}"]`
        : `[data-task-text="${node.id}"]`;
      focusEditableText(document.querySelector(selector));
    }

    function getEditableText(valueOrElement) {
      const value = typeof valueOrElement === "string"
        ? valueOrElement
        : valueOrElement?.textContent || "";
      return value.replace(/\u00a0/g, " ").trim();
    }

    function isEditableTextEmpty(valueOrElement) {
      return getEditableText(valueOrElement).length === 0;
    }

    function deleteTaskIfEmpty(id, valueOrElement) {
      if (!isEditableTextEmpty(valueOrElement)) return false;
      return deleteTaskAndSelectNeighbor(id);
    }

    function updateTaskTextFromEditable(id, valueOrElement) {
      const found = findTask(id);
      if (!found) return false;
      found.item.text = getMarkdownTextFromEditable(valueOrElement);
      saveState();
      return true;
    }

    function getMarkdownTextFromEditable(valueOrElement) {
      if (typeof valueOrElement === "string" || !valueOrElement?.childNodes) {
        return getEditableText(valueOrElement);
      }

      function serializeNode(node) {
        if (node.nodeType === 3) return node.nodeValue || "";
        const tagName = node.tagName?.toLowerCase();
        if (tagName === "br") return "\n";
        if (tagName === "a") {
          const href = node.getAttribute("href") || "";
          return node.dataset?.autoLink === "true"
            ? href
            : `[${node.textContent || href}](${href})`;
        }
        return [...(node.childNodes || [])].map(serializeNode).join("");
      }

      return [...valueOrElement.childNodes].map(serializeNode).join("").replace(/\u00a0/g, " ").trim();
    }

    function applyUrlPasteToText(text, start, end, url) {
      const source = String(text || "");
      const safeStart = Math.max(0, Math.min(source.length, Number(start) || 0));
      const safeEnd = Math.max(safeStart, Math.min(source.length, Number(end) || 0));
      if (!/^https?:\/\/\S+$/i.test(url) || safeStart === safeEnd) return source;
      const label = source.slice(safeStart, safeEnd);
      return `${source.slice(0, safeStart)}[${label}](${url})${source.slice(safeEnd)}`;
    }

    function handleEditingBackspaceDelete(event) {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl || !isEditableTextEmpty(textEl)) return false;
      event.preventDefault();
      deleteTaskAndSelectNeighbor(textEl.dataset.taskText);
      return true;
    }

    function getEditableForNode(node) {
      if (!node) return null;
      const selector = node.kind === "group"
        ? `[data-group-title="${node.id}"]`
        : `[data-task-text="${node.id}"]`;
      return document.querySelector(selector);
    }

    function insertTextAtSelection(text, element) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        element.textContent += text;
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function selectionContainsEditableContents(element, range = null) {
      const selectedRange = range || (() => {
        const selection = window.getSelection();
        return selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      })();
      if (!selectedRange) return false;
      const container = selectedRange.commonAncestorContainer;
      return container === element || Boolean(element.contains && element.contains(container));
    }

    function replaceEditableContents(element, text) {
      element.textContent = text;
      if (typeof element.focus === "function") focusEditableText(element);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function startEditingSelectedNode(initialText = "") {
      const nodes = getVisibleNodes();
      const node = selectedNode || nodes[0];
      if (!node) return false;
      setSingleSelection(node);
      renderSelection();
      const editable = getEditableForNode(node);
      if (!editable) return false;
      focusEditableText(editable);
      if (initialText) insertTextAtSelection(initialText, editable);
      return true;
    }

    function insertEditingLineBreak(event) {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const lineBreak = document.createTextNode("\n");
      range.insertNode(lineBreak);
      range.setStartAfter(lineBreak);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      event.target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function getTaskSplitPlan(text, offset) {
      const source = String(text || "");
      const caret = Math.max(0, Math.min(source.length, Number(offset) || 0));
      return {
        beforeText: source.slice(0, caret),
        afterText: source.slice(caret),
        position: caret === 0 ? "before" : "after",
      };
    }

    function getCaretOffset(element) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return getMarkdownTextFromEditable(element).length;
      const range = selection.getRangeAt(0);
      if (!selectionContainsEditableContents(element, range)) return getMarkdownTextFromEditable(element).length;
      const prefix = range.cloneRange();
      prefix.selectNodeContents(element);
      prefix.setEnd(range.endContainer, range.endOffset);
      return prefix.toString().length;
    }

    function splitTaskAtOffset(id, offset) {
      const found = findTask(id);
      if (!found) return null;
      const plan = getTaskSplitPlan(found.item.text, offset);
      pushUndoState("split");

      const newItem = task(plan.position === "before" ? "" : plan.afterText, [], {
        createdInGroupId: found.group?.id || found.item.createdInGroupId,
        createdUnderTaskId: found.parent?.id || null,
      });
      if (plan.position === "before") {
        found.list.splice(found.index, 0, newItem);
      } else {
        found.item.text = plan.beforeText;
        found.list.splice(found.index + 1, 0, newItem);
      }

      setSingleSelection({ kind: "task", id: newItem.id });
      saveState();
      render();
      focusTaskText(newItem.id, false);
      return { item: newItem, position: plan.position };
    }

    function splitEditingTask(event) {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return false;
      const id = textEl.dataset.taskText;
      const found = findTask(id);
      if (!found) return false;
      found.item.text = getMarkdownTextFromEditable(textEl);
      splitTaskAtOffset(id, getCaretOffset(textEl));
      return true;
    }

    function renderIcon(name) {
      const icons = {
        chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>',
        grip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
        plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
      };
      return icons[name] || "";
    }

    function buildGroupPalette(color) {
      return {
        color,
        bg: `color-mix(in srgb, ${color} 8%, white)`,
        selected: `color-mix(in srgb, ${color} 18%, white)`,
        border: `color-mix(in srgb, ${color} 36%, white)`,
        ink: `color-mix(in srgb, ${color} 70%, black)`,
      };
    }

    function normalizeColor(value) {
      if (typeof value === "string") return value;
      if (value && typeof value.color === "string") return value.color;
      return "";
    }

    function getDefaultGroupColor(group, index) {
      return normalizeColor(GROUP_COLORS[group.id]) || GROUP_PALETTES[index % GROUP_PALETTES.length].color;
    }

    function migrateState(boardState, now = new Date().toISOString(), options = {}) {
      const source = boardState && typeof boardState === "object" ? boardState : seedState();
      const previousVersion = Number(source.version) || 1;
      if (previousVersion < SCHEMA_VERSION && options.includeResearch !== false) ensureResearchTask(source, now);
      return normalizeState(source, now);
    }

    function taskTreeContainsText(tasks, text) {
      return (tasks || []).some((item) => item.text === text || taskTreeContainsText(item.children, text));
    }

    function ensureResearchTask(boardState, now = new Date().toISOString()) {
      if ((boardState.groups || []).some((group) => taskTreeContainsText(group.tasks, RESEARCH_TASK_TEXT))) return false;
      let group = (boardState.groups || []).find((item) => /general|later/i.test(item.title || ""));
      if (!group) {
        group = {
          id: "group-research",
          title: "Research",
          collapsed: false,
          tasks: [],
        };
        boardState.groups = Array.isArray(boardState.groups) ? boardState.groups : [];
        boardState.groups.push(group);
      }
      group.tasks = Array.isArray(group.tasks) ? group.tasks : [];
      group.tasks.push(task(RESEARCH_TASK_TEXT, [
        task("Compare Obsidian, ClickUp, Todoist, Things, and Notion workflows", [], { createdAt: now }),
        task("Review recurring complaints and praise in public Reddit discussions", [], { createdAt: now }),
        task("Summarize capture, scheduling, mobile, configuration, portability, and sync pain points", [], { createdAt: now }),
      ], { createdAt: now }));
      return true;
    }

    function normalizeState(boardState, now = new Date().toISOString()) {
      boardState.version = SCHEMA_VERSION;
      boardState.settings = {
        ...DEFAULT_SETTINGS,
        ...(boardState.settings && typeof boardState.settings === "object" ? boardState.settings : {}),
      };
      boardState.trash = Array.isArray(boardState.trash) ? boardState.trash : [];
      boardState.groups = Array.isArray(boardState.groups) ? boardState.groups : [];
      boardState.groups.forEach((group, index) => {
        group.id = typeof group.id === "string" && group.id ? group.id : createId("group");
        group.title = typeof group.title === "string" ? group.title : "Untitled group";
        group.color = normalizeColor(group.color) || getDefaultGroupColor(group, index);
        group.createdAt = typeof group.createdAt === "string" ? group.createdAt : now;
        group.policyOverrides = group.policyOverrides && typeof group.policyOverrides === "object"
          ? group.policyOverrides
          : null;
        group.tasks = Array.isArray(group.tasks) ? group.tasks : [];
        group.tasks.forEach((item) => normalizeTask(item, {
          groupId: group.id,
          parentId: null,
          now,
        }));
      });
      return boardState;
    }

    function normalizeTask(item, context = {}) {
      const now = context.now || new Date().toISOString();
      item.id = typeof item.id === "string" && item.id ? item.id : createId("task");
      item.text = typeof item.text === "string" ? item.text : "";
      item.done = Boolean(item.done);
      item.completedAt = item.done
        ? (typeof item.completedAt === "string" ? item.completedAt : now)
        : null;
      item.collapsed = Boolean(item.collapsed);
      item.focusSeconds = Math.max(0, Math.floor(Number(item.focusSeconds) || 0));
      item.plannedMinutes = Number(item.plannedMinutes) > 0 ? Number(item.plannedMinutes) : null;
      item.schedule = item.schedule && typeof item.schedule === "object" ? item.schedule : null;
      item.reminderAt = typeof item.reminderAt === "string" ? item.reminderAt : null;
      item.createdAt = typeof item.createdAt === "string" ? item.createdAt : now;
      item.createdInGroupId = typeof item.createdInGroupId === "string"
        ? item.createdInGroupId
        : (context.groupId || null);
      item.createdUnderTaskId = typeof item.createdUnderTaskId === "string"
        ? item.createdUnderTaskId
        : (context.parentId || null);
      item.policyOverrides = item.policyOverrides && typeof item.policyOverrides === "object"
        ? item.policyOverrides
        : null;
      item.children = Array.isArray(item.children) ? item.children : [];
      item.children.forEach((child) => normalizeTask(child, {
        groupId: context.groupId || item.createdInGroupId,
        parentId: item.id,
        now,
      }));
      return item;
    }

    function changeGroupColor(id, color) {
      const group = findGroup(id);
      if (!group || !/^#[0-9a-f]{6}$/i.test(color) || group.color === color) return false;
      pushUndoState();
      group.color = color;
      saveState();
      render();
      selectNode("group", id);
      return true;
    }

    function getGroupPalette(group, index) {
      return buildGroupPalette(normalizeColor(group.color) || getDefaultGroupColor(group, index));
    }

    function groupStyleVars(group, index) {
      const palette = getGroupPalette(group, index);
      return [
        `--group-color: ${palette.color}`,
        `--group-bg: ${palette.bg}`,
        `--group-selected: ${palette.selected}`,
        `--group-border: ${palette.border}`,
        `--group-ink: ${palette.ink}`,
      ].join("; ");
    }

    function taskMatchesFilter(item, query) {
      if (!query) return true;
      if (item.text.toLowerCase().includes(query)) return true;
      return (item.children || []).some((child) => taskMatchesFilter(child, query));
    }

    function renderTask(item, groupId, query) {
      if (!taskMatchesFilter(item, query)) return "";
      const hasChildren = (item.children || []).length > 0;
      const expanded = hasChildren && !item.collapsed;
      const childHtml = expanded
        ? `<ul class="child-list">${item.children.map((child) => renderTask(child, groupId, query)).join("")}</ul>`
        : "";
      const dropChild = hasChildren
        ? `<div class="drop-zone child" data-drop-target="${item.id}" data-position="child" aria-hidden="true"></div>`
        : "";

      return `
        <li class="task" data-task="${item.id}">
          <div class="drop-zone" data-drop-target="${item.id}" data-position="before" aria-hidden="true"></div>
          <div class="task-row ${item.done ? "done" : ""} ${isSelected("task", item.id) ? "selected" : ""}" data-task-row="${item.id}" data-node-kind="task" data-node-id="${item.id}" data-drag-kind="task" draggable="true" tabindex="0">
            <button class="chevron ${hasChildren ? "" : "hidden"}" type="button" data-action="toggle-task" data-task-id="${item.id}" aria-label="${expanded ? "Collapse" : "Expand"} task" aria-expanded="${expanded ? "true" : "false"}">
              ${renderIcon("chevron")}
            </button>
            <button class="checkbox ${item.done ? "done" : ""}" type="button" data-action="toggle-done" data-task-id="${item.id}" aria-label="${item.done ? "Mark not done" : "Mark done"}">
              ${item.done ? renderIcon("check") : ""}
            </button>
            <div class="task-text" data-task-text="${item.id}" contenteditable="true" spellcheck="true">${renderInlineMarkdown(item.text)}</div>
            <div class="task-actions">
              <button class="icon-button drag-handle" type="button" data-action="focus-task" data-task-id="${item.id}" data-touch-drag aria-label="Drag task; hold on touch screens">${renderIcon("grip")}</button>
              <button class="icon-button" type="button" data-action="add-child" data-task-id="${item.id}" data-group-id="${groupId}" aria-label="Add subtask">${renderIcon("plus")}</button>
              <button class="icon-button" type="button" data-action="delete-task" data-task-id="${item.id}" aria-label="Delete task">${renderIcon("trash")}</button>
            </div>
          </div>
          ${childHtml}
          ${dropChild}
          <div class="drop-zone" data-drop-target="${item.id}" data-position="after" aria-hidden="true"></div>
        </li>
      `;
    }

    function renderGroup(group, query, index) {
      const visibleTasks = group.tasks.map((item) => renderTask(item, group.id, query)).join("");
      const count = countTasks(group.tasks);
      const empty = visibleTasks.trim() ? "" : '<p class="empty">No tasks match this filter.</p>';
      const palette = getGroupPalette(group, index);
      return `
        <article class="group" id="${group.id}" data-group-card="${group.id}" style="${groupStyleVars(group, index)}">
          <header class="group-header ${isSelected("group", group.id) ? "selected" : ""}" data-group-row="${group.id}" data-node-kind="group" data-node-id="${group.id}" data-drag-kind="group" data-touch-drag draggable="true" tabindex="0">
            <div class="group-heading">
              <button class="chevron" type="button" data-action="toggle-group" data-group-id="${group.id}" aria-label="${group.collapsed ? "Expand" : "Collapse"} group" aria-expanded="${group.collapsed ? "false" : "true"}">${renderIcon("chevron")}</button>
              <div class="group-title" data-group-title="${group.id}" contenteditable="true" spellcheck="true">${escapeHtml(group.title)}</div>
              <span class="group-count">${count}</span>
            </div>
            <div class="group-tools">
              <input class="color-picker" type="color" value="${palette.color}" data-group-color="${group.id}" aria-label="Change group color">
              <button class="icon-button" type="button" data-action="add-task" data-group-id="${group.id}" aria-label="Add task">${renderIcon("plus")}</button>
            </div>
          </header>
          <ul class="task-list ${group.collapsed ? "is-hidden" : ""}" data-group-list="${group.id}">
            ${visibleTasks}
            <li class="drop-zone child" data-drop-target="${group.id}" data-position="group" aria-hidden="true"></li>
          </ul>
          ${group.collapsed ? "" : empty}
        </article>
      `;
    }

    function renderNav() {
      navEl.innerHTML = state.groups.map((group, index) => `
        <button type="button" data-nav-target="${group.id}" title="Jump to ${escapeHtml(group.title)}" style="--nav-color: ${getGroupPalette(group, index).color}">
          <span>${escapeHtml(group.title)}</span>
          <strong>${countTasks(group.tasks)}</strong>
        </button>
      `).join("");
    }

    function render() {
      const query = searchEl.value.trim().toLowerCase();
      const firstGroup = state.groups[0];
      const topDrop = firstGroup
        ? `<div class="group-top-drop" data-board-top-drop data-drop-target="${firstGroup.id}" data-drop-kind="group" data-position="before" aria-label="Move group to top"></div>`
        : "";
      boardEl.innerHTML = topDrop + state.groups.map((group, index) => renderGroup(group, query, index)).join("");
      renderNav();
      const totals = state.groups.reduce((acc, group) => {
        acc.total += countTasks(group.tasks);
        acc.done += countDone(group.tasks);
        return acc;
      }, { total: 0, done: 0 });
      totalCountEl.textContent = totals.total;
      doneCountEl.textContent = totals.done;
      if (selectedNode) renderSelection();
    }

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function renderInlineMarkdown(value) {
      const source = String(value || "");
      const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/gi;
      let html = "";
      let cursor = 0;
      let match;
      while ((match = pattern.exec(source))) {
        html += escapeHtml(source.slice(cursor, match.index));
        const label = match[1] || match[3];
        const url = match[2] || match[3];
        const autoLink = match[3] ? ' data-auto-link="true"' : "";
        html += `<a class="task-link" data-task-link href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" contenteditable="false"${autoLink}>${escapeHtml(label)}</a>`;
        cursor = pattern.lastIndex;
      }
      return html + escapeHtml(source.slice(cursor)).replace(/\n/g, "<br>");
    }

    function renderFocusChildren(tasks, depth = 0) {
      if (!tasks.length) return "";
      const items = tasks.map((item) => `
        <li style="margin-left: ${depth * 18}px">
          ${escapeHtml(item.text)}
          ${renderFocusChildren(item.children || [], depth + 1)}
        </li>
      `).join("");
      return `<ul>${items}</ul>`;
    }

    function formatFocusSeconds(totalSeconds) {
      const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remaining = seconds % 60;
      const parts = hours > 0 ? [hours, minutes, remaining] : [minutes, remaining];
      return parts.map((part) => String(part).padStart(2, "0")).join(":");
    }

    function getFocusElapsedSeconds(item, now = Date.now()) {
      const stored = Math.max(0, Math.floor(Number(item?.focusSeconds) || 0));
      if (!item || item.id !== focusModeTaskId || !focusModeStartedAt) return stored;
      return stored + Math.max(0, Math.floor((now - focusModeStartedAt) / 1000));
    }

    function renderFocusTimer(now = Date.now()) {
      if (!focusTimerEl || !focusModeTaskId) return;
      const found = findTask(focusModeTaskId);
      focusTimerEl.textContent = formatFocusSeconds(found ? getFocusElapsedSeconds(found.item, now) : 0);
    }

    function addFocusElapsedSeconds(taskId, startedAt, endedAt = Date.now()) {
      const found = findTask(taskId);
      if (!found || !startedAt) return false;
      const elapsed = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
      if (!elapsed) return false;
      found.item.focusSeconds = Math.max(0, Math.floor(Number(found.item.focusSeconds) || 0)) + elapsed;
      return true;
    }

    function stopFocusTimer(endedAt = Date.now()) {
      const changed = focusModeTaskId && focusModeStartedAt
        ? addFocusElapsedSeconds(focusModeTaskId, focusModeStartedAt, endedAt)
        : false;
      focusModeStartedAt = null;
      if (focusModeTimerFrame) {
        window.clearInterval?.(focusModeTimerFrame);
        focusModeTimerFrame = null;
      }
      if (changed) saveState();
      return changed;
    }

    function startFocusTimer(startedAt = Date.now()) {
      focusModeStartedAt = startedAt;
      renderFocusTimer(startedAt);
      if (focusTimerEl && typeof window.setInterval === "function") {
        if (focusModeTimerFrame) window.clearInterval?.(focusModeTimerFrame);
        focusModeTimerFrame = window.setInterval(renderFocusTimer, 1000);
      }
    }

    function renderFocusMode() {
      if (!focusModeEl || !focusTaskEl || !focusModeTaskId) return;
      const found = findTask(focusModeTaskId);
      if (!found) {
        exitFocusMode();
        return;
      }

      focusModeEl.hidden = false;
      focusTaskEl.innerHTML = `
        <div class="focus-mode__text" contenteditable="true" spellcheck="true" data-focus-task-text="${found.item.id}">${escapeHtml(found.item.text)}</div>
        <div class="focus-mode__children">${renderFocusChildren(found.item.children || [])}</div>
      `;
      renderFocusTimer();
    }

    function enterFocusMode(taskId = null) {
      const node = taskId ? { kind: "task", id: taskId } : selectedNode;
      if (!node || node.kind !== "task") return false;
      const found = findTask(node.id);
      if (!found) return false;
      if (focusModeTaskId && focusModeStartedAt) stopFocusTimer();
      focusModeTaskId = node.id;
      setSingleSelection(node);
      renderFocusMode();
      startFocusTimer();
      return true;
    }

    function exitFocusMode() {
      stopFocusTimer();
      focusModeTaskId = null;
      if (focusModeEl) focusModeEl.hidden = true;
      if (focusTaskEl) focusTaskEl.innerHTML = "";
      renderSelection();
    }

    function toggleFocusMode() {
      if (focusModeTaskId) {
        exitFocusMode();
        return false;
      }
      return enterFocusMode();
    }

    boardEl.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      const groupRow = event.target.closest("[data-group-row]");
      const row = event.target.closest("[data-task-row]");
      if (groupRow) selectNode("group", groupRow.dataset.groupRow);
      if (row) selectTask(row.dataset.taskRow);
      if (!button) return;

      const action = button.dataset.action;
      if (action === "toggle-task") toggleTask(button.dataset.taskId);
      if (action === "toggle-done") {
        const found = findTask(button.dataset.taskId);
        if (found) found.item.done = !found.item.done;
        saveState();
        render();
      }
      if (action === "delete-task") deleteTask(button.dataset.taskId);
      if (action === "add-child") addTask(button.dataset.groupId, button.dataset.taskId);
      if (action === "add-task") addTask(button.dataset.groupId);
      if (action === "toggle-group") toggleGroup(button.dataset.groupId);
      if (action === "focus-task") selectTask(button.dataset.taskId);
    });

    boardEl.addEventListener("input", (event) => {
      const textEl = event.target.closest("[data-task-text]");
      const groupTitle = event.target.closest("[data-group-title]");
      if (textEl) {
        updateTaskTextFromEditable(textEl.dataset.taskText, textEl);
      }
      if (groupTitle) {
        const group = findGroup(groupTitle.dataset.groupTitle);
        if (group) {
          group.title = groupTitle.textContent.trim() || "Untitled group";
          saveState();
          renderNav();
        }
      }
    });

    boardEl.addEventListener("paste", (event) => {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return;
      const pasted = event.clipboardData?.getData("text/plain")?.trim() || "";
      if (!/^https?:\/\/\S+$/i.test(pasted)) return;
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || selection.isCollapsed || !selectionContainsEditableContents(textEl)) return;
      const label = selection.toString();
      if (!label) return;
      event.preventDefault();
      insertTextAtSelection(`[${label}](${pasted})`, textEl);
    });

    boardEl.addEventListener("focusout", (event) => {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return;
      const found = findTask(textEl.dataset.taskText);
      if (found) textEl.innerHTML = renderInlineMarkdown(found.item.text);
    });

    boardEl.addEventListener("change", (event) => {
      const colorInput = event.target.closest("[data-group-color]");
      if (!colorInput) return;
      changeGroupColor(colorInput.dataset.groupColor, colorInput.value);
    });

    boardEl.addEventListener("focusin", (event) => {
      if (suppressFocusSelection) return;
      const groupRow = event.target.closest("[data-group-row]");
      const row = event.target.closest("[data-task-row]");
      if (groupRow) selectNode("group", groupRow.dataset.groupRow);
      if (row) selectTask(row.dataset.taskRow);
    });

    boardEl.addEventListener("dragstart", (event) => {
      if (event.target.matches("input, [contenteditable='true']")) return;
      const source = event.target.closest("[data-drag-kind]");
      if (!source) return;
      const kind = source.dataset.dragKind;
      const id = kind === "group" ? source.dataset.groupRow : source.dataset.taskRow;
      if (!id) return;
      draggedNode = { kind, id };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(draggedNode));
      source.classList.add("dragging");
      if (kind === "group") boardEl.classList.add("is-dragging-group");
      selectNode(kind, id);
    });

    boardEl.addEventListener("dragend", () => {
      document.querySelectorAll(".dragging").forEach((element) => element.classList.remove("dragging"));
      clearDropIndicators();
      stopDragAutoScroll();
      boardEl.classList.remove("is-dragging-group");
      draggedNode = null;
    });

    boardEl.addEventListener("dragover", (event) => {
      if (draggedNode) updateDragAutoScroll(event.clientY);
      const instruction = getDropInstruction(event);
      if (!canDropOn(instruction)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = event.ctrlKey && draggedNode?.kind === "task" ? "copy" : "move";
      showDropInstruction(instruction);
    });

    boardEl.addEventListener("drop", (event) => {
      const instruction = getDropInstruction(event);
      if (!canDropOn(instruction)) return;
      event.preventDefault();
      applyDropInstruction(instruction, event);
      stopDragAutoScroll();
      draggedNode = null;
    });

    boardEl.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || touchDrag) return;
      const handle = event.target.closest("[data-touch-drag]");
      const source = handle?.closest("[data-drag-kind]") || (handle?.matches("[data-drag-kind]") ? handle : null);
      if (!source) return;
      touchDrag = {
        pointerId: event.pointerId,
        source,
        startX: event.clientX,
        startY: event.clientY,
        armed: false,
        instruction: null,
        timer: window.setTimeout?.(armTouchDrag, LONG_PRESS_MS),
      };
    });

    boardEl.addEventListener("pointermove", (event) => {
      if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
      if (!touchDrag.armed) {
        if (shouldCancelLongPress(touchDrag.startX, touchDrag.startY, event.clientX, event.clientY)) clearTouchDrag();
        return;
      }
      event.preventDefault();
      updateDragAutoScroll(event.clientY);
      const target = document.elementFromPoint?.(event.clientX, event.clientY);
      const instruction = target ? getDropInstruction({ target, clientY: event.clientY }) : null;
      touchDrag.instruction = canDropOn(instruction) ? instruction : null;
      if (touchDrag.instruction) showDropInstruction(touchDrag.instruction);
    });

    boardEl.addEventListener("pointerup", (event) => finishTouchDrag(event));
    boardEl.addEventListener("pointercancel", (event) => finishTouchDrag(event, true));

    navEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-nav-target]");
      if (!button) return;
      document.getElementById(button.dataset.navTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      navEl.querySelectorAll(".active").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });

    focusTaskEl?.addEventListener("input", (event) => {
      const target = event.target.closest("[data-focus-task-text]");
      if (!target) return;
      const found = findTask(target.dataset.focusTaskText);
      if (!found) return;
      found.item.text = target.textContent.trim();
      saveState();
      render();
    });

    focusButtonEl?.addEventListener("click", toggleFocusMode);
    focusExitEl?.addEventListener("click", exitFocusMode);
    window.addEventListener?.("beforeunload", () => stopFocusTimer());
    darkModeEl?.addEventListener("change", () => toggleDarkMode(darkModeEl.checked));
    exportBoardEl?.addEventListener("click", downloadBoardState);
    importBoardEl?.addEventListener("click", () => importFileEl?.click());
    importFileEl?.addEventListener("change", (event) => {
      handleImportFile(event.target.files?.[0]);
      event.target.value = "";
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || boardEl.contains(button)) return;
      if (button.dataset.action === "add-group") addGroup();
      if (button.dataset.action === "expand-all") setEveryCollapsed(false);
      if (button.dataset.action === "collapse-all") setEveryCollapsed(true);
      if (button.dataset.action === "reset") {
        localStorage.removeItem(STORAGE_KEY);
        state = normalizeState(seedState());
        selectedNode = null;
        multiSelectedNodes = [];
        selectionAnchorNode = null;
        undoStack = [];
        undoActions = [];
        lastUndoAction = null;
        exitFocusMode();
        render();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && focusModeTaskId) {
        event.preventDefault();
        exitFocusMode();
        return;
      }

      const isEditingText = event.target.matches("[contenteditable='true']");
      if (isEditingText && event.key === "Enter" && event.shiftKey) {
        insertEditingLineBreak(event);
        return;
      }

      if (isEditingText && event.key === "Tab") {
        event.preventDefault();
        const moved = event.shiftKey ? outdentSelectedNode() : indentSelectedNode();
        if (moved && selectedNode?.kind === "task") focusTaskText(selectedNode.id, false);
        return;
      }

      if (isEditingText && event.key === "Enter") {
        event.preventDefault();
        splitEditingTask(event);
        return;
      }

      if (isEditingText && (event.key === "Backspace" || event.key === "Delete")) {
        if (handleEditingBackspaceDelete(event)) return;
        return;
      }

      if (event.key.toLowerCase() === "z" && event.ctrlKey) {
        if (shouldUseBoardUndo(isEditingText)) {
          event.preventDefault();
          restoreUndoState();
        }
        return;
      }

      if (event.key.toLowerCase() === "f" && event.shiftKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (isEditingText && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) return;

      if (event.target.matches("input") && !event.altKey) return;

      const visible = getVisibleNodes();
      if (!visible.length) return;
      const currentIndex = visible.findIndex((node) => node.kind === selectedNode?.kind && node.id === selectedNode?.id);
      const index = Math.max(0, currentIndex);

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        insertSiblingBelowSelectedNode();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        if (event.shiftKey) {
          outdentSelectedNode();
        } else {
          indentSelectedNode();
        }
        return;
      }

      if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        deleteSelectedNodes();
        return;
      }

      if (event.key.toLowerCase() === "d" && event.ctrlKey && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        const node = selectedNode || getVisibleNodes()[0];
        if (node?.kind === "task") copyTaskToDoingNow(node.id);
        return;
      }

      if (event.key === "ArrowUp" && event.ctrlKey && !event.altKey) {
        event.preventDefault();
        toggleSelectedNodes(true);
        return;
      }

      if (event.key === "ArrowDown" && event.ctrlKey && !event.altKey) {
        event.preventDefault();
        toggleSelectedNodes(false);
        return;
      }

      if (event.key === "ArrowUp" && event.altKey && !event.ctrlKey) {
        event.preventDefault();
        moveSelectedNodes(-1);
        return;
      }

      if (event.key === "ArrowDown" && event.altKey && !event.ctrlKey) {
        event.preventDefault();
        moveSelectedNodes(1);
        return;
      }

      if (event.key === "ArrowUp" && event.shiftKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        selectNode(visible[Math.max(0, index - 1)], null, { extend: true });
        return;
      }

      if (event.key === "ArrowDown" && event.shiftKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        selectNode(visible[Math.min(visible.length - 1, index + 1)], null, { extend: true });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectionAnchorNode = null;
        selectNode(visible[Math.max(0, index - 1)]);
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectionAnchorNode = null;
        selectNode(visible[Math.min(visible.length - 1, index + 1)]);
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        startEditingSelectedNode(event.key);
      }
    });

    searchEl.addEventListener("input", render);

    applyTheme(loadTheme());
    updateClock();
    if (typeof window.setInterval === "function") window.setInterval(updateClock, 30000);
    render();
    selectedNode = getVisibleNodes()[0] || null;
    if (selectedNode) selectNode(selectedNode);

    window.taskBoardTestApi = {
      get state() {
        return state;
      },
      getTaskSplitPlan,
      splitTaskAtOffset,
      applyUrlPasteToText,
      renderInlineMarkdown,
      getMarkdownTextFromEditable,
      shouldCancelLongPress,
      armTouchDrag,
      finishTouchDrag,
      moveTask,
      ensureDoingNowGroup,
      cloneTaskTree,
      copyTaskToDoingNow,
      deleteTask,
      toggleTask,
      toggleGroup,
      moveGroup,
      normalizeState,
      migrateState,
      ensureResearchTask,
      DEFAULT_SETTINGS,
      changeGroupColor,
      toggleSelectedNode,
      toggleSelectedNodes,
      getVisibleNodes,
      getSelectedNodes,
      selectNode,
      moveSelectedNode,
      moveSelectedNodes,
      moveNodeInList,
      deleteSelectedNodes,
      deleteTaskAndSelectNeighbor,
      deleteTaskIfEmpty,
      updateTaskTextFromEditable,
      getNeighborAfterDelete,
      isEditableTextEmpty,
      handleEditingBackspaceDelete,
      insertSiblingBelowSelectedNode,
      insertSiblingBelowNode,
      indentTask,
      outdentTask,
      indentSelectedNode,
      outdentSelectedNode,
      startEditingSelectedNode,
      insertTextAtSelection,
      selectionContainsEditableContents,
      replaceEditableContents,
      pushUndoState,
      discardUndoState,
      restoreUndoState,
      shouldUseBoardUndo,
      loadStateFromLocalStorage,
      saveStateToLocalStorage,
      getBoardExportPayload,
      serializeBoardState,
      downloadBoardState,
      importBoardStateFromJson,
      handleImportFile,
      loadTheme,
      applyTheme,
      toggleDarkMode,
      formatClockTime,
      updateClock,
      updateDragAutoScroll,
      stopDragAutoScroll,
      enterFocusMode,
      exitFocusMode,
      renderFocusMode,
      toggleFocusMode,
      formatFocusSeconds,
      getFocusElapsedSeconds,
      addFocusElapsedSeconds,
      stopFocusTimer,
      renderFocusTimer,
      focusSelectedTextField,
      insertEditingLineBreak,
      addTask,
      reset() {
        localStorage.removeItem(STORAGE_KEY);
        state = migrateState(seedState());
        selectedNode = null;
        multiSelectedNodes = [];
        selectionAnchorNode = null;
        undoStack = [];
        undoActions = [];
        lastUndoAction = null;
        exitFocusMode();
        render();
      },
    };
