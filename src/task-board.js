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
      sidebarWidth: 280,
      username: "",
    });
    const AUTO_SCROLL_EDGE_PX = 96;
    const MAX_AUTO_SCROLL_SPEED = 18;
    const LONG_PRESS_MS = 420;
    const LONG_PRESS_MOVE_PX = 12;
    const DURATION_UNIT_SECONDS = Object.freeze({ seconds: 1, minutes: 60, hours: 3600, days: 86400 });
    const SCHEDULE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
    const TIMELINE_START_HOUR = 6;
    const TIMELINE_END_HOUR = 24;
    const TIMELINE_SNAP_MINUTES = 15;
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
    const sidebarToggleEl = document.querySelector("[data-sidebar-toggle]");
    const sidebarBackdropEl = document.querySelector("[data-sidebar-backdrop]");
    const viewsNavEl = document.querySelector("[data-views-nav]");
    const viewsTimelineNavEl = document.querySelector("[data-views-timeline]");
    const searchEl = document.querySelector("[data-search]");
    const exportBoardEl = document.querySelector("[data-export-board]");
    const importBoardEl = document.querySelector("[data-import-board]");
    const importFileEl = document.querySelector("[data-import-file]");
    const clockEl = document.querySelector("[data-clock]");
    const darkModeEl = document.querySelector("[data-dark-mode]");
    const pasteModeEl = document.querySelector("[data-paste-mode]");
    const completionModeEl = document.querySelector("[data-completion-mode]");
    const completionValueEl = document.querySelector("[data-completion-value]");
    const completionUnitEl = document.querySelector("[data-completion-unit]");
    const completionDurationEl = document.querySelector("[data-completion-duration]");
    const deleteModeEl = document.querySelector("[data-delete-mode]");
    const trashModeEl = document.querySelector("[data-trash-mode]");
    const trashValueEl = document.querySelector("[data-trash-value]");
    const trashUnitEl = document.querySelector("[data-trash-unit]");
    const trashDurationEl = document.querySelector("[data-trash-duration]");
    const trashModeRowEl = document.querySelector("[data-trash-mode-row]");
    const exportCompletedEl = document.querySelector("[data-export-completed]");
    const exportTrashEl = document.querySelector("[data-export-trash]");
    const policyOverridesEl = document.querySelector("[data-policy-overrides]");
    const featureMetadataEl = document.querySelector("[data-feature-metadata]");
    const featureTimelineEl = document.querySelector("[data-feature-timeline]");
    const featureRemindersEl = document.querySelector("[data-feature-reminders]");
    const featureNotificationsEl = document.querySelector("[data-feature-notifications]");
    const viewToggleEl = document.querySelector("[data-view-toggle]");
    const viewListEl = document.querySelector("[data-view-list]");
    const viewTimelineEl = document.querySelector("[data-view-timeline]");
    const timelineDateEl = document.querySelector("[data-timeline-date]");
    const taskDetailsHostEl = document.querySelector("[data-task-details-host]");
    const boardSplitEl = document.querySelector("[data-board-split]");
    const mainEl = document.querySelector("main");
    const sidebarResizerEl = document.querySelector("[data-sidebar-resizer]");
    const timelinePaneEl = document.querySelector("[data-timeline-pane]");
    const historyListEl = document.querySelector("[data-history-list]");
    const historyMenuEl = document.querySelector("[data-history-menu]");
    const usernameEl = document.querySelector("[data-username]");
    const exportSettingsEl = document.querySelector("[data-export-settings]");
    const lightboxEl = document.querySelector("[data-lightbox]");
    const lightboxImgEl = document.querySelector("[data-lightbox-img]");
    const toastEl = document.querySelector("[data-toast]");
    const focusModeEl = document.querySelector("[data-focus-mode]");
    const focusButtonEl = document.querySelector("[data-focus-button]");
    const focusExitEl = document.querySelector("[data-focus-exit]");
    const focusTaskEl = document.querySelector("[data-focus-task]");
    const focusTimerEl = document.querySelector("[data-focus-timer]");
    const focusClockEl = document.querySelector("[data-focus-clock]");
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
    let internalClipboard = null;
    let lifecycleSignature = "";
    let announcedReminders = new Set();
    let pendingGroupDelete = null;
    let focusModeGroupId = null;
    let showList = true;
    let showTimeline = false;
    let timelineDate = localDateString();
    let timelineDrag = null;
    let toastTimer = null;
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
        images: Array.isArray(options.images) ? options.images : [],
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
      const value = formatClockTime(date);
      if (clockEl) clockEl.textContent = value;
      if (focusClockEl) focusClockEl.textContent = value;
      return value;
    }

    function getBoardExportPayload() {
      return {
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        state: getExportState(),
      };
    }

    function getExportState() {
      const includeCompleted = state.settings.exportCompleted !== false;
      const groups = state.groups.map((group) => ({
        ...group,
        tasks: filterTasksForExport(group.tasks, includeCompleted),
      }));
      return JSON.parse(JSON.stringify({
        ...state,
        settings: undefined,
        groups,
        trash: state.settings.exportTrash ? state.trash : [],
      }));
    }

    function filterTasksForExport(tasks, includeCompleted) {
      return (tasks || []).flatMap((placement) => {
        const item = resolveTaskItem(placement);
        if (!includeCompleted && item?.done) return [];
        return [{
          ...placement,
          children: filterTasksForExport(placement.children || [], includeCompleted),
        }];
      });
    }

    function serializeBoardState() {
      return JSON.stringify(getBoardExportPayload(), null, 2);
    }

    function importBoardStateFromJson(jsonText) {
      const payload = JSON.parse(jsonText);
      if (payload?.kind === "punchlist-settings" && payload.settings && typeof payload.settings === "object") {
        pushUndoState("board", `Imported settings${payload.exportedBy ? ` from ${payload.exportedBy}` : ""}`);
        state.settings = { ...DEFAULT_SETTINGS, ...payload.settings };
        saveState();
        syncSettingsControls();
        applySidebarWidth();
        render();
        showToast("Settings imported.");
        return true;
      }
      const importedState = payload?.state || payload;
      if (!importedState || !Array.isArray(importedState.groups)) {
        throw new Error("Imported file must contain a state.groups array.");
      }
      if (focusModeTaskId) exitFocusMode();
      pushUndoState("board", "Imported a board from JSON");
      const currentSettings = state.settings;
      state = migrateState(importedState, new Date().toISOString(), { includeResearch: false });
      state.settings = { ...DEFAULT_SETTINGS, ...currentSettings };
      selectedNode = getVisibleNodes()[0] || null;
      multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
      selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      saveState();
      render();
      return true;
    }

    function downloadJsonFile(filename, text) {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function downloadBoardState() {
      downloadJsonFile(`punchlist-board-${new Date().toISOString().slice(0, 10)}.json`, serializeBoardState());
    }

    function downloadSettingsExport() {
      const name = String(state.settings.username || "").trim();
      const payload = {
        kind: "punchlist-settings",
        exportedBy: name || null,
        exportedAt: new Date().toISOString(),
        settings: { ...state.settings },
      };
      const slug = name ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-` : "";
      downloadJsonFile(`punchlist-settings-${slug}${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
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

    const HISTORY_LABELS = {
      board: "Changed the board",
      delete: "Deleted items",
      complete: "Toggled a task",
      move: "Moved items",
      split: "Edited the outline",
      restore: "Restored items",
      link: "Pasted linked items",
      color: "Changed a group color",
      paste: "Pasted tasks",
      collapse: "",
    };

    function shortText(value, max = 34) {
      const text = String(value || "").trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    function logHistory(text, kind = "board") {
      if (!Array.isArray(state.history)) state.history = [];
      state.history.push({ at: new Date().toISOString(), text: String(text), kind });
      if (state.history.length > 50) state.history.shift();
    }

    function pushUndoState(action = "board", detail = null) {
      const label = detail || (action in HISTORY_LABELS ? HISTORY_LABELS[action] : "Changed the board");
      if (label) logHistory(label, action);
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

    function resolveTaskItem(item, visited = new Set()) {
      if (!item?.targetTaskId || !["alias", "reference"].includes(item.linkType)) return item;
      if (visited.has(item.id)) return item;
      visited.add(item.id);
      const target = findTask(item.targetTaskId)?.item;
      return target ? resolveTaskItem(target, visited) : item;
    }

    function getTaskItem(id) {
      const found = findTask(id);
      return found ? resolveTaskItem(found.item) : null;
    }

    function walkPlacements(tasks, callback) {
      (tasks || []).forEach((item) => {
        callback(item);
        walkPlacements(item.children, callback);
      });
    }

    function getLinkCount(taskId) {
      let count = 0;
      state.groups.forEach((group) => walkPlacements(group.tasks, (item) => {
        if (item.targetTaskId === taskId && ["alias", "reference"].includes(item.linkType)) count += 1;
      }));
      return count;
    }

    function createLinkedTaskTree(sourceItem, linkType = "alias", groupId = null, parentId = null) {
      const source = resolveTaskItem(sourceItem);
      if (!source || !["alias", "reference"].includes(linkType)) return null;
      const linked = task(source.text, [], {
        createdInGroupId: groupId,
        createdUnderTaskId: parentId,
      });
      linked.linkType = linkType;
      linked.targetTaskId = source.id;
      linked.collapsed = Boolean(sourceItem?.collapsed);
      linked.children = linkType === "alias"
        ? (source.children || []).map((child) => createLinkedTaskTree(child, "alias", groupId, linked.id))
        : [];
      return linked;
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
      const source = resolveTaskItem(item);
      return {
        id: createId("task"),
        text: source.text,
        done: Boolean(source.done),
        completedAt: source.completedAt || null,
        collapsed: Boolean(item.collapsed),
        focusSeconds: Math.max(0, Math.floor(Number(source.focusSeconds) || 0)),
        plannedMinutes: source.plannedMinutes || null,
        schedule: source.schedule ? { ...source.schedule } : null,
        reminderAt: source.reminderAt || null,
        createdAt: new Date().toISOString(),
        createdInGroupId: null,
        createdUnderTaskId: null,
        children: (source.children || []).map(cloneTaskTree),
      };
    }

    function insertPastedItems(items, targetNode) {
      if (!items.length || !targetNode) return [];
      if (targetNode.kind === "group") {
        const group = findGroup(targetNode.id);
        if (!group) return [];
        items.forEach((item) => {
          item.createdInGroupId ||= group.id;
          group.tasks.push(item);
        });
        return items;
      }
      const target = findTask(targetNode.id);
      if (!target) return [];
      items.forEach((item, offset) => target.list.splice(target.index + 1 + offset, 0, item));
      return items;
    }

    function pasteTaskIds(taskIds, targetNode, mode = state.settings.pasteMode) {
      const sources = [...new Set(taskIds || [])].map((id) => findTask(id)).filter(Boolean);
      if (!sources.length || !targetNode) return [];
      const targetItem = targetNode.kind === "task" ? resolveTaskItem(findTask(targetNode.id)?.item) : null;
      if (targetItem && sources.some((found) => {
        const sourceItem = resolveTaskItem(found.item);
        return sourceItem.id === targetItem.id || isDescendant(sourceItem, targetItem.id);
      })) return [];
      const normalizedMode = ["alias", "reference", "duplicate", "move"].includes(mode) ? mode : "alias";
      pushUndoState(normalizedMode === "move" ? "move" : "paste");

      let items;
      if (normalizedMode === "move") {
        items = sources.map((found) => removeTask(found.item.id)).filter(Boolean);
      } else if (normalizedMode === "duplicate") {
        items = sources.map((found) => cloneTaskTree(found.item));
      } else {
        const targetGroupId = targetNode.kind === "group" ? targetNode.id : findTask(targetNode.id)?.group?.id;
        items = sources.map((found) => createLinkedTaskTree(found.item, normalizedMode, targetGroupId)).filter(Boolean);
      }

      const inserted = insertPastedItems(items, targetNode);
      if (!inserted.length) {
        discardUndoState();
        return [];
      }
      setSingleSelection({ kind: "task", id: inserted[0].id });
      saveState();
      render();
      return inserted;
    }

    function tasksToMarkdown(tasks, depth = 0) {
      return (tasks || []).flatMap((placement) => {
        const item = resolveTaskItem(placement);
        const line = `${"  ".repeat(depth)}- ${item?.text || ""}`;
        const children = placement.linkType === "reference"
          ? []
          : (placement.children?.length ? placement.children : item?.children || []);
        const nested = tasksToMarkdown(children, depth + 1);
        return nested ? [line, nested] : [line];
      }).join("\n");
    }

    function parseMarkdownTasks(markdown, groupId = null) {
      const roots = [];
      const stack = [];
      String(markdown || "").split(/\r?\n/).forEach((line) => {
        const match = line.match(/^(\s*)[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/);
        if (!match) return;
        const spaces = match[1].replace(/\t/g, "  ").length;
        const depth = Math.floor(spaces / 2);
        const parent = depth > 0 ? stack[depth - 1] : null;
        const item = task(match[2].trim(), [], {
          createdInGroupId: groupId,
          createdUnderTaskId: parent?.id || null,
        });
        if (parent) parent.children.push(item);
        else roots.push(item);
        stack[depth] = item;
        stack.length = depth + 1;
      });
      return roots;
    }

    function getSelectedTaskRoots(nodes = getSelectedNodes()) {
      const selectedIds = new Set(nodes.filter((node) => node.kind === "task").map((node) => node.id));
      return nodes.filter((node) => {
        if (node.kind !== "task") return false;
        let parent = findTask(node.id)?.parent;
        while (parent) {
          if (selectedIds.has(parent.id)) return false;
          parent = findTask(parent.id)?.parent;
        }
        return true;
      }).map((node) => findTask(node.id)?.item).filter(Boolean);
    }

    function selectedNodesToMarkdown(nodes = getSelectedNodes()) {
      const groupIds = new Set(nodes.filter((node) => node.kind === "group").map((node) => node.id));
      const groups = [...groupIds].map((id) => findGroup(id)).filter(Boolean);
      const tasks = getSelectedTaskRoots(nodes)
        .filter((item) => !groupIds.has(findTask(item.id)?.group?.id));
      const sections = groups.map((group) => `## ${group.title}\n\n${tasksToMarkdown(group.tasks)}`);
      if (tasks.length) sections.push(tasksToMarkdown(tasks));
      return sections.join("\n\n").trim();
    }

    function rememberInternalClipboard(mode = "copy") {
      const nodes = getSelectedNodes();
      const markdown = selectedNodesToMarkdown(nodes);
      if (!markdown) return null;
      const groupIds = new Set(nodes.filter((node) => node.kind === "group").map((node) => node.id));
      const tasks = getSelectedTaskRoots(nodes)
        .filter((item) => !groupIds.has(findTask(item.id)?.group?.id));
      internalClipboard = {
        mode,
        taskIds: tasks.map((item) => item.id),
        markdown,
      };
      return internalClipboard;
    }

    function resolvePasteMode() {
      if (internalClipboard?.mode === "cut") return "move";
      if (state.settings.pasteMode !== "ask") return state.settings.pasteMode;
      const answer = window.prompt?.("Paste as: linked (stays in sync), shortcut (jumps to original), or duplicate?", "linked")?.toLowerCase();
      const modes = { linked: "alias", alias: "alias", shortcut: "reference", reference: "reference", duplicate: "duplicate" };
      return modes[answer] || "alias";
    }

    function pasteExternalMarkdown(markdown, targetNode = selectedNode) {
      if (!targetNode) return [];
      const groupId = targetNode.kind === "group" ? targetNode.id : findTask(targetNode.id)?.group?.id;
      const items = parseMarkdownTasks(markdown, groupId);
      if (!items.length) return [];
      pushUndoState("paste");
      const inserted = insertPastedItems(items, targetNode);
      if (!inserted.length) {
        discardUndoState();
        return [];
      }
      setSingleSelection({ kind: "task", id: inserted[0].id });
      saveState();
      render();
      return inserted;
    }

    function removeTask(id) {
      const found = findTask(id);
      if (!found) return null;
      const [removed] = found.list.splice(found.index, 1);
      return removed;
    }

    function hasOwn(object, key) {
      return Boolean(object && Object.prototype.hasOwnProperty.call(object, key));
    }

    function durationToSeconds(value, unit) {
      const amount = Math.max(0, Math.floor(Number(value) || 0));
      return amount * (DURATION_UNIT_SECONDS[unit] || 1);
    }

    function secondsToDurationParts(seconds) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      for (const unit of ["days", "hours", "minutes"]) {
        const factor = DURATION_UNIT_SECONDS[unit];
        if (total >= factor && total % factor === 0) return { value: total / factor, unit };
      }
      return { value: total, unit: "seconds" };
    }

    function localDateString(date = new Date()) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function describeRelativeDate(dateStr, now = new Date()) {
      if (!SCHEDULE_DATE_PATTERN.test(String(dateStr || ""))) return "";
      const [year, month, day] = String(dateStr).split("-").map(Number);
      const target = new Date(year, month - 1, day);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.round((target - today) / 86400000);
      if (days === 0) return "today";
      if (days === 1) return "tomorrow";
      if (days === -1) return "yesterday";
      return days > 0 ? `in ${days} days` : `${-days} days ago`;
    }

    function describeRelativeDateTime(value, now = new Date()) {
      const at = Date.parse(value);
      if (!Number.isFinite(at)) return "";
      const target = new Date(at);
      const dayLabel = describeRelativeDate(localDateString(target), now);
      const time = `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`;
      return dayLabel ? `${dayLabel} at ${time}` : time;
    }

    function timelineTimeFromOffset(offsetPx) {
      const maxOffset = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60 - TIMELINE_SNAP_MINUTES;
      const snapped = Math.min(maxOffset, Math.max(0, Math.round((Number(offsetPx) || 0) / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES));
      const total = TIMELINE_START_HOUR * 60 + snapped;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }

    function setTaskSchedule(id, patch = {}) {
      const found = findTask(id);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      const clean = (value) => (value === "" || value === undefined ? null : value);
      const current = item.schedule || {};
      const nextDate = hasOwn(patch, "date") ? clean(patch.date) : current.date ?? null;
      const nextStart = hasOwn(patch, "startTime") ? clean(patch.startTime) : current.startTime ?? null;
      if (nextDate !== null && !SCHEDULE_DATE_PATTERN.test(String(nextDate))) return false;
      if (nextStart !== null && !SCHEDULE_TIME_PATTERN.test(String(nextStart))) return false;
      let nextPlanned = item.plannedMinutes;
      if (hasOwn(patch, "plannedMinutes")) {
        const raw = clean(patch.plannedMinutes);
        if (raw === null) nextPlanned = null;
        else {
          const minutes = Number(raw);
          if (!Number.isFinite(minutes) || minutes <= 0) return false;
          nextPlanned = Math.round(minutes);
        }
      }
      let nextReminder = item.reminderAt;
      if (hasOwn(patch, "reminderAt")) {
        const raw = clean(patch.reminderAt);
        if (raw !== null && !Number.isFinite(Date.parse(raw))) return false;
        nextReminder = raw;
      }
      item.schedule = nextDate === null && nextStart === null ? null : { date: nextDate, startTime: nextStart };
      item.plannedMinutes = nextPlanned;
      if (nextReminder !== item.reminderAt) {
        item.reminderAt = nextReminder;
        announcedReminders.delete(item.id);
      }
      saveState();
      return true;
    }

    function getTimelineEntries(date) {
      const scheduled = [];
      const unscheduled = [];
      function walk(tasks, group) {
        (tasks || []).forEach((placement) => {
          if (!placement.linkType && placement.schedule?.date === date) {
            if (placement.schedule.startTime) {
              const [hours, minutes] = placement.schedule.startTime.split(":").map(Number);
              scheduled.push({
                item: placement,
                group,
                startMinutes: hours * 60 + minutes,
                durationMinutes: Number(placement.plannedMinutes) > 0 ? Number(placement.plannedMinutes) : null,
              });
            } else {
              unscheduled.push({ item: placement, group });
            }
          }
          walk(placement.children, group);
        });
      }
      state.groups.forEach((group) => walk(group.tasks, group));
      scheduled.sort((a, b) => a.startMinutes - b.startMinutes);
      return { scheduled, unscheduled };
    }

    function getEffortVariance(item) {
      const planned = Number(item?.plannedMinutes);
      if (!Number.isFinite(planned) || planned <= 0) return null;
      const focus = Math.max(0, Number(item?.focusSeconds) || 0);
      const seconds = focus - planned * 60;
      const minutes = Math.round(Math.abs(seconds) / 60);
      const label = seconds === 0 ? "0m" : `${seconds > 0 ? "+" : "-"}${minutes}m`;
      return { seconds, label };
    }

    function isReminderDue(placement, now = Date.now()) {
      const item = resolveTaskItem(placement);
      if (!item || item.done || !item.reminderAt) return false;
      const at = Date.parse(item.reminderAt);
      return Number.isFinite(at) && now >= at;
    }

    function getDueReminders(now = Date.now()) {
      if (!state.settings.reminders) return [];
      const due = [];
      function walk(tasks, group) {
        (tasks || []).forEach((placement) => {
          if (!placement.linkType && isReminderDue(placement, now) && !announcedReminders.has(placement.id)) {
            announcedReminders.add(placement.id);
            due.push({ item: placement, group });
          }
          walk(placement.children, group);
        });
      }
      state.groups.forEach((group) => walk(group.tasks, group));
      return due;
    }

    function setPolicyOverride(kind, id, key, value) {
      const target = kind === "group" ? findGroup(id) : findTask(id)?.item;
      if (!target) return false;
      if (!target.policyOverrides || typeof target.policyOverrides !== "object") target.policyOverrides = {};
      if (value === undefined) delete target.policyOverrides[key];
      else target.policyOverrides[key] = value;
      saveState();
      render();
      return true;
    }

    function resolveLifecyclePolicy(item, group, key) {
      if (hasOwn(item?.policyOverrides, key)) return item.policyOverrides[key];
      const resolved = item ? resolveTaskItem(item) : null;
      if (resolved !== item && hasOwn(resolved?.policyOverrides, key)) return resolved.policyOverrides[key];
      if (hasOwn(group?.policyOverrides, key)) return group.policyOverrides[key];
      return state.settings[key];
    }

    function isTaskHiddenFromActive(item, group, now = Date.now()) {
      const resolved = resolveTaskItem(item);
      if (!resolved?.done || !resolved.completedAt) return false;
      const retention = resolveLifecyclePolicy(item, group, "completionRetentionSeconds");
      if (retention === null || retention === "never") return false;
      const seconds = Math.max(0, Number(retention) || 0);
      const completedAt = Date.parse(resolved.completedAt);
      return Number.isFinite(completedAt) && now >= completedAt + seconds * 1000;
    }

    function animateRowsAway(taskIds, done) {
      const rows = taskIds
        .map((id) => document.querySelector(`[data-task-row="${id}"]`))
        .filter(Boolean);
      if (!rows.length || typeof window.setTimeout !== "function") {
        done();
        return;
      }
      rows.forEach((row) => {
        row.style.maxHeight = `${row.offsetHeight}px`;
        row.classList.add("vanishing");
        const shrink = () => {
          row.style.maxHeight = "0px";
        };
        if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(shrink);
        else shrink();
      });
      window.setTimeout(done, 250);
    }

    function setTaskCompleted(id, done, now = new Date().toISOString(), options = {}) {
      const found = findTask(id);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      const nextDone = Boolean(done);
      if (item.done === nextDone && (nextDone ? Boolean(item.completedAt) : !item.completedAt)) return false;
      if (options.pushUndo !== false) pushUndoState("complete", `${nextDone ? "Completed" : "Reopened"} "${shortText(item.text)}"`);
      item.done = nextDone;
      item.completedAt = nextDone ? now : null;
      if (options.save !== false) saveState();
      if (options.render !== false) {
        if (nextDone && isTaskHiddenFromActive(found.item, found.group)) {
          animateRowsAway([found.item.id], render);
        } else {
          render();
        }
      }
      return true;
    }

    function restoreCompletedTask(id) {
      return setTaskCompleted(id, false);
    }

    function deleteTaskWithPolicy(id, now = new Date().toISOString(), options = {}) {
      const found = findTask(id);
      if (!found) return null;
      const resolved = resolveTaskItem(found.item);
      const deleteMode = options.deleteMode || resolveLifecyclePolicy(found.item, found.group, "deleteMode") || "trash";
      const retention = resolveLifecyclePolicy(found.item, found.group, "trashRetentionSeconds");
      if (options.pushUndo !== false) pushUndoState("delete", `Deleted "${shortText(resolved?.text || found.item.text)}"`);
      const source = {
        groupId: found.group?.id || null,
        parentId: found.parent?.id || null,
        index: found.index,
      };
      const removed = removeTask(id);
      let record = null;
      if (removed && deleteMode !== "permanent") {
        record = {
          id: createId("trash"),
          kind: "task",
          item: removed,
          deletedAt: now,
          wasCompleted: Boolean(resolved?.done),
          retentionSeconds: retention === null || retention === "never"
            ? null
            : Math.max(0, Number(retention) || 0),
          source,
        };
        state.trash.push(record);
      }
      if (options.save !== false) saveState();
      if (options.render !== false) render();
      return record;
    }

    function restoreTrashRecord(recordId) {
      const index = state.trash.findIndex((record) => record.id === recordId);
      if (index < 0) return false;
      pushUndoState("restore");
      const [record] = state.trash.splice(index, 1);
      if (record.kind === "group") {
        state.groups.splice(Math.min(record.source?.index ?? state.groups.length, state.groups.length), 0, record.item);
      } else {
        let list = null;
        if (record.source?.parentId) list = findTask(record.source.parentId)?.item?.children;
        if (!list) list = findGroup(record.source?.groupId)?.tasks;
        if (!list) {
          let restored = findGroup("group-restored");
          if (!restored) {
            restored = {
              id: "group-restored",
              title: "Restored",
              color: "#64748b",
              collapsed: false,
              createdAt: new Date().toISOString(),
              tasks: [],
            };
            state.groups.push(restored);
          }
          list = restored.tasks;
        }
        list.splice(Math.min(record.source?.index ?? list.length, list.length), 0, record.item);
      }
      saveState();
      render();
      return true;
    }

    function purgeTrashRecord(recordId) {
      const index = state.trash.findIndex((record) => record.id === recordId);
      if (index < 0) return false;
      pushUndoState("purge");
      state.trash.splice(index, 1);
      saveState();
      render();
      return true;
    }

    function purgeExpiredTrash(now = Date.now()) {
      const before = state.trash.length;
      state.trash = state.trash.filter((record) => {
        if (record.retentionSeconds === null || record.retentionSeconds === "never") return true;
        const deletedAt = Date.parse(record.deletedAt);
        return !Number.isFinite(deletedAt) || now < deletedAt + Math.max(0, Number(record.retentionSeconds) || 0) * 1000;
      });
      const removed = before - state.trash.length;
      if (removed) saveState();
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
      pushUndoState("move", `Copied "${shortText(resolveTaskItem(found.item)?.text)}" to the day group`);
      const group = ensureDoingNowGroup();
      const pasteMode = ["alias", "reference", "duplicate"].includes(state.settings.pasteMode)
        ? state.settings.pasteMode
        : "alias";
      const copy = pasteMode === "duplicate"
        ? cloneTaskTree(found.item)
        : createLinkedTaskTree(found.item, pasteMode, group.id);
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
      pushUndoState("move", `Moved "${shortText(resolveTaskItem(source.item)?.text)}"`);
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
      pushUndoState("move", `Moved group "${shortText(state.groups[sourceIndex].title)}"`);
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

    function deleteTaskAndSelectNeighbor(id, options = {}) {
      const found = findTask(id);
      if (!found) return false;
      const node = { kind: "task", id };
      const target = getNeighborAfterDelete(node, getVisibleNodes(), collectDeletedNodeKeys([node]));
      pushUndoState("delete");
      deleteTaskWithPolicy(id, new Date().toISOString(), {
        pushUndo: false,
        save: false,
        render: false,
        deleteMode: options.forcePermanent ? "permanent" : undefined,
      });
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
      pushUndoState("collapse");
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
      pushUndoState("collapse");
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
      pushUndoState("move");
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

    function deleteSelectedNodes(nodes = getSelectedNodes(), options = {}) {
      if (!nodes.length) return;
      const groupsToDelete = nodes.filter((node) => node.kind === "group");
      if (groupsToDelete.length && !options.confirmed) {
        pendingGroupDelete = { nodes: nodes.map((node) => ({ ...node })), groupId: groupsToDelete[0].id };
        render();
        document.querySelector('[data-action="confirm-delete"]')?.focus();
        return;
      }
      pendingGroupDelete = null;
      const firstGroup = groupsToDelete.length ? findGroup(groupsToDelete[0].id) : null;
      let deleteLabel = `Deleted ${nodes.length} items`;
      if (nodes.length === 1 && firstGroup) deleteLabel = `Deleted group "${shortText(firstGroup.title)}"`;
      else if (nodes.length === 1 && nodes[0].kind === "task") {
        const single = findTask(nodes[0].id);
        deleteLabel = `Deleted "${shortText(resolveTaskItem(single?.item)?.text || "")}"` ;
      }
      pushUndoState("delete", deleteLabel);
      const visibleBeforeDelete = getVisibleNodes();
      const deletedKeys = collectDeletedNodeKeys(nodes);

      nodes.filter((node) => node.kind === "group").forEach((node) => {
        const index = state.groups.findIndex((group) => group.id === node.id);
        if (index < 0) return;
        const [group] = state.groups.splice(index, 1);
        if (state.settings.deleteMode !== "permanent") {
          state.trash.push({
            id: createId("trash"),
            kind: "group",
            item: group,
            deletedAt: new Date().toISOString(),
            wasCompleted: false,
            retentionSeconds: state.settings.trashRetentionSeconds,
            source: { index },
          });
        }
      });

      nodes.filter((node) => node.kind === "task").forEach((node) => {
        deleteTaskWithPolicy(node.id, new Date().toISOString(), {
          pushUndo: false,
          save: false,
          render: false,
        });
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
      pushUndoState("collapse");

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
      (mainEl || window).scrollBy({ top: autoScrollVelocity, behavior: "auto" });
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
      pushUndoState("board", "Added a task");

      if (node.kind === "group") {
        const group = findGroup(node.id);
        if (!group) {
          discardUndoState();
          return null;
        }
        const item = task("New task", [], { createdInGroupId: group.id });
        group.tasks.unshift(item);
        group.collapsed = false;
        setSingleSelection({ kind: "task", id: item.id });
        saveState();
        render();
        return item;
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
      if (!inserted) return inserted;
      focusTaskText(inserted.id);
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
        const resolvedParent = resolveTaskItem(parent.item);
        resolvedParent.children = resolvedParent.children || [];
        resolvedParent.children.push(item);
        if (parent.item.linkType === "alias") {
          parent.item.children = parent.item.children || [];
          parent.item.children.push(createLinkedTaskTree(item, "alias", groupId, parent.item.id));
        }
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

      function walk(tasks, group) {
        tasks.forEach((item) => {
          if (isTaskHiddenFromActive(item, group)) return;
          if (taskMatchesFilter(item, query)) nodes.push({ kind: "task", id: item.id });
          if (!item.collapsed || query) walk(item.children || [], group);
        });
      }

      state.groups.forEach((group) => {
        const groupMatches = !query || group.title.toLowerCase().includes(query) || group.tasks.some((item) => taskMatchesFilter(item, query));
        if (!groupMatches) return;
        nodes.push({ kind: "group", id: group.id });
        if (!group.collapsed || query) walk(group.tasks, group);
      });
      if (!query) {
        nodes.push({ kind: "section", id: "completed" });
        nodes.push({ kind: "section", id: "trash" });
      }
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
      if (node.kind === "section") return node.id === "completed" || node.id === "trash";
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

    function renderSelection(forceFocus = false) {
      document.querySelectorAll(".selected").forEach((row) => row.classList.remove("selected"));
      getSelectedNodes().forEach((node) => getNodeRow(node)?.classList.add("selected"));
      if (taskDetailsHostEl && !taskDetailsHostEl.contains(document.activeElement)) {
        taskDetailsHostEl.innerHTML = renderDetailsPanel();
      }
      if (timelinePaneEl && !timelinePaneEl.hidden && !timelineDrag) {
        timelinePaneEl.innerHTML = renderTimelineSection(timelineDate);
      }

      const row = getNodeRow(selectedNode);
      if (row) {
        const active = document.activeElement;
        const focusIsElsewhere = !forceFocus && active && active !== document.body && !boardEl.contains(active) && !row.contains(active);
        if (!focusIsElsewhere && active !== row && !row.contains(active)) {
          suppressFocusSelection = true;
          row.focus({ preventScroll: true });
          suppressFocusSelection = false;
        }
        if (!focusIsElsewhere) row.scrollIntoView({ block: "nearest" });
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
      return deleteTaskAndSelectNeighbor(id, { forcePermanent: true });
    }

    function updateTaskTextFromEditable(id, valueOrElement) {
      const found = findTask(id);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      item.text = getMarkdownTextFromEditable(valueOrElement);
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
      deleteTaskAndSelectNeighbor(textEl.dataset.taskText, { forcePermanent: true });
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
      let hasContentAfter = false;
      for (let node = lineBreak.nextSibling; node; node = node.nextSibling) {
        if ((node.textContent || "").length || node.tagName === "BR") {
          hasContentAfter = true;
          break;
        }
      }
      if (!hasContentAfter) {
        lineBreak.parentNode.insertBefore(document.createElement("br"), lineBreak.nextSibling);
      }
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
        link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
        reference: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
        plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
        sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
      };
      return icons[name] || "";
    }

    function describeGlobalCompletionPolicy() {
      const retention = state.settings.completionRetentionSeconds;
      if (retention === null) return "keep visible";
      if (Number(retention) === 0) return "hide right away";
      const parts = secondsToDurationParts(retention);
      return `hide after ${parts.value} ${parts.value === 1 ? parts.unit.replace(/s$/, "") : parts.unit}`;
    }

    function renderPolicyMenu(kind, id, overrides) {
      if (!state.settings.policyOverrides) return "";
      const active = overrides && typeof overrides === "object" ? overrides : {};
      const completion = hasOwn(active, "completionRetentionSeconds")
        ? (active.completionRetentionSeconds === null ? "never" : Number(active.completionRetentionSeconds) === 0 ? "immediate" : "custom")
        : "default";
      const deleteMode = hasOwn(active, "deleteMode") ? active.deleteMode : "default";
      const hasOverride = completion !== "default" || deleteMode !== "default";
      const globalDelete = state.settings.deleteMode === "permanent" ? "delete permanently" : "to Trash";
      return `
        <details class="policy-menu">
          <summary class="icon-button ${hasOverride ? "has-override" : ""}" title="Lifecycle overrides for this ${kind}" aria-label="Lifecycle overrides for this ${kind}">${renderIcon("sliders")}</summary>
          <div class="policy-panel">
            <label>Completed
              <select data-policy-completion data-policy-kind="${kind}" data-policy-id="${id}" aria-label="Completed visibility override">
                <option value="default"${completion === "default" ? " selected" : ""}>Use global (${describeGlobalCompletionPolicy()})</option>
                <option value="never"${completion === "never" ? " selected" : ""}>Keep visible</option>
                <option value="immediate"${completion === "immediate" ? " selected" : ""}>Hide right away</option>
                ${completion === "custom" ? '<option value="custom" selected>Custom duration</option>' : ""}
              </select>
            </label>
            <label>Delete
              <select data-policy-delete data-policy-kind="${kind}" data-policy-id="${id}" aria-label="Delete policy override">
                <option value="default"${deleteMode === "default" ? " selected" : ""}>Use global (${globalDelete})</option>
                <option value="trash"${deleteMode === "trash" ? " selected" : ""}>To Trash</option>
                <option value="permanent"${deleteMode === "permanent" ? " selected" : ""}>Permanent</option>
              </select>
            </label>
          </div>
        </details>
      `;
    }

    function getTaskOriginLabel(taskId) {
      const found = findTask(taskId);
      return found?.group?.title || "original task";
    }

    function renderTaskLinkBadge(placement, resolved) {
      if (placement.linkType) {
        const label = placement.linkType === "alias" ? "Linked copy" : "Shortcut";
        return `<button class="placement-badge ${placement.linkType}" type="button" data-action="go-origin" data-origin-task-id="${resolved?.id || placement.targetTaskId}" title="${label} of task in ${escapeHtml(getTaskOriginLabel(resolved?.id || placement.targetTaskId))}" aria-label="${label}; jump to original">${renderIcon(placement.linkType === "alias" ? "link" : "reference")}</button>`;
      }
      const count = resolved ? getLinkCount(resolved.id) : 0;
      return count
        ? `<span class="placement-badge original" title="Linked in ${count} other ${count === 1 ? "place" : "places"}" aria-label="Linked elsewhere">${renderIcon("link")}</span>`
        : "";
    }

    function buildGroupPalette(color) {
      return {
        color,
        bg: `color-mix(in srgb, ${color} 8%, white)`,
        selected: `color-mix(in srgb, ${color} 18%, white)`,
        border: `color-mix(in srgb, ${color} 36%, white)`,
        ink: `color-mix(in srgb, ${color} 70%, black)`,
        darkBg: `color-mix(in srgb, ${color} 16%, #1c1f1d)`,
        darkSelected: `color-mix(in srgb, ${color} 30%, #1c1f1d)`,
        darkBorder: `color-mix(in srgb, ${color} 42%, #1c1f1d)`,
        darkInk: `color-mix(in srgb, ${color} 45%, #f1f4ef)`,
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
      boardState.history = Array.isArray(boardState.history) ? boardState.history.slice(-50) : [];
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
      item.images = Array.isArray(item.images)
        ? item.images
          .filter((img) => img && typeof img.src === "string" && img.src.startsWith("data:image/"))
          .map((img) => ({
            id: typeof img.id === "string" ? img.id : createId("img"),
            src: img.src,
            width: Number(img.width) > 0 ? Math.round(Number(img.width)) : 260,
          }))
        : [];
      item.linkType = ["alias", "reference"].includes(item.linkType) ? item.linkType : null;
      item.targetTaskId = item.linkType && typeof item.targetTaskId === "string" ? item.targetTaskId : null;
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
        `--group-dark-bg: ${palette.darkBg}`,
        `--group-dark-selected: ${palette.darkSelected}`,
        `--group-dark-border: ${palette.darkBorder}`,
        `--group-dark-ink: ${palette.darkInk}`,
      ].join("; ");
    }

    function taskMatchesFilter(item, query) {
      const resolved = resolveTaskItem(item);
      if (!query) return true;
      if ((resolved?.text || "").toLowerCase().includes(query)) return true;
      return (item.children || []).some((child) => taskMatchesFilter(child, query));
    }

    function renderTask(item, groupId, query) {
      const group = findGroup(groupId);
      if (isTaskHiddenFromActive(item, group)) return "";
      if (!taskMatchesFilter(item, query)) return "";
      const resolved = resolveTaskItem(item);
      const children = item.linkType === "reference" ? [] : (item.children || []);
      const hasChildren = children.length > 0;
      const expanded = hasChildren && (!item.collapsed || Boolean(query));
      const childHtml = expanded
        ? `<ul class="child-list">${children.map((child) => renderTask(child, groupId, query)).join("")}</ul>`
        : "";
      const dropChild = hasChildren
        ? `<div class="drop-zone child" data-drop-target="${item.id}" data-position="child" aria-hidden="true"></div>`
        : "";
      const images = resolved?.images || [];
      const imagesHtml = images.length && !item.linkType
        ? `<div class="task-images">${images.map((img) => `
            <span class="task-image">
              <span class="image-handle" data-image-handle="left" data-image-id="${img.id}" data-image-task="${resolved.id}" title="Drag to resize"></span>
              <img src="${img.src}" style="width: ${Math.max(60, Number(img.width) || 260)}px" alt="Pasted image" draggable="false">
              <span class="image-handle" data-image-handle="right" data-image-id="${img.id}" data-image-task="${resolved.id}" title="Drag to resize"></span>
              <button class="image-remove" type="button" data-image-remove="${img.id}" data-image-task="${resolved.id}" title="Remove image" aria-label="Remove image">×</button>
            </span>`).join("")}</div>`
        : "";

      return `
        <li class="task" data-task="${item.id}">
          <div class="drop-zone" data-drop-target="${item.id}" data-position="before" aria-hidden="true"></div>
          <div class="task-row ${resolved?.done ? "done" : ""} ${item.linkType ? `linked ${item.linkType}` : ""} ${isSelected("task", item.id) ? "selected" : ""}" data-task-row="${item.id}" data-node-kind="task" data-node-id="${item.id}" data-drag-kind="task" draggable="true" tabindex="0">
            <button class="chevron ${hasChildren ? "" : "hidden"}" type="button" data-action="toggle-task" data-task-id="${item.id}" aria-label="${expanded ? "Collapse" : "Expand"} task" aria-expanded="${expanded ? "true" : "false"}">
              ${renderIcon("chevron")}
            </button>
            <button class="checkbox ${resolved?.done ? "done" : ""}" type="button" data-action="toggle-done" data-task-id="${item.id}" aria-label="${resolved?.done ? "Mark not done" : "Mark done"}">
              ${resolved?.done ? renderIcon("check") : ""}
            </button>
            <div class="task-text" data-task-text="${item.id}" contenteditable="true" spellcheck="true">${renderInlineMarkdown(resolved?.text || item.text)}</div>
            ${renderTaskLinkBadge(item, resolved)}
            <div class="task-actions">
              ${item.linkType ? "" : renderPolicyMenu("task", item.id, item.policyOverrides)}
              <button class="icon-button drag-handle" type="button" data-action="focus-task" data-task-id="${item.id}" data-touch-drag aria-label="Drag task; hold on touch screens">${renderIcon("grip")}</button>
              <button class="icon-button" type="button" data-action="add-child" data-task-id="${item.id}" data-group-id="${groupId}" aria-label="Add subtask">${renderIcon("plus")}</button>
              <button class="icon-button" type="button" data-action="delete-task" data-task-id="${item.id}" aria-label="Delete task">${renderIcon("trash")}</button>
            </div>
          </div>
          ${imagesHtml}
          ${childHtml}
          ${dropChild}
          <div class="drop-zone" data-drop-target="${item.id}" data-position="after" aria-hidden="true"></div>
        </li>
      `;
    }

    function renderGroup(group, query, index) {
      const visibleTasks = group.tasks.map((item) => renderTask(item, group.id, query)).join("");
      const count = countTasks(group.tasks);
      const empty = visibleTasks.trim() ? "" : '<p class="empty">No tasks match this search.</p>';
      const palette = getGroupPalette(group, index);
      const collapsed = group.collapsed && !query;
      return `
        <article class="group" id="${group.id}" data-group-card="${group.id}" style="${groupStyleVars(group, index)}">
          <header class="group-header ${isSelected("group", group.id) ? "selected" : ""}" data-group-row="${group.id}" data-node-kind="group" data-node-id="${group.id}" data-drag-kind="group" data-touch-drag draggable="true" tabindex="0">
            <div class="group-heading">
              <button class="chevron" type="button" data-action="toggle-group" data-group-id="${group.id}" aria-label="${collapsed ? "Expand" : "Collapse"} group" aria-expanded="${collapsed ? "false" : "true"}">${renderIcon("chevron")}</button>
              <div class="group-title" data-group-title="${group.id}" contenteditable="true" spellcheck="true">${escapeHtml(group.title)}</div>
              <span class="group-count">${count}</span>
            </div>
            <div class="group-tools">
              ${pendingGroupDelete?.groupId === group.id ? `
                <span class="delete-confirm" data-delete-confirm role="alertdialog" aria-label="Confirm deletion">
                  <span class="delete-confirm-text">Delete ${pendingGroupDelete.nodes.length > 1 ? `${pendingGroupDelete.nodes.length} selected items` : "this group"}?</span>
                  <button class="control compact danger" type="button" data-action="confirm-delete">Delete</button>
                  <button class="control compact" type="button" data-action="cancel-delete">Cancel</button>
                </span>` : ""}
              ${renderPolicyMenu("group", group.id, group.policyOverrides)}
              <input class="color-picker" type="color" value="${palette.color}" data-group-color="${group.id}" aria-label="Change group color">
              <button class="icon-button" type="button" data-action="add-task" data-group-id="${group.id}" aria-label="Add task">${renderIcon("plus")}</button>
            </div>
          </header>
          <ul class="task-list ${collapsed ? "is-hidden" : ""}" data-group-list="${group.id}">
            ${visibleTasks}
            <li class="drop-zone child" data-drop-target="${group.id}" data-position="group" aria-hidden="true"></li>
          </ul>
          ${collapsed ? "" : empty}
        </article>
      `;
    }

    function renderHistoryList() {
      if (!historyListEl || !historyMenuEl?.open) return;
      const today = localDateString();
      historyListEl.innerHTML = (state.history || []).slice().reverse().map((entry) => {
        const at = new Date(Date.parse(entry.at));
        const valid = Number.isFinite(at.getTime());
        const label = valid
          ? (localDateString(at) === today
            ? formatClockTime(at)
            : at.toLocaleDateString([], { month: "short", day: "numeric" }))
          : "";
        const fullStamp = valid
          ? `${at.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} ${formatClockTime(at)}:${String(at.getSeconds()).padStart(2, "0")}`
          : "Unknown time";
        const kindLabel = entry.kind && entry.kind !== "board" ? ` · ${entry.kind}` : "";
        return `
          <details class="history-row">
            <summary><span class="disclosure-arrow" aria-hidden="true"></span><span class="history-time">${label}</span><span class="history-text">${escapeHtml(entry.text)}</span></summary>
            <div class="history-detail">${escapeHtml(fullStamp)}${escapeHtml(kindLabel)}</div>
          </details>`;
      }).join("") || '<p class="empty">No changes recorded yet.</p>';
    }

    function getCompletedEntries(now = Date.now()) {
      const entries = [];
      const seen = new Set();
      function walk(tasks, group, ancestorHidden = false) {
        (tasks || []).forEach((placement) => {
          const item = resolveTaskItem(placement);
          const hidden = isTaskHiddenFromActive(placement, group, now);
          if (hidden && !ancestorHidden && !placement.linkType && item && !seen.has(item.id)) {
            seen.add(item.id);
            entries.push({ item, placement, group });
          }
          walk(placement.children, group, ancestorHidden || hidden);
        });
      }
      state.groups.forEach((group) => walk(group.tasks, group));
      return entries;
    }

    function renderLifecycleSections() {
      const completed = getCompletedEntries();
      const completedRows = completed.length
        ? completed.map(({ item, group }) => `
          <div class="lifecycle-row" tabindex="0">
            <span class="lifecycle-task">${renderInlineMarkdown(item.text)}</span>
            <span class="lifecycle-context">${escapeHtml(group.title)}</span>
            <button class="control compact" type="button" data-action="restore-completed" data-task-id="${item.id}">Restore</button>
          </div>
        `).join("")
        : '<p class="empty">No completed tasks are hidden.</p>';
      const trashRows = state.trash.length
        ? state.trash.map((record) => {
          const label = record.kind === "group"
            ? record.item.title
            : (resolveTaskItem(record.item)?.text || record.item.text || "Deleted task");
          return `
            <div class="lifecycle-row" tabindex="0">
              <span class="lifecycle-task">${renderInlineMarkdown(label)}</span>
              <span class="lifecycle-context">${record.wasCompleted ? "Completed and deleted" : "Deleted"}</span>
              <button class="control compact" type="button" data-action="restore-trash" data-trash-id="${record.id}">Restore</button>
              <button class="control compact danger" type="button" data-action="purge-trash" data-trash-id="${record.id}">Purge</button>
            </div>
          `;
        }).join("")
        : '<p class="empty">Trash is empty.</p>';
      return `
        <div class="lifecycle-sections">
          <details class="lifecycle-section" data-completed-section>
            <summary data-section-row="completed" data-node-kind="section" data-node-id="completed" tabindex="0" class="${isSelected("section", "completed") ? "selected" : ""}">Completed</summary>
            <div class="lifecycle-list">${completedRows}</div>
          </details>
          <details class="lifecycle-section" data-trash-section>
            <summary data-section-row="trash" data-node-kind="section" data-node-id="trash" tabindex="0" class="${isSelected("section", "trash") ? "selected" : ""}">Trash</summary>
            <div class="lifecycle-list">${trashRows}</div>
          </details>
        </div>
      `;
    }

    function getTaskLocationLabel(found) {
      const parts = [found.group?.title || "Board"];
      if (found.parent) {
        const parentText = resolveTaskItem(found.parent)?.text || found.parent.text || "";
        parts.push(parentText.length > 34 ? `${parentText.slice(0, 33)}…` : parentText);
      }
      return parts.join(" › ");
    }

    function renderTaskDetailsPanel(taskId = selectedNode && selectedNode.kind === "task" ? selectedNode.id : null) {
      if (!state.settings.metadata || !taskId) return "";
      const found = findTask(taskId);
      if (!found) return "";
      const item = resolveTaskItem(found.item);
      const schedule = item.schedule || {};
      const createdDate = item.createdAt ? localDateString(new Date(Date.parse(item.createdAt))) : "";
      const createdLabel = createdDate ? describeRelativeDate(createdDate) : "";
      const variance = getEffortVariance(item);
      const effort = state.settings.focusTiming
        ? `<span class="details-effort" title="Accumulated focus time compared with the planned effort">Focused ${formatFocusSeconds(item.focusSeconds || 0)}${variance ? ` · ${variance.label} vs plan` : ""}</span>`
        : "";
      const reminder = state.settings.reminders
        ? `
          <label class="details-field">
            <span class="details-field-name">Remind</span>
            <input type="datetime-local" data-task-reminder value="${escapeHtml(item.reminderAt || "")}" aria-label="Reminder time">
            <small class="details-hint" data-reminder-hint>${describeRelativeDateTime(item.reminderAt)}</small>
          </label>`
        : "";
      return `
        <section class="task-details" data-task-details="${item.id}" aria-label="Selected task details">
          <div class="details-head">
            <span class="details-crumb" title="Where this task lives">${escapeHtml(getTaskLocationLabel(found))}</span>
            ${createdLabel ? `<span class="details-meta" title="Created ${escapeHtml(createdDate)}">created ${escapeHtml(createdLabel)}</span>` : ""}
            <span class="details-id" title="Immutable task ID">${escapeHtml(item.id)}</span>
          </div>
          <div class="details-fields">
            <label class="details-field">
              <span class="details-field-name">Date</span>
              <input type="date" data-task-date value="${escapeHtml(schedule.date || "")}" aria-label="Scheduled date">
              <small class="details-hint" data-date-hint>${describeRelativeDate(schedule.date)}</small>
            </label>
            <label class="details-field">
              <span class="details-field-name">Start</span>
              <input type="time" data-task-start value="${escapeHtml(schedule.startTime || "")}" aria-label="Start time">
              <small class="details-hint"></small>
            </label>
            <label class="details-field">
              <span class="details-field-name">Planned</span>
              <input type="number" min="5" step="5" inputmode="numeric" data-task-planned value="${item.plannedMinutes || ""}" aria-label="Planned minutes">
              <small class="details-hint">minutes</small>
            </label>
            ${reminder}
            ${effort}
          </div>
        </section>
      `;
    }

    function renderGroupDetailsPanel(groupId = selectedNode && selectedNode.kind === "group" ? selectedNode.id : null) {
      if (!state.settings.metadata || !groupId) return "";
      const group = findGroup(groupId);
      if (!group) return "";
      const index = state.groups.findIndex((entry) => entry.id === group.id);
      const total = countTasks(group.tasks);
      return `
        <section class="task-details" data-group-details="${group.id}" aria-label="Selected group details">
          <div class="details-head">
            <span class="details-crumb">${escapeHtml(group.title)} · group ${index + 1} of ${state.groups.length}</span>
            <span class="details-meta">${total} task${total === 1 ? "" : "s"}</span>
            <span class="details-id" title="Immutable group ID">${escapeHtml(group.id)}</span>
          </div>
        </section>
      `;
    }

    function renderDetailsPanel() {
      if (!state.settings.metadata || !selectedNode) return "";
      if (selectedNode.kind === "task") return renderTaskDetailsPanel(selectedNode.id);
      if (selectedNode.kind === "group") return renderGroupDetailsPanel(selectedNode.id);
      return "";
    }

    function renderTimelineSection(date = timelineDate) {
      if (!state.settings.timelineView) return "";
      const entries = getTimelineEntries(date);
      const startOfDay = TIMELINE_START_HOUR * 60;
      const dayMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
      let hours = "";
      for (let hour = TIMELINE_START_HOUR; hour < TIMELINE_END_HOUR; hour += 1) {
        hours += `<div class="timeline-hour" style="top: ${(hour - TIMELINE_START_HOUR) * 60}px"><span>${String(hour).padStart(2, "0")}:00</span></div>`;
      }
      const now = new Date();
      const nowOffset = now.getHours() * 60 + now.getMinutes() - startOfDay;
      const nowLine = localDateString(now) === date && nowOffset >= 0 && nowOffset <= dayMinutes
        ? `<div class="timeline-now" data-timeline-now style="top: ${nowOffset}px" aria-hidden="true"></div>`
        : "";
      const blocks = entries.scheduled.map(({ item, group, startMinutes, durationMinutes }) => {
        const top = Math.max(0, Math.min(dayMinutes - 26, startMinutes - startOfDay));
        const height = durationMinutes ? Math.max(26, durationMinutes) : 26;
        const resolved = resolveTaskItem(item);
        return `
          <div class="timeline-block ${durationMinutes ? "" : "compact"} ${isSelected("task", item.id) ? "selected" : ""}" data-timeline-block="${item.id}" tabindex="0" style="top: ${top}px; height: ${height}px; ${groupStyleVars(group, state.groups.indexOf(group))}" title="${escapeHtml(group.title)} — drag to reschedule; Alt+arrows nudge by 15 minutes">
            <span class="timeline-block-time">${item.schedule.startTime}${durationMinutes ? ` · ${durationMinutes}m` : ""}</span>
            <span class="timeline-block-text">${renderInlineMarkdown(resolved?.text || item.text)}</span>
            <span class="timeline-block-group">${escapeHtml(group.title)}</span>
          </div>
        `;
      }).join("");
      const unscheduled = entries.unscheduled.length
        ? entries.unscheduled.map(({ item, group }) => {
          const resolved = resolveTaskItem(item);
          return `
            <div class="timeline-unscheduled-item" data-timeline-unscheduled="${item.id}" tabindex="0" style="${groupStyleVars(group, state.groups.indexOf(group))}" title="Scheduled for this day without a start time — select it and set a start time">
              <span class="timeline-block-text">${renderInlineMarkdown(resolved?.text || item.text)}</span>
              <span class="timeline-block-group">${escapeHtml(group.title)}</span>
            </div>
          `;
        }).join("")
        : '<p class="empty">Nothing is waiting for a time slot.</p>';
      return `
        <section class="timeline" data-timeline aria-label="Day timeline">
          <div class="timeline-day" data-timeline-day style="height: ${dayMinutes}px">
            ${hours}
            ${nowLine}
            ${blocks}
          </div>
          <div class="timeline-unscheduled" data-timeline-unscheduled-list>
            <h3>Waiting for a time</h3>
            ${unscheduled}
          </div>
        </section>
      `;
    }

    function showToast(message) {
      if (!toastEl) return;
      toastEl.textContent = message;
      toastEl.hidden = false;
      toastEl.classList.add("visible");
      if (toastTimer !== null && typeof window.clearTimeout === "function") window.clearTimeout(toastTimer);
      if (typeof window.setTimeout === "function") {
        toastTimer = window.setTimeout(() => {
          toastEl.classList.remove("visible");
          toastEl.hidden = true;
          toastTimer = null;
        }, 4200);
      }
    }

    function checkDueReminders(now = Date.now()) {
      if (!state.settings.reminders) return;
      getDueReminders(now).forEach(({ item }) => {
        const resolved = resolveTaskItem(item);
        const text = resolved?.text || item.text || "Task reminder";
        showToast(`Reminder: ${text}`);
        if (state.settings.browserNotifications && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Task reminder", { body: text });
          } catch {
            /* notifications unavailable in this context */
          }
        }
      });
    }

    function getLifecycleSignature(now = Date.now()) {
      return `${getCompletedEntries(now).map(({ item }) => item.id).sort().join(",")}|${state.trash.map((record) => record.id).sort().join(",")}`;
    }

    function runLifecycleMaintenance(now = Date.now()) {
      purgeExpiredTrash(now);
      const nextSignature = getLifecycleSignature(now);
      if (nextSignature === lifecycleSignature) return false;
      const previousCompleted = new Set(lifecycleSignature.split("|")[0].split(",").filter(Boolean));
      const newlyHidden = nextSignature.split("|")[0].split(",").filter((id) => id && !previousCompleted.has(id));
      lifecycleSignature = nextSignature;
      if (newlyHidden.length) animateRowsAway(newlyHidden, render);
      else render();
      return true;
    }

    function render() {
      const query = searchEl.value.trim().toLowerCase();
      if (!state.settings.timelineView) showTimeline = false;
      if (!showList && !showTimeline) showList = true;
      document.body?.classList.toggle("app-sidebar-collapsed", Boolean(state.settings.sidebarCollapsed));
      if (viewsTimelineNavEl) {
        viewsTimelineNavEl.hidden = !state.settings.timelineView;
        viewsTimelineNavEl.classList.toggle("active", showTimeline && state.settings.timelineView);
      }
      viewsNavEl?.querySelector('[data-view-nav="board"]')?.classList.toggle("active", showList);
      if (viewToggleEl) {
        viewToggleEl.hidden = !state.settings.timelineView;
        viewListEl?.classList.toggle("active", showList);
        viewTimelineEl?.classList.toggle("active", showTimeline);
        if (timelineDateEl) {
          timelineDateEl.hidden = !showTimeline;
          timelineDateEl.value = timelineDate;
        }
      }
      if (taskDetailsHostEl) taskDetailsHostEl.innerHTML = renderDetailsPanel();
      if (boardSplitEl) boardSplitEl.classList.toggle("with-timeline", showTimeline && showList);
      if (timelinePaneEl) {
        timelinePaneEl.hidden = !showTimeline;
        timelinePaneEl.innerHTML = showTimeline ? renderTimelineSection(timelineDate) : "";
      }
      boardEl.hidden = !showList;
      renderHistoryList();
      if (!showList) {
        lifecycleSignature = getLifecycleSignature();
        return;
      }
      const firstGroup = state.groups[0];
      const topDrop = firstGroup
        ? `<div class="group-top-drop" data-board-top-drop data-drop-target="${firstGroup.id}" data-drop-kind="group" data-position="before" aria-label="Move group to top"></div>`
        : "";
      boardEl.innerHTML = topDrop
        + state.groups.map((group, index) => renderGroup(group, query, index)).join("")
        + renderLifecycleSections();
      lifecycleSignature = getLifecycleSignature();
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
        html += `<a class="task-link" data-task-link href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Ctrl+Click to open"${autoLink}>${escapeHtml(label)}</a>`;
        cursor = pattern.lastIndex;
      }
      return html + escapeHtml(source.slice(cursor)).replace(/\n/g, "<br>");
    }

    function renderFocusChildren(tasks, depth = 0) {
      const visible = (tasks || []).filter((item) => {
        const resolved = resolveTaskItem(item);
        return (resolved?.text || item.text || "").trim() || (item.children || []).length;
      });
      if (!visible.length) return "";
      const items = visible.map((item) => {
        const resolved = resolveTaskItem(item);
        const done = Boolean(resolved?.done);
        return `
        <li style="margin-left: ${depth * 18}px" class="${done ? "focus-child-done" : ""}">
          <button class="focus-child-check ${done ? "done" : ""}" type="button" data-focus-toggle="${resolved?.id || item.id}" aria-label="${done ? "Mark not done" : "Mark done"}">${done ? renderIcon("check") : ""}</button>
          <span class="focus-child-text" contenteditable="true" spellcheck="true" data-focus-task-text="${resolved?.id || item.id}">${renderInlineMarkdown(resolved?.text || item.text)}</span>
          ${renderFocusChildren(item.children || [], depth + 1)}
        </li>
      `;
      }).join("");
      return `<ul class="focus-outline">${items}</ul>`;
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
      if (!focusModeEl || !focusTaskEl) return;
      if (focusModeGroupId) {
        const group = findGroup(focusModeGroupId);
        if (!group) {
          exitFocusMode();
          return;
        }
        focusModeEl.hidden = false;
        focusModeEl.classList.add("group-focus");
        if (focusTimerEl) focusTimerEl.hidden = true;
        focusTaskEl.innerHTML = `
          <div class="focus-mode__text focus-mode__group-title">${escapeHtml(group.title)}</div>
          <div class="focus-mode__children">${renderFocusChildren(group.tasks) || '<p class="empty">This group is empty.</p>'}</div>
        `;
        return;
      }
      if (!focusModeTaskId) return;
      const found = findTask(focusModeTaskId);
      if (!found) {
        exitFocusMode();
        return;
      }

      focusModeEl.hidden = false;
      focusModeEl.classList.remove("group-focus");
      if (focusTimerEl) focusTimerEl.hidden = false;
      const item = resolveTaskItem(found.item);
      focusTaskEl.innerHTML = `
        <div class="focus-mode__text" contenteditable="true" spellcheck="true" data-focus-task-text="${item.id}">${renderInlineMarkdown(item.text)}</div>
        <div class="focus-mode__children">${renderFocusChildren(item.children || [])}</div>
      `;
      renderFocusTimer();
    }

    function enterFocusMode(taskId = null) {
      const node = taskId ? { kind: "task", id: taskId } : selectedNode;
      if (!node) return false;
      if (node.kind === "group") return enterGroupFocusMode(node.id);
      if (node.kind !== "task") return false;
      const found = findTask(node.id);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      if (focusModeTaskId && focusModeStartedAt) stopFocusTimer();
      focusModeTaskId = item.id;
      focusModeGroupId = null;
      setSingleSelection(node);
      renderFocusMode();
      startFocusTimer();
      return true;
    }

    function enterGroupFocusMode(groupId) {
      const group = findGroup(groupId);
      if (!group) return false;
      if (focusModeTaskId && focusModeStartedAt) stopFocusTimer();
      focusModeTaskId = null;
      focusModeGroupId = group.id;
      setSingleSelection({ kind: "group", id: group.id });
      renderFocusMode();
      return true;
    }

    function exitFocusMode() {
      stopFocusTimer();
      focusModeTaskId = null;
      focusModeGroupId = null;
      if (focusModeEl) {
        focusModeEl.hidden = true;
        focusModeEl.classList.remove("group-focus");
      }
      if (focusTaskEl) focusTaskEl.innerHTML = "";
      if (focusTimerEl) focusTimerEl.hidden = false;
      renderSelection();
    }

    function toggleFocusMode() {
      if (focusModeTaskId || focusModeGroupId) {
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
        const item = found ? resolveTaskItem(found.item) : null;
        if (item) setTaskCompleted(button.dataset.taskId, !item.done);
      }
      if (action === "go-origin") {
        const id = button.dataset.originTaskId;
        selectNode("task", id);
        getNodeRow({ kind: "task", id })?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (action === "delete-task") deleteTask(button.dataset.taskId);
      if (button.dataset.imageRemove) {
        const found = findTask(button.dataset.imageTask);
        if (found) {
          const item = resolveTaskItem(found.item);
          pushUndoState("delete", "Removed an image");
          item.images = (item.images || []).filter((img) => img.id !== button.dataset.imageRemove);
          saveState();
          render();
        }
        return;
      }
      if (action === "confirm-delete" && pendingGroupDelete) {
        deleteSelectedNodes(pendingGroupDelete.nodes, { confirmed: true });
        return;
      }
      if (action === "cancel-delete") {
        pendingGroupDelete = null;
        render();
        return;
      }
      if (action === "restore-completed") restoreCompletedTask(button.dataset.taskId);
      if (action === "restore-trash") restoreTrashRecord(button.dataset.trashId);
      if (action === "purge-trash") purgeTrashRecord(button.dataset.trashId);
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
        }
      }
    });

    function compressImageFile(file, maxWidth = 800) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const image = new Image();
          image.onload = () => {
            const scale = Math.min(1, maxWidth / (image.naturalWidth || maxWidth));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
            canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            let output = canvas.toDataURL("image/webp", 0.8);
            if (!output.startsWith("data:image/webp")) output = canvas.toDataURL("image/jpeg", 0.82);
            resolve(output.length < String(reader.result).length ? output : String(reader.result));
          };
          image.onerror = reject;
          image.src = String(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function attachImageToTask(taskId, file) {
      compressImageFile(file).then((src) => {
        const found = findTask(taskId);
        if (!found) return;
        const item = resolveTaskItem(found.item);
        pushUndoState("board", "Pasted an image");
        item.images = Array.isArray(item.images) ? item.images : [];
        item.images.push({ id: createId("img"), src, width: 260 });
        saveState();
        render();
      }).catch(() => showToast("That image could not be read."));
    }

    boardEl.addEventListener("paste", (event) => {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return;
      const imageFile = [...(event.clipboardData?.files || [])].find((file) => file.type?.startsWith("image/"));
      if (imageFile) {
        event.preventDefault();
        attachImageToTask(textEl.dataset.taskText, imageFile);
        return;
      }
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
      if (found) textEl.innerHTML = renderInlineMarkdown(resolveTaskItem(found.item).text);
    });

    boardEl.addEventListener("change", (event) => {
      const colorInput = event.target.closest("[data-group-color]");
      if (colorInput) {
        changeGroupColor(colorInput.dataset.groupColor, colorInput.value);
        return;
      }
      const completionSelect = event.target.closest("[data-policy-completion]");
      if (completionSelect) {
        const mode = completionSelect.value;
        if (mode !== "custom") {
          setPolicyOverride(
            completionSelect.dataset.policyKind,
            completionSelect.dataset.policyId,
            "completionRetentionSeconds",
            mode === "default" ? undefined : mode === "never" ? null : 0
          );
        }
        return;
      }
      const deleteSelect = event.target.closest("[data-policy-delete]");
      if (deleteSelect) {
        const mode = deleteSelect.value;
        setPolicyOverride(
          deleteSelect.dataset.policyKind,
          deleteSelect.dataset.policyId,
          "deleteMode",
          mode === "default" ? undefined : mode
        );
      }
    });

    boardEl.addEventListener("focusin", (event) => {
      if (suppressFocusSelection) return;
      const sectionRow = event.target.closest("[data-section-row]");
      if (sectionRow) {
        selectNode("section", sectionRow.dataset.sectionRow);
        return;
      }
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

    focusTaskEl?.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-focus-toggle]");
      if (!toggle) return;
      const found = findTask(toggle.dataset.focusToggle);
      const item = found ? resolveTaskItem(found.item) : null;
      if (item) {
        setTaskCompleted(item.id, !item.done, new Date().toISOString(), { render: false });
        render();
        renderFocusMode();
      }
    });

    focusTaskEl?.addEventListener("keydown", (event) => {
      const childEl = event.target.closest?.(".focus-child-text");
      if (!childEl) return;
      const id = childEl.dataset.focusTaskText;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        const found = findTask(id);
        if (!found) return;
        resolveTaskItem(found.item).text = getMarkdownTextFromEditable(childEl);
        const inserted = splitTaskAtOffset(id, getCaretOffset(childEl));
        renderFocusMode();
        const target = focusTaskEl.querySelector(`[data-focus-task-text="${inserted?.item?.id || id}"]`);
        focusEditableText(target, false);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) outdentTask(id);
        else indentTask(id);
        renderFocusMode();
        focusEditableText(focusTaskEl.querySelector(`[data-focus-task-text="${id}"]`), false);
        return;
      }
      if (event.key === "Backspace" && isEditableTextEmpty(childEl)) {
        event.preventDefault();
        event.stopPropagation();
        deleteTaskWithPolicy(id);
        renderFocusMode();
      }
    });

    focusTaskEl?.addEventListener("input", (event) => {
      const target = event.target.closest("[data-focus-task-text]");
      if (!target) return;
      const found = findTask(target.dataset.focusTaskText);
      if (!found) return;
      resolveTaskItem(found.item).text = getMarkdownTextFromEditable(target);
      saveState();
      render();
    });

    focusButtonEl?.addEventListener("click", toggleFocusMode);
    focusExitEl?.addEventListener("click", exitFocusMode);
    window.addEventListener?.("beforeunload", () => stopFocusTimer());
    function syncSettingsControls() {
      const settings = state.settings;
      if (pasteModeEl) pasteModeEl.value = ["alias", "reference", "duplicate", "ask"].includes(settings.pasteMode) ? settings.pasteMode : "alias";
      const retention = settings.completionRetentionSeconds;
      const completionMode = retention === null ? "never" : Number(retention) === 0 ? "immediate" : "custom";
      if (completionModeEl) completionModeEl.value = completionMode;
      const completionParts = secondsToDurationParts(Number(retention) > 0 ? retention : DEFAULT_SETTINGS.completionRetentionSeconds);
      if (completionValueEl) completionValueEl.value = String(completionParts.value);
      if (completionUnitEl) completionUnitEl.value = completionParts.unit;
      if (completionDurationEl) completionDurationEl.hidden = completionMode !== "custom";
      const deleteMode = settings.deleteMode === "permanent" ? "permanent" : "trash";
      if (deleteModeEl) deleteModeEl.value = deleteMode;
      const trashRetention = settings.trashRetentionSeconds;
      const trashMode = trashRetention === null ? "forever" : "custom";
      if (trashModeEl) trashModeEl.value = trashMode;
      const trashParts = secondsToDurationParts(Number(trashRetention) > 0 ? trashRetention : DEFAULT_SETTINGS.completionRetentionSeconds);
      if (trashValueEl) trashValueEl.value = String(trashParts.value);
      if (trashUnitEl) trashUnitEl.value = trashParts.unit;
      if (trashModeRowEl) trashModeRowEl.hidden = deleteMode === "permanent";
      if (trashDurationEl) trashDurationEl.hidden = deleteMode === "permanent" || trashMode !== "custom";
      if (exportCompletedEl) exportCompletedEl.checked = settings.exportCompleted !== false;
      if (exportTrashEl) exportTrashEl.checked = Boolean(settings.exportTrash);
      if (policyOverridesEl) policyOverridesEl.checked = Boolean(settings.policyOverrides);
      if (featureMetadataEl) featureMetadataEl.checked = Boolean(settings.metadata);
      if (featureTimelineEl) featureTimelineEl.checked = Boolean(settings.timelineView);
      if (featureRemindersEl) featureRemindersEl.checked = Boolean(settings.reminders);
      if (featureNotificationsEl) featureNotificationsEl.checked = Boolean(settings.browserNotifications);
      if (usernameEl) usernameEl.value = String(settings.username || "");
    }

    function updateSettings(patch) {
      Object.assign(state.settings, patch);
      saveState();
      syncSettingsControls();
      render();
    }

    function readCompletionRetentionFromControls() {
      const mode = completionModeEl?.value || "custom";
      if (mode === "never") return null;
      if (mode === "immediate") return 0;
      const seconds = durationToSeconds(completionValueEl?.value, completionUnitEl?.value || "days");
      if (seconds > 0) return seconds;
      const current = state.settings.completionRetentionSeconds;
      return Number(current) > 0 ? current : DEFAULT_SETTINGS.completionRetentionSeconds;
    }

    function readTrashRetentionFromControls() {
      if ((trashModeEl?.value || "forever") === "forever") return null;
      const seconds = durationToSeconds(trashValueEl?.value, trashUnitEl?.value || "days");
      if (seconds > 0) return seconds;
      const current = state.settings.trashRetentionSeconds;
      return Number(current) > 0 ? current : DEFAULT_SETTINGS.completionRetentionSeconds;
    }

    pasteModeEl?.addEventListener("change", () => updateSettings({ pasteMode: pasteModeEl.value }));
    [completionModeEl, completionValueEl, completionUnitEl].forEach((element) => {
      element?.addEventListener("change", () => updateSettings({ completionRetentionSeconds: readCompletionRetentionFromControls() }));
    });
    deleteModeEl?.addEventListener("change", () => updateSettings({ deleteMode: deleteModeEl.value === "permanent" ? "permanent" : "trash" }));
    [trashModeEl, trashValueEl, trashUnitEl].forEach((element) => {
      element?.addEventListener("change", () => updateSettings({ trashRetentionSeconds: readTrashRetentionFromControls() }));
    });
    exportCompletedEl?.addEventListener("change", () => updateSettings({ exportCompleted: exportCompletedEl.checked }));
    exportTrashEl?.addEventListener("change", () => updateSettings({ exportTrash: exportTrashEl.checked }));
    policyOverridesEl?.addEventListener("change", () => updateSettings({ policyOverrides: policyOverridesEl.checked }));
    usernameEl?.addEventListener("change", () => updateSettings({ username: usernameEl.value.trim() }));
    exportSettingsEl?.addEventListener("click", downloadSettingsExport);
    featureMetadataEl?.addEventListener("change", () => updateSettings({ metadata: featureMetadataEl.checked }));
    featureTimelineEl?.addEventListener("change", () => updateSettings({ timelineView: featureTimelineEl.checked }));
    featureRemindersEl?.addEventListener("change", () => updateSettings({ reminders: featureRemindersEl.checked }));
    featureNotificationsEl?.addEventListener("change", () => {
      updateSettings({ browserNotifications: featureNotificationsEl.checked });
      if (featureNotificationsEl.checked && typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission?.();
      }
    });

    function closeSidebarDrawer() {
      document.body?.classList.remove("sidebar-open");
      if (sidebarBackdropEl) sidebarBackdropEl.hidden = true;
    }

    sidebarToggleEl?.addEventListener("click", () => {
      if (window.matchMedia?.("(max-width: 980px)").matches) {
        const open = !document.body?.classList.contains("sidebar-open");
        document.body?.classList.toggle("sidebar-open", open);
        if (sidebarBackdropEl) sidebarBackdropEl.hidden = !open;
        return;
      }
      updateSettings({ sidebarCollapsed: !state.settings.sidebarCollapsed });
    });

    sidebarBackdropEl?.addEventListener("click", closeSidebarDrawer);

    sidebarToggleEl?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "Escape") {
        event.preventDefault();
        if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        [...document.querySelectorAll(".sidebar button, .sidebar summary")].find((el) => el.offsetParent !== null)?.focus();
      }
    });

    historyMenuEl?.addEventListener("toggle", renderHistoryList);

    let lightboxView = null;
    function openLightbox(src) {
      if (!lightboxEl || !lightboxImgEl) return;
      lightboxView = { scale: 1, x: 0, y: 0, panning: null };
      lightboxImgEl.src = src;
      applyLightboxTransform();
      lightboxEl.hidden = false;
    }

    function closeLightbox() {
      if (!lightboxEl) return;
      lightboxEl.hidden = true;
      lightboxView = null;
      if (lightboxImgEl) lightboxImgEl.src = "";
    }

    function applyLightboxTransform() {
      if (!lightboxImgEl || !lightboxView) return;
      lightboxImgEl.style.transform = `translate(${lightboxView.x}px, ${lightboxView.y}px) scale(${lightboxView.scale})`;
    }

    boardEl.addEventListener("dblclick", (event) => {
      const image = event.target.closest(".task-image img");
      if (image) openLightbox(image.src);
    });

    lightboxEl?.addEventListener("click", (event) => {
      if (event.target === lightboxEl) closeLightbox();
    });

    lightboxEl?.addEventListener("wheel", (event) => {
      if (!lightboxView) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      lightboxView.scale = Math.min(8, Math.max(0.2, lightboxView.scale * factor));
      applyLightboxTransform();
    }, { passive: false });

    lightboxEl?.addEventListener("pointerdown", (event) => {
      if (!lightboxView || event.target !== lightboxImgEl) return;
      lightboxView.panning = { pointerId: event.pointerId, startX: event.clientX - lightboxView.x, startY: event.clientY - lightboxView.y };
      event.preventDefault();
    });

    lightboxEl?.addEventListener("pointermove", (event) => {
      const pan = lightboxView?.panning;
      if (!pan || event.pointerId !== pan.pointerId) return;
      lightboxView.x = event.clientX - pan.startX;
      lightboxView.y = event.clientY - pan.startY;
      applyLightboxTransform();
    });

    lightboxEl?.addEventListener("pointerup", () => {
      if (lightboxView) lightboxView.panning = null;
    });

    let imageResize = null;
    boardEl.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest("[data-image-handle]");
      if (!handle) return;
      const img = handle.closest(".task-image")?.querySelector("img");
      if (!img) return;
      imageResize = {
        pointerId: event.pointerId,
        taskId: handle.dataset.imageTask,
        imageId: handle.dataset.imageId,
        side: handle.dataset.imageHandle,
        startX: event.clientX,
        startWidth: img.getBoundingClientRect().width,
        img,
      };
      event.preventDefault();
      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch {
        /* pointer already released */
      }
    });
    boardEl.addEventListener("pointermove", (event) => {
      if (!imageResize || event.pointerId !== imageResize.pointerId) return;
      const delta = event.clientX - imageResize.startX;
      const width = Math.min(900, Math.max(60, imageResize.startWidth + (imageResize.side === "right" ? delta : -delta)));
      imageResize.img.style.width = `${width}px`;
      event.preventDefault();
    });
    boardEl.addEventListener("pointerup", (event) => {
      if (!imageResize || event.pointerId !== imageResize.pointerId) return;
      const found = findTask(imageResize.taskId);
      const record = found ? (resolveTaskItem(found.item).images || []).find((img) => img.id === imageResize.imageId) : null;
      if (record) {
        record.width = Math.round(parseFloat(imageResize.img.style.width) || record.width);
        saveState();
      }
      imageResize = null;
    });

    viewsNavEl?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view-nav]");
      if (!button) return;
      const target = button.dataset.viewNav;
      if (target === "board") showList = true;
      if (target === "timeline") showTimeline = !showTimeline;
      if (target === "completed" || target === "trash") showList = true;
      render();
      closeSidebarDrawer();
      if (target === "completed" || target === "trash") {
        const section = document.querySelector(target === "completed" ? "[data-completed-section]" : "[data-trash-section]");
        if (section) {
          section.open = true;
          section.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }
        return;
      }
      (mainEl || window).scrollTo?.({ top: 0, behavior: "smooth" });
    });

    function applySidebarWidth() {
      const width = Math.min(420, Math.max(200, Number(state.settings.sidebarWidth) || 280));
      document.documentElement?.style?.setProperty("--sidebar-w", `${width}px`);
    }

    let sidebarResize = null;
    sidebarResizerEl?.addEventListener("pointerdown", (event) => {
      sidebarResize = { pointerId: event.pointerId };
      sidebarResizerEl.classList.add("dragging");
      try {
        sidebarResizerEl.setPointerCapture?.(event.pointerId);
      } catch {
        /* pointer already released */
      }
      event.preventDefault();
    });
    sidebarResizerEl?.addEventListener("pointermove", (event) => {
      if (!sidebarResize || event.pointerId !== sidebarResize.pointerId) return;
      state.settings.sidebarWidth = Math.min(420, Math.max(200, Math.round(event.clientX)));
      applySidebarWidth();
    });
    sidebarResizerEl?.addEventListener("pointerup", (event) => {
      if (!sidebarResize || event.pointerId !== sidebarResize.pointerId) return;
      sidebarResize = null;
      sidebarResizerEl.classList.remove("dragging");
      saveState();
    });

    viewListEl?.addEventListener("click", () => {
      showList = !showList;
      render();
    });
    viewTimelineEl?.addEventListener("click", () => {
      showTimeline = !showTimeline;
      render();
    });
    timelineDateEl?.addEventListener("change", () => {
      if (!SCHEDULE_DATE_PATTERN.test(timelineDateEl.value)) return;
      timelineDate = timelineDateEl.value;
      render();
    });

    function refreshDetailsHints(panel) {
      const taskId = panel?.dataset.taskDetails;
      const found = taskId ? findTask(taskId) : null;
      if (!found) return;
      const item = resolveTaskItem(found.item);
      const dateHint = panel.querySelector("[data-date-hint]");
      if (dateHint) dateHint.textContent = describeRelativeDate(item.schedule?.date);
      const reminderHint = panel.querySelector("[data-reminder-hint]");
      if (reminderHint) reminderHint.textContent = describeRelativeDateTime(item.reminderAt);
    }

    taskDetailsHostEl?.addEventListener("focusin", (event) => {
      const input = event.target;
      const panel = input.closest?.("[data-task-details]");
      if (!panel) return;
      const taskId = panel.dataset.taskDetails;
      if (input.matches("[data-task-date]") && !input.value) {
        input.value = localDateString();
        setTaskSchedule(taskId, { date: input.value });
        refreshDetailsHints(panel);
        return;
      }
      if (input.matches("[data-task-reminder]") && !input.value) {
        const next = new Date();
        next.setMinutes(0, 0, 0);
        next.setHours(next.getHours() + 1);
        input.value = `${localDateString(next)}T${String(next.getHours()).padStart(2, "0")}:00`;
        setTaskSchedule(taskId, { reminderAt: input.value });
        refreshDetailsHints(panel);
      }
    });

    taskDetailsHostEl?.addEventListener("change", (event) => {
      const input = event.target;
      const panel = input.closest("[data-task-details]");
      const taskId = panel?.dataset.taskDetails;
      if (!taskId) return;
      let saved = null;
      if (input.matches("[data-task-date]")) saved = setTaskSchedule(taskId, { date: input.value });
      else if (input.matches("[data-task-start]")) saved = setTaskSchedule(taskId, { startTime: input.value });
      else if (input.matches("[data-task-planned]")) saved = setTaskSchedule(taskId, { plannedMinutes: input.value });
      else if (input.matches("[data-task-reminder]")) saved = setTaskSchedule(taskId, { reminderAt: input.value });
      if (saved === false) showToast("That value could not be saved.");
      if (saved !== null) render();
    });

    boardSplitEl?.addEventListener("pointerdown", (event) => {
      const block = event.target.closest("[data-timeline-block]");
      if (!block || (event.pointerType === "mouse" && event.button !== 0)) return;
      timelineDrag = {
        id: block.dataset.timelineBlock,
        block,
        pointerId: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        top: parseFloat(block.style.top) || 0,
        armed: event.pointerType === "mouse",
        moved: false,
      };
      if (!timelineDrag.armed && typeof window.setTimeout === "function") {
        const pending = timelineDrag;
        window.setTimeout(() => {
          if (timelineDrag === pending && !timelineDrag.moved) {
            timelineDrag.armed = true;
            timelineDrag.block.classList.add("touch-dragging");
          }
        }, LONG_PRESS_MS);
      }
      try {
        block.setPointerCapture?.(event.pointerId);
      } catch {
        /* pointer already released */
      }
    });

    boardSplitEl?.addEventListener("pointermove", (event) => {
      if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
      const delta = event.clientY - timelineDrag.startY;
      if (!timelineDrag.armed) {
        if (shouldCancelLongPress(timelineDrag.startX, timelineDrag.startY, event.clientX, event.clientY)) timelineDrag = null;
        return;
      }
      if (Math.abs(delta) > 3) timelineDrag.moved = true;
      timelineDrag.block.style.top = `${timelineDrag.top + delta}px`;
      event.preventDefault();
    });

    function finishTimelineDrag(event, cancelled = false) {
      if (!timelineDrag || event.pointerId !== timelineDrag.pointerId) return;
      const drag = timelineDrag;
      timelineDrag = null;
      drag.block.classList.remove("touch-dragging");
      if (cancelled) {
        render();
        return;
      }
      if (drag.moved) {
        const startTime = timelineTimeFromOffset(parseFloat(drag.block.style.top) || 0);
        setTaskSchedule(drag.id, { startTime });
        render();
        return;
      }
      selectNode("task", drag.id);
      render();
    }

    boardSplitEl?.addEventListener("pointerup", (event) => finishTimelineDrag(event));
    boardSplitEl?.addEventListener("pointercancel", (event) => finishTimelineDrag(event, true));

    boardSplitEl?.addEventListener("keydown", (event) => {
      const confirmWrap = event.target.closest?.("[data-delete-confirm]");
      if (confirmWrap && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        event.stopPropagation();
        const buttons = [...confirmWrap.querySelectorAll("button")];
        const index = Math.max(0, buttons.indexOf(document.activeElement));
        buttons[(index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
        return;
      }
      const block = event.target.closest?.("[data-timeline-block]");
      if (!block || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      event.stopPropagation();
      const currentTop = parseFloat(block.style.top) || 0;
      const nextTop = currentTop + (event.key === "ArrowUp" ? -TIMELINE_SNAP_MINUTES : TIMELINE_SNAP_MINUTES);
      setTaskSchedule(block.dataset.timelineBlock, { startTime: timelineTimeFromOffset(nextTop) });
      render();
      document.querySelector(`[data-timeline-block="${block.dataset.timelineBlock}"]`)?.focus();
    });

    boardSplitEl?.addEventListener("click", (event) => {
      const unscheduledItem = event.target.closest("[data-timeline-unscheduled]");
      if (unscheduledItem) selectNode("task", unscheduledItem.dataset.timelineUnscheduled);
    });

    darkModeEl?.addEventListener("change", () => toggleDarkMode(darkModeEl.checked));
    exportBoardEl?.addEventListener("click", downloadBoardState);
    importBoardEl?.addEventListener("click", () => importFileEl?.click());
    importFileEl?.addEventListener("change", (event) => {
      handleImportFile(event.target.files?.[0]);
      event.target.value = "";
    });

    document.addEventListener("click", (event) => {
      document.querySelectorAll(".policy-menu[open]").forEach((menu) => {
        if (!menu.contains(event.target)) menu.open = false;
      });
      const link = event.target.closest("[data-task-link]");
      if (link) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          window.open(link.href, "_blank", "noopener");
        } else if (link.closest("[contenteditable='true']")) {
          event.preventDefault();
        }
      }
      const button = event.target.closest("[data-action]");
      if (!button || boardEl.contains(button)) return;
      if (button.dataset.action === "add-group") addGroup();
      if (button.dataset.action === "expand-all") setEveryCollapsed(false);
      if (button.dataset.action === "collapse-all") setEveryCollapsed(true);
      if (button.dataset.action === "reset") {
        if (typeof window.confirm === "function"
          && !window.confirm("Replace the current board with the example board? Your current groups and tasks will be erased. Export JSON first if you want a backup.")) {
          return;
        }
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

    document.addEventListener("copy", (event) => {
      if (event.target.matches?.("[contenteditable='true'], input, textarea")) return;
      const clipboard = rememberInternalClipboard("copy");
      if (!clipboard || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", clipboard.markdown);
    });

    document.addEventListener("cut", (event) => {
      if (event.target.matches?.("[contenteditable='true'], input, textarea")) return;
      const clipboard = rememberInternalClipboard("cut");
      if (!clipboard || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", clipboard.markdown);
    });

    document.addEventListener("paste", (event) => {
      if (event.target.matches?.("[contenteditable='true'], input, textarea")) return;
      const text = event.clipboardData?.getData("text/plain") || "";
      if (internalClipboard?.taskIds?.length && text.trim() === internalClipboard.markdown.trim()) {
        event.preventDefault();
        pasteTaskIds(internalClipboard.taskIds, selectedNode, resolvePasteMode());
        if (internalClipboard.mode === "cut") internalClipboard = null;
        return;
      }
      if (parseMarkdownTasks(text).length) {
        event.preventDefault();
        pasteExternalMarkdown(text, selectedNode);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && lightboxView) {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === "Escape" && pendingGroupDelete) {
        event.preventDefault();
        pendingGroupDelete = null;
        render();
        return;
      }
      if (event.target.closest?.("[data-delete-confirm]")) return;
      if (event.key === "Escape" && (focusModeTaskId || focusModeGroupId)) {
        event.preventDefault();
        exitFocusMode();
        return;
      }

      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const node = focusModeTaskId ? { kind: "task", id: focusModeTaskId } : selectedNode;
        if (node?.kind === "task") {
          const found = findTask(node.id);
          const item = found ? resolveTaskItem(found.item) : null;
          if (item) setTaskCompleted(node.id, !item.done);
        }
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
        const groupTitle = event.target.closest?.("[data-group-title]");
        if (groupTitle) {
          const group = findGroup(groupTitle.dataset.groupTitle);
          if (group) {
            group.title = groupTitle.textContent.trim() || "Untitled group";
            const inserted = insertSiblingBelowNode({ kind: "group", id: group.id });
            if (inserted) focusTaskText(inserted.id);
          }
          return;
        }
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

      if (event.altKey && !event.ctrlKey && event.key.toLowerCase() === "a" && !isEditingText) {
        event.preventDefault();
        addGroup();
        return;
      }

      if (event.ctrlKey && event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowUp") && !isEditingText) {
        event.preventDefault();
        setEveryCollapsed(event.key === "ArrowUp");
        return;
      }

      if (isEditingText && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) return;

      if (event.target.matches("input, select, textarea") && !event.altKey) return;

      const visible = getVisibleNodes();
      if (!visible.length) return;
      const currentIndex = visible.findIndex((node) => node.kind === selectedNode?.kind && node.id === selectedNode?.id);
      const index = Math.max(0, currentIndex);

      if (selectedNode?.kind === "section" && !isEditingText) {
        if (event.key === "Enter" || event.key === "Tab" || event.key === "Backspace" || event.key === "Delete") return;
        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.ctrlKey) {
          event.preventDefault();
          const details = getNodeRow(selectedNode)?.closest("details");
          if (details) details.open = event.key === "ArrowDown";
          return;
        }
        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.altKey) return;
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) return;
      }

      if (event.key === "ArrowLeft" && !event.ctrlKey && !event.altKey && !event.shiftKey && !isEditingText) {
        event.preventDefault();
        const sidebarTarget = [...document.querySelectorAll(".sidebar button, .sidebar summary")].find((el) => el.offsetParent !== null);
        (sidebarTarget || sidebarToggleEl)?.focus();
        return;
      }

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
        if (index === 0 && currentIndex !== -1) {
          searchEl?.focus();
          return;
        }
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

    searchEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && searchEl.value) {
        event.preventDefault();
        searchEl.value = "";
        render();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "Escape") {
        event.preventDefault();
        searchEl.blur();
        if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
        return;
      }
      if (event.key === "ArrowLeft" && searchEl.selectionStart === 0 && viewToggleEl && !viewToggleEl.hidden) {
        event.preventDefault();
        viewListEl?.focus();
      }
    });

    viewToggleEl?.addEventListener("keydown", (event) => {
      if (event.target.tagName !== "BUTTON") return;
      const items = [viewListEl, viewTimelineEl, timelineDateEl].filter((el) => el && !el.hidden);
      const itemIndex = items.indexOf(document.activeElement);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (itemIndex >= 0 && itemIndex < items.length - 1) items[itemIndex + 1].focus();
        else searchEl?.focus();
        return;
      }
      if (event.key === "ArrowLeft" && itemIndex > 0) {
        event.preventDefault();
        items[itemIndex - 1].focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "Escape") {
        event.preventDefault();
        if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
      }
    });

    document.querySelector(".sidebar")?.addEventListener("keydown", (event) => {
      const tag = event.target.tagName;
      if (tag === "SELECT" || tag === "INPUT") return;
      const sidebar = event.currentTarget;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const focusables = [...sidebar.querySelectorAll("button, summary")].filter((el) => el.offsetParent !== null);
        const focusIndex = focusables.indexOf(document.activeElement);
        if (focusIndex < 0) return;
        event.preventDefault();
        const next = focusIndex + (event.key === "ArrowDown" ? 1 : -1);
        focusables[Math.min(focusables.length - 1, Math.max(0, next))]?.focus();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Escape") {
        event.preventDefault();
        if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
      }
    });

    applyTheme(loadTheme());
    applySidebarWidth();
    syncSettingsControls();
    updateClock();
    if (typeof window.setInterval === "function") window.setInterval(updateClock, 30000);
    if (typeof window.setInterval === "function") window.setInterval(runLifecycleMaintenance, 1000);
    if (typeof window.setInterval === "function") window.setInterval(() => checkDueReminders(), 5000);
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
      resolveTaskItem,
      getLinkCount,
      createLinkedTaskTree,
      pasteTaskIds,
      tasksToMarkdown,
      parseMarkdownTasks,
      selectedNodesToMarkdown,
      rememberInternalClipboard,
      pasteExternalMarkdown,
      resolveLifecyclePolicy,
      durationToSeconds,
      secondsToDurationParts,
      setPolicyOverride,
      updateSettings,
      syncSettingsControls,
      setTaskSchedule,
      getTimelineEntries,
      timelineTimeFromOffset,
      getEffortVariance,
      isReminderDue,
      getDueReminders,
      checkDueReminders,
      renderTaskDetailsPanel,
      renderGroupDetailsPanel,
      renderDetailsPanel,
      renderFocusChildren,
      enterGroupFocusMode,
      toggleFocusMode,
      describeGlobalCompletionPolicy,
      logHistory,
      deleteSelectedNodesConfirmed: (nodes) => deleteSelectedNodes(nodes, { confirmed: true }),
      get pendingGroupDelete() {
        return pendingGroupDelete;
      },
      describeRelativeDate,
      describeRelativeDateTime,
      renderTimelineSection,
      localDateString,
      isTaskHiddenFromActive,
      setTaskCompleted,
      restoreCompletedTask,
      deleteTaskWithPolicy,
      restoreTrashRecord,
      purgeTrashRecord,
      purgeExpiredTrash,
      getCompletedEntries,
      runLifecycleMaintenance,
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
