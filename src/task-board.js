    // ?demo runs the same app against isolated storage with a fresh example
    // board each load, so the landing page can embed the real thing.
    const IS_DEMO = typeof location !== "undefined" && /[?&]demo\b/.test(location.search || "");
    const STORAGE_KEY = "scheduling-task-management-board-v1" + (IS_DEMO ? "-demo" : "");
    const THEME_STORAGE_KEY = "scheduling-task-management-theme-v1" + (IS_DEMO ? "-demo" : "");
    // Same detection style as IS_DEMO: only a copy opened from disk (file://)
    // ever checks for updates. The hosted site, its ?demo iframe, and the
    // claude.ai artifact all serve over http(s) and must never phone home.
    const IS_LOCAL_FILE = typeof location !== "undefined" && location.protocol === "file:";
    const SCHEMA_VERSION = 2;
    // Only the major.minor here matter; the build overwrites the patch with a
    // git commit count so it climbs on its own. Edit "1.5" for a milestone.
    const APP_VERSION = "1.5.0";
    const LATEST_BUILD_URL = "https://evrenucar.github.io/punchlist_app/";
    const UPDATE_RELEASE_API = "https://api.github.com/repos/evrenucar/punchlist_app/releases/latest";
    const UPDATE_RELEASES_PAGE = "https://github.com/evrenucar/punchlist_app/releases";
    const UPDATE_NOTES_URL = "https://evrenucar.github.io/punchlist_app/notes.html";
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
      imageResolution: "medium",
      completionRetentionSeconds: 7 * 24 * 60 * 60,
      deleteMode: "trash",
      trashRetentionSeconds: null,
      exportCompleted: true,
      exportTrash: false,
      sidebarCollapsed: false,
      sidebarWidth: 280,
      username: "",
      checkForUpdates: true,
    });
    const AUTO_SCROLL_EDGE_PX = 96;
    const MAX_AUTO_SCROLL_SPEED = 18;
    const LONG_PRESS_MS = 420;
    const LONG_PRESS_MOVE_PX = 12;
    const SELECT_HOLD_MS = 1500; // Evren's touch spec: holds past this flip into drag-select
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
      "group-getting-started": GROUP_PALETTES[0],
      "group-today": GROUP_PALETTES[1],
      "group-priorities": GROUP_PALETTES[2],
      "group-projects": GROUP_PALETTES[3],
      "group-later": GROUP_PALETTES[4],
    };
    const boardEl = document.querySelector("[data-board]");
    const appVersionEl = document.querySelector("[data-app-version]");
    if (appVersionEl) appVersionEl.textContent = "v" + APP_VERSION;
    const exampleBannerHostEl = document.querySelector("[data-example-banner-host]");
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
    const imageResolutionEl = document.querySelector("[data-image-resolution]");
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
    const deviceNameEl = document.querySelector("[data-device-name]");
    const identityLineEl = document.querySelector("[data-identity-line]");
    const syncDevicesEl = document.querySelector("[data-sync-devices]");
    const exportSettingsEl = document.querySelector("[data-export-settings]");
    const reportBugEl = document.querySelector("[data-report-bug]");
    const bugDialogEl = document.querySelector("[data-bug-dialog]");
    const bugTextEl = document.querySelector("[data-bug-text]");
    const bugCloseEl = document.querySelector("[data-bug-close]");
    const bugGithubEl = document.querySelector("[data-bug-github]");
    const bugEmailEl = document.querySelector("[data-bug-email]");
    const syncSectionEl = document.querySelector("[data-sync-section]");
    const syncEnabledEl = document.querySelector("[data-sync-enabled]");
    const syncFieldsEl = document.querySelector("[data-sync-fields]");
    const syncRepoEl = document.querySelector("[data-sync-repo]");
    const syncTokenEl = document.querySelector("[data-sync-token]");
    const syncNowEl = document.querySelector("[data-sync-now]");
    const syncStatusEl = document.querySelector("[data-sync-status]");
    const updatesSectionEl = document.querySelector("[data-updates-section]");
    const checkUpdatesEl = document.querySelector("[data-check-updates]");
    const updateVersionEl = document.querySelector("[data-update-version]");
    const lightboxEl = document.querySelector("[data-lightbox]");
    const lightboxImgEl = document.querySelector("[data-lightbox-img]");
    const toastEl = document.querySelector("[data-toast]");
    const focusModeEl = document.querySelector("[data-focus-mode]");
    const focusButtonEl = document.querySelector("[data-focus-button]");
    const focusExitEl = document.querySelector("[data-focus-exit]");
    const focusFoldEl = document.querySelector("[data-focus-fold]");
    const focusTaskEl = document.querySelector("[data-focus-task]");
    const focusTimerEl = document.querySelector("[data-focus-timer]");
    const focusClockEl = document.querySelector("[data-focus-clock]");
    const focusCrumbEl = document.querySelector("[data-focus-crumb]");
    let selectedNode = null;
    let multiSelectedNodes = [];
    let selectionAnchorNode = null;
    let draggedNode = null;
    let focusModeTaskId = null;
    let focusModeStartedAt = null;
    let focusModeTimerFrame = null;
    let autoScrollFrame = null;
    let autoScrollVelocity = 0;
    let autoScrollCarry = 0;
    let touchDrag = null;
    let lastPressWasTouch = false;
    let undoStack = [];
    let undoActions = [];
    let lastUndoAction = null;
    let suppressFocusSelection = false;
    let boardPressActive = false;
    let squelchTapUntil = 0;
    let internalClipboard = null;
    let lifecycleSignature = "";
    let announcedReminders = new Set();
    let pendingGroupDelete = null;
    let focusModeGroupId = null;
    // focus mode covers the board; its edits mark the board stale instead of
    // re-rendering an invisible DOM per keystroke (one render on exit)
    let boardStaleBehindFocus = false;
    let lastPushLoggedHistory = false;
    let showList = true;
    let showTimeline = false;
    let timelineDate = localDateString();
    let timelineDrag = null;
    let toastTimer = null;
    let state = loadState();

    // GitHub sync keeps its config (token included) in its own localStorage
    // key so board and settings exports can never leak it.
    const SYNC_STORAGE_KEY = STORAGE_KEY + "-sync";
    // The dismissed-version marker lives in its own key (like the sync config)
    // so it can never ride along in a board or settings export.
    const UPDATE_DISMISS_KEY = STORAGE_KEY + "-update-dismissed";
    let syncConfig = loadSyncConfig();
    let syncApplying = false;
    let syncBusy = false;
    let syncQueued = false;
    let syncTimer = null;

    // Device identity is a per-device label in its own localStorage key: it
    // never syncs, so each device keeps its own name, while the roster in
    // state.devices carries every device's name to the others.
    const DEVICE_STORAGE_KEY = STORAGE_KEY + "-device";
    let deviceIdentity = loadDeviceIdentity();

    function loadDeviceIdentity() {
      try {
        const parsed = JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY) || "null");
        if (parsed && typeof parsed.id === "string" && parsed.id) {
          return { id: parsed.id, name: typeof parsed.name === "string" ? parsed.name : "" };
        }
      } catch {}
      const created = { id: createId("device"), name: "" };
      if (!IS_DEMO) localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(created));
      return created;
    }

    function saveDeviceIdentity(patch) {
      Object.assign(deviceIdentity, patch);
      if (!IS_DEMO) localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(deviceIdentity));
    }

    function deviceDisplayName(id) {
      if (!id) return "";
      const name = String((id === deviceIdentity.id ? deviceIdentity.name : state.devices?.[id]?.name) || "").trim();
      return name || `device ${id.slice(-4)}`;
    }

    // Each device records itself in the synced roster so the others can
    // resolve its name in history entries and the sync overview.
    function touchDeviceRoster() {
      if (IS_DEMO) return;
      if (!state.devices || typeof state.devices !== "object" || Array.isArray(state.devices)) state.devices = {};
      state.devices[deviceIdentity.id] = { name: deviceIdentity.name, lastSeenAt: new Date().toISOString() };
    }

    function renderDeviceRoster() {
      return Object.entries(state.devices || {})
        .sort(([, a], [, b]) => String(b?.lastSeenAt || "").localeCompare(String(a?.lastSeenAt || "")))
        .map(([id, info]) => {
          const seen = describeRelativeDateTime(info?.lastSeenAt);
          const self = id === deviceIdentity.id ? " (this device)" : "";
          return `<p class="sync-status">${escapeHtml(deviceDisplayName(id))}${self}${seen ? escapeHtml(` · ${seen}`) : ""}</p>`;
        })
        .join("");
    }

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
        example: true,
        settings: { ...DEFAULT_SETTINGS },
        trash: [],
        groups: [
          {
            id: "group-getting-started",
            title: "Getting started",
            collapsed: false,
            tasks: [
              task("Click a task and start typing to edit it"),
              task("Press Enter to add a task below", [
                task("Tab and Shift+Tab change how deeply it nests"),
              ]),
              task("Drag a task, or hold Alt and press the arrow keys, to move it"),
              task("Tick a checkbox when something is done", [], { done: true }),
            ],
          },
          {
            id: "group-today",
            title: "Today",
            collapsed: false,
            tasks: [
              task("Buy groceries"),
              task("Reply to Sam about the weekend"),
              task("Book a dentist appointment"),
              task("Go for a 30-minute walk"),
            ],
          },
          {
            id: "group-priorities",
            title: "Priorities",
            collapsed: false,
            tasks: [
              task("Finish the slides for the Monday review"),
              task("Renew the car registration", [], { done: true }),
              task("Send the signed lease back"),
            ],
          },
          {
            id: "group-projects",
            title: "Projects",
            collapsed: false,
            tasks: [
              task("Learn three new recipes"),
              task("Redesign the personal website", [
                task("Pick a color palette"),
                task("Write the landing-page copy"),
              ]),
              task("Plan a weekend trip", [
                task("Compare train versus driving"),
                task("Find somewhere to stay"),
              ]),
            ],
          },
          {
            id: "group-later",
            title: "Later",
            collapsed: false,
            tasks: [
              task("Read the book Sam recommended"),
              task("Sort out the garage"),
              task(RESEARCH_TASK_TEXT, [
                task("Compare Obsidian, ClickUp, Todoist, Things, and Notion workflows"),
                task("Review recurring complaints and praise in public Reddit discussions"),
                task("Summarize capture, scheduling, mobile, configuration, portability, and sync pain points"),
              ]),
            ],
          },
        ],
      };
    }

    // The landing-page embed shows a trimmed example: the Getting started
    // guide plus enough tasks for the demo driver, sidebar tucked away.
    function demoSeedState() {
      const seed = seedState();
      const keep = ["Getting started", "Today", "Projects"];
      seed.groups = seed.groups.filter((group) => keep.includes(group.title));
      const today = seed.groups.find((group) => group.title === "Today");
      if (today) today.tasks = today.tasks.filter((item) => item.text !== "Reply to Sam about the weekend");
      const projects = seed.groups.find((group) => group.title === "Projects");
      if (projects) projects.tasks = projects.tasks.filter((item) => item.text === "Plan a weekend trip");
      seed.settings.sidebarCollapsed = true;
      return seed;
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
      if (IS_DEMO) return migrateState(demoSeedState());
      return loadStateFromLocalStorage();
    }

    function saveState() {
      touchDeviceRoster();
      saveStateToLocalStorage();
      if (syncIsActive() && !syncApplying) {
        saveSyncConfig({ dirty: true });
        scheduleSyncPush();
      }
    }

    // Typing persistence: serializing the whole board per keystroke costs
    // ~13ms at 2MB (measured 2026-07-19) — the reported input lag. Text-input
    // paths debounce the save; everything structural stays immediate. The
    // state object itself is always current, so any immediate save that lands
    // first persists the typed text too.
    let saveDebounceTimer = null;

    function saveStateDebounced(delay = 400) {
      if (typeof window.setTimeout !== "function") {
        saveState();
        return;
      }
      if (saveDebounceTimer) window.clearTimeout?.(saveDebounceTimer);
      saveDebounceTimer = window.setTimeout(() => {
        saveDebounceTimer = null;
        saveState();
      }, delay);
    }

    function flushPendingSave() {
      if (!saveDebounceTimer) return;
      window.clearTimeout?.(saveDebounceTimer);
      saveDebounceTimer = null;
      saveState();
    }

    window.addEventListener?.("beforeunload", flushPendingSave);

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

    // Evren's spec (2026-07-17): favicon is a single color, the OPPOSITE of
    // the browser's mode, checkmark as negative space. Follows the browser
    // scheme (the tab bar it sits in), not the app's own theme toggle.
    function faviconSvg(color) {
      return "data:image/svg+xml," + encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><mask id='m'><rect width='24' height='24' fill='white'/><path d='M7 13l3.4 3.4L17.5 8' stroke='black' stroke-width='3.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></mask><g transform='rotate(-4 12 12)'><rect x='2' y='2' width='20' height='20' rx='5' fill='${color}' mask='url(#m)'/></g></svg>`,
      );
    }

    const faviconEl = document.querySelector("link[rel='icon']");
    const darkSchemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    function updateFavicon() {
      if (!faviconEl) return;
      faviconEl.href = faviconSvg(darkSchemeQuery?.matches ? "#ffffff" : "#191b1a");
    }

    updateFavicon();
    darkSchemeQuery?.addEventListener?.("change", updateFavicon);

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

    async function getBoardExportPayload() {
      const payload = {
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        state: getExportState(),
      };
      // The signature covers the exact compact serialization of payload.state;
      // verification re-stringifies the parsed object, which matches because
      // JSON.parse/stringify preserve key order.
      const signature = await signText(JSON.stringify(payload.state)).catch(() => null);
      if (signature && state.identity) {
        payload.sender = {
          name: String(state.settings.username || "").trim() || null,
          fingerprint: state.identity.fingerprint,
          publicKeyJwk: state.identity.publicKeyJwk,
        };
        payload.signature = signature;
      }
      return payload;
    }

    function getExportState() {
      const includeCompleted = state.settings.exportCompleted !== false;
      const groups = state.groups.map((group) => ({
        ...group,
        tasks: filterTasksForExport(group.tasks, includeCompleted),
      }));
      // identity holds the private key and contacts is the local trust book;
      // neither may ever land in a shared file. Device names stay: attribution
      // is the point of the roster.
      return embedImagesInExport(JSON.parse(JSON.stringify({
        ...state,
        settings: undefined,
        identity: undefined,
        contacts: undefined,
        groups,
        trash: state.settings.exportTrash ? state.trash : [],
      })));
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

    async function serializeBoardState() {
      return JSON.stringify(await getBoardExportPayload(), null, 2);
    }

    async function importBoardStateFromJson(jsonText) {
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
      const sender = await describeImportSender(payload);
      if (sender.verdict === "invalid") {
        const proceed = window.confirm?.("This file's signature does not match its content — it was changed after being signed, or corrupted in transit. Import it anyway?");
        if (!proceed) return false;
      }
      if (focusModeTaskId) exitFocusMode();
      const senderLabel = sender.fingerprint ? `${sender.name || "unnamed"} (${sender.fingerprint})` : "";
      pushUndoState("board", `Imported a board from JSON${senderLabel ? `, signed by ${senderLabel}` : ""}`);
      const currentSettings = state.settings;
      const currentIdentity = state.identity || null;
      const currentContacts = state.contacts && typeof state.contacts === "object" ? state.contacts : {};
      state = migrateState(importedState, new Date().toISOString(), { includeResearch: false });
      state.settings = { ...DEFAULT_SETTINGS, ...currentSettings };
      // Never adopt an identity from a shared file while one exists here:
      // exports carry no private key, and a raw dump's key belongs to its owner.
      if (currentIdentity) state.identity = currentIdentity;
      state.contacts = Object.keys(currentContacts).length ? currentContacts : (state.contacts || {});
      if ((sender.verdict === "known" || sender.verdict === "first-contact") && sender.fingerprint) {
        const existing = state.contacts[sender.fingerprint];
        const now = new Date().toISOString();
        state.contacts[sender.fingerprint] = {
          name: sender.name || existing?.name || "",
          firstSeenAt: existing?.firstSeenAt || now,
          lastSeenAt: now,
        };
      }
      // The imported board's history replaced the local one above, so the
      // provenance entry has to land in the new state to survive the import.
      logHistory(`Imported a board from JSON${senderLabel ? `, signed by ${senderLabel}` : ""}`);
      selectedNode = getVisibleNodes()[0] || null;
      multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
      selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      // imported files carry embedded images (lossless exports); they move
      // straight into the asset store like any other first run
      if (assetsAvailable()) offloadEmbeddedImages();
      saveState();
      syncSettingsControls();
      render();
      showToast(importVerdictToast(sender));
      return true;
    }

    function importVerdictToast(sender) {
      const label = sender.name || (sender.fingerprint ? `sender ${sender.fingerprint}` : "");
      if (sender.verdict === "self") return "Imported a board signed with this board's own key.";
      if (sender.verdict === "known") return `Imported a board from ${label}, the same sender as before.`;
      if (sender.verdict === "first-contact") return `Imported a board from ${label}, the first import from this sender.`;
      if (sender.verdict === "invalid") return "Imported a board whose signature did not match its content.";
      return "Imported an unsigned board.";
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

    async function downloadBoardState() {
      downloadJsonFile(`punchlist-board-${new Date().toISOString().slice(0, 10)}.json`, await serializeBoardState());
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
        importBoardStateFromJson(String(reader.result || "")).catch((error) => window.alert(error.message));
      });
      reader.readAsText(file);
    }

    // ---- GitHub sync -------------------------------------------------------
    // The board lives as one JSON file in a private repo the user owns; every
    // device reads and writes it through the GitHub contents API with a
    // fine-grained token scoped to that repo. Each push is a commit, so any
    // overwritten version stays recoverable in the repo's git history.
    // Reads past the contents API's ~1 MB cap fall back to the Git blobs API
    // (100 MB) — the deferred ponytail note came due when Evren's board
    // outgrew the cap and his devices split-brained (2026-07-18).

    function loadSyncConfig() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }

    function saveSyncConfig(patch) {
      Object.assign(syncConfig, patch);
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncConfig));
    }

    function syncIsActive() {
      return !IS_DEMO && Boolean(syncConfig.enabled && syncConfig.repo && syncConfig.token);
    }

    function bytesToBase64(bytes) {
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    }

    function base64ToBytes(base64) {
      return Uint8Array.from(atob(String(base64).replace(/\s+/g, "")), (ch) => ch.charCodeAt(0));
    }

    function encodeBase64Utf8(text) {
      return bytesToBase64(new TextEncoder().encode(text));
    }

    function decodeBase64Utf8(base64) {
      return new TextDecoder().decode(base64ToBytes(base64));
    }

    // Pure decision core: given where local and remote stand, one action.
    // Divergence resolves local-wins because the losing version survives as
    // the previous commit; there is no merge in v1.
    function syncDecision({ remoteExists, remoteSha, lastSha, dirty }) {
      if (!remoteExists) return "create";
      if (remoteSha === lastSha) return dirty ? "push" : "none";
      return dirty ? "push" : "pull";
    }

    // Sync payloads are lossless: unlike user exports they ignore the
    // exportCompleted/exportTrash filters and only strip per-device settings.
    function getSyncPayload() {
      return JSON.stringify({
        version: SCHEMA_VERSION,
        syncedAt: new Date().toISOString(),
        state: JSON.parse(JSON.stringify({ ...state, settings: undefined })),
      }, null, 2);
    }

    function applySyncedState(payload) {
      const imported = payload?.state;
      if (!imported || !Array.isArray(imported.groups)) throw new Error("The synced file has no board in it.");
      if (focusModeTaskId) exitFocusMode();
      pushUndoState("board", "Pulled board changes from GitHub");
      const currentSettings = state.settings;
      const currentIdentity = state.identity || null;
      const currentContacts = state.contacts && typeof state.contacts === "object" ? state.contacts : {};
      // A pull must not throw the user across the board: keep the selection
      // when its node survives the pull (decided from DATA, so collapsed-away
      // nodes count too) and hold the scroller where it was. The old reset to
      // the first node was Evren's "my viewport is reset".
      const keepSelection = selectedNode ? { ...selectedNode } : null;
      const scroller = typeof document.querySelector === "function" ? document.querySelector("main") : null;
      const keepScrollTop = scroller ? scroller.scrollTop : null;
      state = migrateState(imported, new Date().toISOString(), { includeResearch: false });
      state.settings = currentSettings;
      // A payload from an older build must not wipe the shared key or the
      // contact book; when the remote has them, the remote versions win.
      if (!state.identity && currentIdentity) state.identity = currentIdentity;
      if (!Object.keys(state.contacts || {}).length && Object.keys(currentContacts).length) state.contacts = currentContacts;
      const survives = keepSelection
        && (keepSelection.kind === "group" ? Boolean(findGroup(keepSelection.id)) : Boolean(findTask(keepSelection.id)));
      if (survives) {
        selectedNode = keepSelection;
        multiSelectedNodes = [{ ...keepSelection }];
        selectionAnchorNode = { ...keepSelection };
      } else {
        selectedNode = getVisibleNodes()[0] || null;
        multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
        selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      }
      syncApplying = true;
      try {
        saveState();
      } finally {
        syncApplying = false;
      }
      syncSettingsControls();
      render();
      if (survives && scroller && keepScrollTop !== null) scroller.scrollTop = keepScrollTop;
    }

    // For embedders (the status/ wrapper): swap in a new whole-board state
    // WITHOUT reloading the page. Unlike applySyncedState this keeps the
    // user's selection when the node survives, logs no history entry (the
    // writer already attributed its edit), and adopts incoming settings —
    // the caller owns the whole board, not a settings-stripped sync payload.
    function applyExternalState(rawState) {
      if (!rawState || !Array.isArray(rawState.groups)) throw new Error("applyExternalState needs a board with groups");
      if (focusModeTaskId || focusModeGroupId) exitFocusMode();
      const keepSelection = selectedNode ? { ...selectedNode } : null;
      const currentIdentity = state.identity || null;
      const currentContacts = state.contacts && typeof state.contacts === "object" ? state.contacts : {};
      state = migrateState(rawState, new Date().toISOString(), { includeResearch: false });
      if (!state.identity && currentIdentity) state.identity = currentIdentity;
      if (!Object.keys(state.contacts || {}).length && Object.keys(currentContacts).length) state.contacts = currentContacts;
      saveStateToLocalStorage();
      render();
      if (keepSelection && getNodeRow(keepSelection)) {
        selectNode(keepSelection);
      } else {
        selectedNode = getVisibleNodes()[0] || null;
        multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
        selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
        if (selectedNode) renderSelection();
      }
    }

    function syncApiUrl() {
      const repo = String(syncConfig.repo || "").trim();
      return `https://api.github.com/repos/${repo}/contents/punchlist-board.json`;
    }

    function syncBlobUrl(sha) {
      const repo = String(syncConfig.repo || "").trim();
      return `https://api.github.com/repos/${repo}/git/blobs/${sha}`;
    }

    function syncAssetUrl(name) {
      const repo = String(syncConfig.repo || "").trim();
      return `https://api.github.com/repos/${repo}/contents/assets${name ? `/${name}` : ""}`;
    }

    function syncAuthHeaders() {
      return {
        Authorization: `Bearer ${syncConfig.token}`,
        Accept: "application/vnd.github+json",
      };
    }

    function setSyncStatus(message) {
      if (syncStatusEl) syncStatusEl.textContent = message || "";
    }

    function scheduleSyncPush() {
      if (typeof window.setTimeout !== "function") return;
      if (syncTimer !== null) window.clearTimeout?.(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        syncNow("edit");
      }, 2500);
    }

    async function syncNow(trigger) {
      if (!syncIsActive() || typeof fetch !== "function") return;
      if (syncBusy) {
        syncQueued = true;
        return;
      }
      syncBusy = true;
      // A debounced typing save may still be pending; land it NOW so the dirty
      // flag is truthful before the pull/push decision. Without this, a tab
      // switch mid-typing read dirty=false and PULLED the remote over the
      // unsaved edit — Evren's "my most recent change disappears".
      flushPendingSave();
      setSyncStatus("Syncing…");
      try {
        const branch = syncConfig.branch || "main";
        const get = await fetch(`${syncApiUrl()}?ref=${branch}`, { headers: syncAuthHeaders(), cache: "no-store" });
        let remote = { exists: false, sha: null, content: null };
        if (get.ok) {
          const data = await get.json();
          if (!data.content && data.size > 0) {
            // Boards past ~1 MB come back with empty content from the contents
            // API; the Git blobs API serves the same file up to 100 MB (this
            // stranded Evren's devices on 2026-07-18 — the split-brain bug).
            const blob = await fetch(syncBlobUrl(data.sha), { headers: syncAuthHeaders(), cache: "no-store" });
            if (!blob.ok) throw new Error(`Board is over 1 MB and the blob fetch answered ${blob.status}.`);
            data.content = (await blob.json()).content;
          }
          remote = { exists: true, sha: data.sha, content: data.content };
        } else if (get.status !== 404) {
          throw new Error(`GitHub answered ${get.status}${get.status === 401 ? "; check the token" : ""}.`);
        }
        const action = syncDecision({
          remoteExists: remote.exists,
          remoteSha: remote.sha,
          lastSha: syncConfig.lastSha || null,
          dirty: Boolean(syncConfig.dirty),
        });
        if (action === "pull") {
          // Never yank the board out from under an active caret: retry shortly
          // instead (the debounce re-runs syncNow; it re-decides from scratch).
          const active = document.activeElement;
          if (active && active.isContentEditable && boardEl?.contains?.(active)) {
            setSyncStatus("Remote changes waiting (finishing your edit first)");
            scheduleSyncPush();
            return;
          }
          applySyncedState(JSON.parse(decodeBase64Utf8(remote.content)));
          saveSyncConfig({ lastSha: remote.sha, dirty: false, lastSyncedAt: new Date().toISOString() });
          showToast("Pulled board changes from GitHub.");
          // a not-yet-migrated device may push embedded images; offload them
          // here and let the debounced push send the slim board back
          if (assetsAvailable() && offloadEmbeddedImages()) saveState();
          await pullMissingAssets(branch);
        } else if (action === "push" || action === "create") {
          const overwroteRemote = remote.exists && remote.sha !== (syncConfig.lastSha || null);
          // asset files land before the board that references them, so a
          // crash between the two never strands a device on broken references
          await pushMissingAssets(branch);
          const put = await fetch(syncApiUrl(), {
            method: "PUT",
            headers: syncAuthHeaders(),
            body: JSON.stringify({
              message: `punchlist sync (${trigger}, ${deviceDisplayName(deviceIdentity.id)})`,
              content: encodeBase64Utf8(getSyncPayload()),
              branch,
              ...(remote.exists ? { sha: remote.sha } : {}),
            }),
          });
          if (!put.ok) throw new Error(`GitHub answered ${put.status} on push.`);
          const putData = await put.json();
          saveSyncConfig({ lastSha: putData.content?.sha || null, dirty: false, lastSyncedAt: new Date().toISOString() });
          if (overwroteRemote) showToast("Pushed this device's board over newer remote changes; the overwritten version is in the repo's commit history.");
        }
        setSyncStatus(`Synced ${formatClockTime()}`);
      } catch (error) {
        setSyncStatus(`Sync failed: ${error?.message || error}`);
        // 409 = the remote moved between our GET and PUT (another device
        // pushed). A retry re-GETs the fresh sha and re-decides, so it heals
        // itself; without this the banner sat at "Sync failed: 409" until the
        // next unrelated trigger (Evren's screenshot).
        if (String(error?.message || "").includes("409")) scheduleSyncPush();
      } finally {
        syncBusy = false;
        if (syncQueued) {
          syncQueued = false;
          scheduleSyncPush();
        }
      }
    }
    // ---- end GitHub sync ---------------------------------------------------

    // ---- asset store ---------------------------------------------------------
    // Image bytes live OUTSIDE the board (grill Q21-Q23, 2026-07-19): immutable
    // records in IndexedDB locally, one file each under assets/ in the sync
    // repo, tiny {assetId} references in board state. Full eager parity: every
    // device fetches every asset it is missing, exactly once (immutable = no
    // conflicts). "assets", not "images": videos, files, STLs ride the same
    // rails later. Where IndexedDB is unavailable (the vm test harness), images
    // stay embedded in state exactly as before — nothing is ever lost.
    const ASSET_DB_NAME = "punchlist-assets-v1";
    const ASSET_MIME_EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/svg+xml": "svg" };
    const assetCache = new Map();
    let assetDbPromise = null;

    function assetsAvailable() {
      return !IS_DEMO && typeof indexedDB !== "undefined";
    }

    function openAssetDb() {
      if (!assetDbPromise) {
        assetDbPromise = new Promise((resolve) => {
          try {
            const request = indexedDB.open(ASSET_DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore("assets", { keyPath: "id" });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      }
      return assetDbPromise;
    }

    async function idbPutAsset(record) {
      const db = await openAssetDb();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction("assets", "readwrite");
          tx.objectStore("assets").put(record);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }

    async function idbGetAllAssets() {
      const db = await openAssetDb();
      if (!db) return [];
      return new Promise((resolve) => {
        try {
          const request = db.transaction("assets").objectStore("assets").getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    function storeAsset(id, src) {
      assetCache.set(id, src);
      if (assetsAvailable()) idbPutAsset({ id, src, createdAt: new Date().toISOString() });
    }

    // Resolves an image record to displayable bytes: embedded src (legacy or
    // IndexedDB-less), else the cache. null = known asset, bytes not here yet.
    function getAssetSrc(image) {
      if (!image) return null;
      if (typeof image.src === "string") return image.src;
      return assetCache.get(image.assetId) || null;
    }

    function assetMime(src) {
      const semicolon = String(src).indexOf(";");
      return semicolon > 5 ? String(src).slice(5, semicolon) : "application/octet-stream";
    }

    function assetFileName(id, src) {
      return `${id}.${ASSET_MIME_EXT[assetMime(src)] || "bin"}`;
    }

    function assetMimeFromName(name) {
      const ext = String(name).split(".").pop();
      const entry = Object.entries(ASSET_MIME_EXT).find(([, value]) => value === ext);
      return entry ? entry[0] : "application/octet-stream";
    }

    function eachStateImage(visit) {
      const visitTask = (item) => {
        (item.images || []).forEach((image) => visit(image));
        (item.children || []).forEach(visitTask);
      };
      state.groups.forEach((group) => group.tasks.forEach(visitTask));
      (state.trash || []).forEach((record) => {
        if (record?.item) visitTask(record.item);
      });
    }

    function assetIdsReferenced() {
      const ids = new Set();
      eachStateImage((image) => {
        if (typeof image.assetId === "string") ids.add(image.assetId);
      });
      return ids;
    }

    // Moves embedded data-URL images out of board state into the asset store.
    // Runs at boot and after imports; the caller gates on assetsAvailable() so
    // memory-only caches can never strand bytes across a reload.
    function offloadEmbeddedImages() {
      let moved = 0;
      eachStateImage((image) => {
        if (typeof image.src === "string" && image.src.startsWith("data:image/")) {
          const assetId = createId("asset");
          storeAsset(assetId, image.src);
          image.assetId = assetId;
          delete image.src;
          moved += 1;
        }
      });
      return moved;
    }

    // Exports must stay lossless and readable by older builds: re-embed every
    // resolvable asset as src. An asset whose bytes have not arrived yet keeps
    // its reference (sync delivers the bytes later) instead of vanishing.
    function embedImagesInExport(exportState) {
      const visitTask = (item) => {
        (item.images || []).forEach((image) => {
          if (typeof image.assetId !== "string") return;
          const src = assetCache.get(image.assetId);
          if (src) {
            image.src = src;
            delete image.assetId;
          }
        });
        (item.children || []).forEach(visitTask);
      };
      (exportState.groups || []).forEach((group) => (group.tasks || []).forEach(visitTask));
      (exportState.trash || []).forEach((record) => {
        if (record?.item) visitTask(record.item);
      });
      return exportState;
    }

    async function initAssetStore() {
      if (!assetsAvailable()) return;
      const records = await idbGetAllAssets();
      records.forEach((record) => assetCache.set(record.id, record.src));
      const moved = offloadEmbeddedImages();
      // persist WITHOUT marking sync dirty: flagging dirty here would make
      // load-sync's local-wins shove this stale-content board over a newer
      // remote. The slim board rides out with the next real edit's push.
      if (moved) {
        saveStateToLocalStorage();
        render();
      } else if (records.length) {
        render();
      }
    }

    // Push side of parity: every referenced asset the remote has never seen
    // gets its own immutable file. uploadedAssets in the sync config remembers
    // what is already up, so steady state costs zero extra API calls.
    async function pushMissingAssets(branch) {
      const uploaded = new Set(Array.isArray(syncConfig.uploadedAssets) ? syncConfig.uploadedAssets : []);
      const missing = [...assetIdsReferenced()].filter((id) => !uploaded.has(id) && assetCache.has(id));
      for (const id of missing) {
        const src = assetCache.get(id);
        const name = assetFileName(id, src);
        const comma = src.indexOf(",");
        const response = await fetch(`${syncAssetUrl(name)}`, {
          method: "PUT",
          headers: syncAuthHeaders(),
          body: JSON.stringify({
            message: `punchlist asset (${deviceDisplayName(deviceIdentity.id)})`,
            content: src.slice(comma + 1),
            branch,
          }),
        });
        // 422 = the file already exists (another device beat us to it); the
        // asset is immutable, so existing means converged
        if (!response.ok && response.status !== 422) throw new Error(`GitHub answered ${response.status} uploading an image.`);
        uploaded.add(id);
        saveSyncConfig({ uploadedAssets: [...uploaded] });
      }
    }

    // Pull side of parity: the pulled board may reference assets this device
    // has never seen; fetch each one, biggest files via the blobs API.
    async function pullMissingAssets(branch) {
      // no assetsAvailable() gate: even without IndexedDB a cache-only pull is
      // safe, the repo stays the source and bytes simply re-fetch next session
      const missing = [...assetIdsReferenced()].filter((id) => !assetCache.has(id));
      if (!missing.length) return;
      const listing = await fetch(`${syncAssetUrl("")}?ref=${branch}`, { headers: syncAuthHeaders(), cache: "no-store" });
      if (!listing.ok) return; // no assets folder yet; references resolve on a later pull
      const entries = await listing.json();
      const byId = new Map((Array.isArray(entries) ? entries : []).map((entry) => [String(entry.name).replace(/\.[^.]+$/, ""), entry]));
      const uploaded = new Set(Array.isArray(syncConfig.uploadedAssets) ? syncConfig.uploadedAssets : []);
      let fetched = 0;
      for (const id of missing) {
        const entry = byId.get(id);
        if (!entry) continue;
        let content = null;
        if (Number(entry.size) <= 900000) {
          const file = await fetch(`${syncAssetUrl(entry.name)}?ref=${branch}`, { headers: syncAuthHeaders(), cache: "no-store" });
          if (file.ok) content = (await file.json()).content;
        }
        if (!content) {
          const blob = await fetch(syncBlobUrl(entry.sha), { headers: syncAuthHeaders(), cache: "no-store" });
          if (!blob.ok) continue;
          content = (await blob.json()).content;
        }
        if (!content) continue;
        storeAsset(id, `data:${assetMimeFromName(entry.name)};base64,${String(content).replace(/\s+/g, "")}`);
        uploaded.add(id);
        fetched += 1;
      }
      saveSyncConfig({ uploadedAssets: [...uploaded] });
      if (fetched) render();
    }
    // ---- end asset store -----------------------------------------------------

    // ---- signing identity ----------------------------------------------------
    // One ECDSA keypair per user, not per device: it lives in board state, so
    // the user's own devices all receive it through sync (the private repo is
    // the trusted channel) and sign exports as the same sender. Exports strip
    // the private half; recipients verify with the embedded public half and
    // recognize repeat senders by key fingerprint (trust on first use).
    // ponytail: extractable JWK in state; non-extractable IndexedDB keys are
    // the upgrade if device theft ever enters the threat model.
    const SIGNING_KEY_PARAMS = { name: "ECDSA", namedCurve: "P-256" };
    const SIGNING_ALGORITHM = { name: "ECDSA", hash: "SHA-256" };
    let signingIdentityPromise = null;

    function signingAvailable() {
      return !IS_DEMO && typeof crypto !== "undefined" && Boolean(crypto.subtle);
    }

    function ensureSigningIdentity() {
      if (!signingIdentityPromise) signingIdentityPromise = createSigningIdentity();
      return signingIdentityPromise;
    }

    async function createSigningIdentity() {
      if (!signingAvailable() || state.identity) return state.identity || null;
      const pair = await crypto.subtle.generateKey(SIGNING_KEY_PARAMS, true, ["sign", "verify"]);
      const [privateKeyJwk, publicKeyJwk] = await Promise.all([
        crypto.subtle.exportKey("jwk", pair.privateKey),
        crypto.subtle.exportKey("jwk", pair.publicKey),
      ]);
      const fingerprint = await publicKeyFingerprint(publicKeyJwk);
      if (state.identity) return state.identity; // a sync pull won the race; keep the shared key
      state.identity = { privateKeyJwk, publicKeyJwk, fingerprint, createdAt: new Date().toISOString() };
      // Persist without marking the board dirty: the key rides along with the
      // next natural push instead of racing the first pull on a new device.
      saveStateToLocalStorage();
      syncSettingsControls();
      return state.identity;
    }

    async function publicKeyFingerprint(publicKeyJwk) {
      const key = await crypto.subtle.importKey("jwk", publicKeyJwk, SIGNING_KEY_PARAMS, true, ["verify"]);
      const spki = await crypto.subtle.exportKey("spki", key);
      const digest = await crypto.subtle.digest("SHA-256", spki);
      return [...new Uint8Array(digest).slice(0, 4)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function signText(text) {
      await ensureSigningIdentity();
      if (!state.identity || !signingAvailable()) return null;
      const key = await crypto.subtle.importKey("jwk", state.identity.privateKeyJwk, SIGNING_KEY_PARAMS, false, ["sign"]);
      const signature = await crypto.subtle.sign(SIGNING_ALGORITHM, key, new TextEncoder().encode(text));
      return bytesToBase64(new Uint8Array(signature));
    }

    async function verifySignedText(publicKeyJwk, signatureBase64, text) {
      try {
        const key = await crypto.subtle.importKey("jwk", publicKeyJwk, SIGNING_KEY_PARAMS, false, ["verify"]);
        return await crypto.subtle.verify(SIGNING_ALGORITHM, key, base64ToBytes(signatureBase64), new TextEncoder().encode(text));
      } catch {
        return false;
      }
    }

    // Pure decision core, mirror of syncDecision: signature facts in, verdict out.
    function importTrustVerdict({ signed, valid, fingerprint, ownFingerprint, knownContact }) {
      if (!signed) return "unsigned";
      if (!valid) return "invalid";
      if (ownFingerprint && fingerprint === ownFingerprint) return "self";
      return knownContact ? "known" : "first-contact";
    }

    async function describeImportSender(payload) {
      const sender = payload?.sender;
      const signed = Boolean(sender?.publicKeyJwk && payload?.signature);
      if (!signed || typeof crypto === "undefined" || !crypto.subtle) {
        return { verdict: "unsigned", name: String(sender?.name || ""), fingerprint: null };
      }
      let fingerprint = null;
      let valid = false;
      try {
        // The fingerprint is recomputed from the embedded key; the sender's
        // claimed fingerprint is display-only and never trusted.
        fingerprint = await publicKeyFingerprint(sender.publicKeyJwk);
        valid = await verifySignedText(sender.publicKeyJwk, payload.signature, JSON.stringify(payload.state));
      } catch {}
      return {
        verdict: importTrustVerdict({
          signed: true,
          valid,
          fingerprint,
          ownFingerprint: state.identity?.fingerprint || null,
          knownContact: Boolean(fingerprint && state.contacts?.[fingerprint]),
        }),
        name: String(sender?.name || ""),
        fingerprint,
      };
    }
    // ---- end signing identity ------------------------------------------------

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
      state.history.push({ at: new Date().toISOString(), text: String(text), kind, ...(IS_DEMO ? {} : { deviceId: deviceIdentity.id }) });
      if (state.history.length > 50) state.history.shift();
    }

    function pushUndoState(action = "board", detail = null) {
      const label = detail || (action in HISTORY_LABELS ? HISTORY_LABELS[action] : "Changed the board");
      lastPushLoggedHistory = Boolean(label);
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
      if (lastPushLoggedHistory) {
        state.history.pop();
        lastPushLoggedHistory = false;
      }
    }

    function restoreUndoState() {
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      undoActions.pop();
      lastUndoAction = undoActions[undoActions.length - 1] || null;
      const previousSelection = selectedNode;
      state = normalizeState(JSON.parse(snapshot));
      // Keep the user's place: only drop the selection when the restored state
      // no longer shows that node — never yank it to the top of the board.
      const visible = getVisibleNodes();
      selectedNode = (previousSelection
        && visible.find((node) => node.kind === previousSelection.kind && node.id === previousSelection.id))
        || null;
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

    function walkPlacements(tasks, callback) {
      (tasks || []).forEach((item) => {
        callback(item);
        walkPlacements(item.children, callback);
      });
    }

    // One whole-board walk per render, not one per rendered task: getLinkCount
    // runs for every non-link task while serializing, which made big renders
    // QUADRATIC (measured ~111ms of pure link counting per full render on a
    // 1.4k-task board; worse on Evren's). Render entry points build this map
    // once and clear it when done; everything else falls back to the walk.
    let linkCountCache = null;
    function buildLinkCountCache() {
      const counts = new Map();
      state.groups.forEach((group) => walkPlacements(group.tasks, (item) => {
        if (item.targetTaskId && ["alias", "reference"].includes(item.linkType)) {
          counts.set(item.targetTaskId, (counts.get(item.targetTaskId) || 0) + 1);
        }
      }));
      return counts;
    }

    function getLinkCount(taskId) {
      if (linkCountCache) return linkCountCache.get(taskId) || 0;
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
      // Evren's spec (2026-07-17): cut removes items immediately like any
      // editor; paste re-inserts the same objects, undo restores them in place
      if (mode === "cut" && tasks.length) {
        const cutIds = new Set(tasks.map((item) => item.id));
        const visible = getVisibleNodes();
        const firstIndex = visible.findIndex((node) => node.kind === "task" && cutIds.has(node.id));
        const neighbor = visible.slice(0, Math.max(0, firstIndex)).reverse()
          .find((node) => !(node.kind === "task" && cutIds.has(node.id)));
        pushUndoState("cut", tasks.length === 1
          ? `Cut "${shortText(resolveTaskItem(tasks[0])?.text)}"`
          : `Cut ${tasks.length} tasks`);
        internalClipboard.detached = tasks.map((item) => removeTask(item.id)).filter(Boolean);
        if (neighbor) setSingleSelection(neighbor);
        saveState();
        render();
      }
      return internalClipboard;
    }

    let pasteLinkOverride = null; // Ctrl+Shift+V arms a one-shot unlinked paste

    function resolvePasteMode() {
      if (internalClipboard?.mode === "cut") return "move";
      if (pasteLinkOverride) return pasteLinkOverride;
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
      return Boolean(object && Object.hasOwn(object, key));
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
          // the row leaves for the Completed section: full render after the
          // slide-away, the lifecycle sections move
          animateRowsAway([found.item.id], render);
        } else if (taskIsLinkFree(found.item)) {
          renderTaskSubtreeInPlace(found.item.id, found.group.id);
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
      // scope check while the lookup still resolves: a link anywhere in the
      // subtree fans the delete into other groups' articles
      const scopedGroupId = found.group?.id || null;
      const scopedParentId = found.parent?.id || null;
      const scopedOk = scopedGroupId && subtreeIsLinkFree(found.item);
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
        if (options.pushUndo !== false && state.history.length) {
          state.history[state.history.length - 1].trashId = record.id;
        }
      }
      if (options.save !== false) saveState();
      if (options.render !== false) {
        if (scopedOk) {
          renderScoped(scopedParentId, scopedGroupId);
          refreshLifecycleSections();
        } else {
          render();
        }
      }
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
      // group comparison must happen while the source lookup still resolves
      const sourceGroupId = source.group?.id || null;
      const targetGroupId = position === "group" ? targetId : findTask(targetId)?.group?.id || null;
      const scopedOk = sourceGroupId && sourceGroupId === targetGroupId && taskIsLinkFree(source.item);
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
      if (scopedOk) renderGroupInPlace(sourceGroupId);
      else render();
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
      const scopedGroupId = found.group?.id || null;
      const scopedParentId = found.parent?.id || null;
      const scopedOk = scopedGroupId && subtreeIsLinkFree(found.item);
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
      if (scopedOk) {
        renderScoped(scopedParentId, scopedGroupId);
        refreshLifecycleSections();
      } else {
        render();
      }
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
      renderTaskSubtreeInPlace(id, found.group.id);
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
      renderGroupInPlace(id);
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

    function countTaskDescendants(id) {
      const walk = (children) => (children || []).reduce((total, child) => total + 1 + walk(resolveTaskItem(child)?.children), 0);
      return walk(resolveTaskItem(findTask(id)?.item)?.children);
    }

    function deleteSelectedNodes(nodes = getSelectedNodes(), options = {}) {
      if (!nodes.length) return;
      const groupsToDelete = nodes.filter((node) => node.kind === "group");
      // Evren's spec (2026-07-17): deleting more than a single item — a group,
      // a multi-selection, or a task with sub-items — asks first
      const taskNodes = nodes.filter((node) => node.kind === "task");
      const subtreeCount = !groupsToDelete.length && taskNodes.length === 1 ? countTaskDescendants(taskNodes[0].id) : 0;
      if ((groupsToDelete.length || taskNodes.length > 1 || subtreeCount > 0) && !options.confirmed) {
        pendingGroupDelete = {
          nodes: nodes.map((node) => ({ ...node })),
          groupId: groupsToDelete[0]?.id || findTask(taskNodes[0]?.id)?.group?.id || null,
          label: nodes.length > 1 ? `${nodes.length} selected items`
            : groupsToDelete.length ? "this group"
            : `this task and its ${subtreeCount} sub-item${subtreeCount === 1 ? "" : "s"}`,
        };
        render();
        document.querySelector('[data-action="confirm-delete"]')?.focus();
        return;
      }
      pendingGroupDelete = null;
      // a single link-free task delete (the Delete key's everyday path) may
      // render scoped: capture its covering parent before the removal
      const singleTask = !groupsToDelete.length && taskNodes.length === 1 && nodes.length === 1
        ? findTask(taskNodes[0].id)
        : null;
      const scopedDelete = singleTask && subtreeIsLinkFree(singleTask.item)
        ? { parentId: singleTask.parent?.id || null, groupId: singleTask.group?.id || null }
        : null;
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

      const createdRecords = [];
      nodes.filter((node) => node.kind === "group").forEach((node) => {
        const index = state.groups.findIndex((group) => group.id === node.id);
        if (index < 0) return;
        const [group] = state.groups.splice(index, 1);
        if (state.settings.deleteMode !== "permanent") {
          const record = {
            id: createId("trash"),
            kind: "group",
            item: group,
            deletedAt: new Date().toISOString(),
            wasCompleted: false,
            retentionSeconds: state.settings.trashRetentionSeconds,
            source: { index },
          };
          state.trash.push(record);
          createdRecords.push(record);
        }
      });

      nodes.filter((node) => node.kind === "task").forEach((node) => {
        const record = deleteTaskWithPolicy(node.id, new Date().toISOString(), {
          pushUndo: false,
          save: false,
          render: false,
        });
        if (record) createdRecords.push(record);
      });
      if (createdRecords.length === 1 && state.history.length) {
        state.history[state.history.length - 1].trashId = createdRecords[0].id;
      }

      const target = getNeighborAfterDelete(nodes[0], visibleBeforeDelete, deletedKeys);
      if (target) {
        setSingleSelection(target);
      } else {
        selectedNode = null;
        multiSelectedNodes = [];
        selectionAnchorNode = null;
      }
      saveState();
      if (scopedDelete && scopedDelete.groupId) {
        renderScoped(scopedDelete.parentId, scopedDelete.groupId);
        refreshLifecycleSections();
      } else {
        render();
      }
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

      // Ctrl+Up with nothing left to collapse climbs to the enclosing toggle:
      // collapse the nearest expanded ancestor (finally the group) and select it
      if (!changed && collapsed === true && nodes.length === 1 && nodes[0].kind === "task") {
        let parent = findTask(nodes[0].id)?.parent;
        while (parent) {
          const parentFound = findTask(parent.id);
          if (parentFound && !parentFound.item.collapsed) {
            parentFound.item.collapsed = true;
            setSingleSelection({ kind: "task", id: parent.id });
            changed = true;
            break;
          }
          parent = parentFound?.parent;
        }
        if (!changed) {
          const group = findTask(nodes[0].id)?.group;
          if (group && !group.collapsed) {
            group.collapsed = true;
            setSingleSelection({ kind: "group", id: group.id });
            changed = true;
          }
        }
      }

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
        if (draggedNode?.kind === "group") {
          return {
            targetKind: "group",
            targetId: groupCard.dataset.groupCard,
            position: getVerticalDropPosition(event, groupCard),
          };
        }
        // Top edge = first slot. Dropping a task on the header used to append
        // at the BOTTOM of the group, the opposite of where the finger points.
        const firstRow = groupCard.querySelector("[data-task-row]");
        if (firstRow && event.clientY < firstRow.getBoundingClientRect().top) {
          return { targetKind: "task", targetId: firstRow.dataset.taskRow, position: "before" };
        }
        return { targetKind: "group", targetId: groupCard.dataset.groupCard, position: "group" };
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
      autoScrollCarry = 0;
      if (autoScrollFrame) {
        const cancelFrame = window.cancelAnimationFrame || window.clearTimeout;
        cancelFrame(autoScrollFrame);
        autoScrollFrame = null;
      }
    }

    // The touch drag's target follows the finger on pointermove, and follows
    // the CONTENT whenever auto-scroll slides it under a still finger.
    function refreshTouchDragTarget(clientX, clientY) {
      if (!touchDrag) return;
      const target = document.elementFromPoint?.(clientX, clientY);
      const instruction = target ? getDropInstruction({ target, clientY }) : null;
      touchDrag.instruction = canDropOn(instruction) ? instruction : null;
      if (touchDrag.instruction) showDropInstruction(touchDrag.instruction);
    }

    function runDragAutoScroll() {
      if (!autoScrollVelocity) {
        stopDragAutoScroll();
        return;
      }
      const scroller = mainEl || document.scrollingElement;
      // never push past the ends: shoving into iOS rubber-banding at the top
      // is the jag Evren reported (bounce fighting the per-frame scrollBy)
      const atTop = autoScrollVelocity < 0 && scroller.scrollTop <= 0;
      const atBottom = autoScrollVelocity > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      if (!atTop && !atBottom) {
        // fractional velocities accumulate into whole-pixel steps, so the
        // slow end scrolls evenly instead of in Math.ceil'd 1px stutters
        autoScrollCarry += autoScrollVelocity;
        const step = Math.trunc(autoScrollCarry);
        autoScrollCarry -= step;
        if (step) scroller.scrollBy({ top: step, behavior: "auto" });
        // content slides under a still finger; the drop target must slide too
        if (touchDrag?.armed && touchDrag.lastX != null) refreshTouchDragTarget(touchDrag.lastX, touchDrag.lastY);
      }
      const nextFrame = window.requestAnimationFrame || window.setTimeout;
      autoScrollFrame = nextFrame(runDragAutoScroll, 16);
    }

    function updateDragAutoScroll(clientY) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      let nextVelocity = 0;

      // squared ramp: gentle where the finger fine-positions at the band's
      // inner edge, full speed only deep in the edge zone
      if (clientY < AUTO_SCROLL_EDGE_PX) {
        const ratio = (AUTO_SCROLL_EDGE_PX - Math.max(0, clientY)) / AUTO_SCROLL_EDGE_PX;
        nextVelocity = -ratio * ratio * MAX_AUTO_SCROLL_SPEED;
      } else if (clientY > viewportHeight - AUTO_SCROLL_EDGE_PX) {
        const ratio = (Math.min(viewportHeight, clientY) - (viewportHeight - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX;
        nextVelocity = ratio * ratio * MAX_AUTO_SCROLL_SPEED;
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

    // Evren's pick (2026-07-17, via card): horizontal swipe on a task row
    // indents/outdents, swipe distance steps through hierarchy levels.
    const SWIPE_LEVEL_PX = 32;
    const SWIPE_MAX_LEVELS = 3;

    function getSwipeLevels(dx, step = SWIPE_LEVEL_PX, max = SWIPE_MAX_LEVELS) {
      const levels = Math.trunc(dx / step);
      return Math.max(-max, Math.min(max, levels));
    }

    function applySwipeIndent(id, levels) {
      const step = levels > 0 ? indentTask : outdentTask;
      const before = findTask(id);
      const groupId = before?.group?.id;
      // indents stay inside the pre-op parent's subtree; outdents can climb
      // out of it, so they take the group-article path
      const covering = levels > 0 ? before?.parent?.id ?? null : null;
      let applied = 0;
      for (let i = 0; i < Math.abs(levels); i += 1) {
        if (!step(id, { pushUndo: applied === 0, save: false, render: false })) break;
        applied += 1;
      }
      if (applied) {
        saveState();
        renderScoped(covering, groupId);
      }
      return applied;
    }

    function clearTouchDrag() {
      if (!touchDrag) return;
      if (touchDrag.timer) window.clearTimeout?.(touchDrag.timer);
      touchDrag.source?.classList.remove("touch-dragging");
      boardEl.classList.remove("is-dragging-group", "is-touch-dragging");
      clearDropIndicators();
      // auto-scroll belongs to whichever gesture is live: the drag-to-select
      // handover at 1.5s must not stall a scroll the sweep keeps using
      if (!touchSelect?.armed) stopDragAutoScroll();
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
      // selection waits for actual movement: a still hold may yet flip into
      // drag select at 1.5s, and that must not collapse an accumulated selection
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

    function addNodeToSelection(node) {
      if (!getSelectedNodes().some((existing) => sameNode(existing, node))) {
        multiSelectedNodes = [...getSelectedNodes(), { ...node }];
      }
      selectedNode = { ...node };
      selectionAnchorNode = { ...node };
      renderSelection();
    }

    // Reversible sweep: the selection is whatever earlier holds accumulated
    // (base) plus the contiguous range from THIS sweep's anchor to the finger.
    // Dragging back toward the anchor shrinks the range, dropping rows this
    // sweep grabbed, while earlier holds persist (his phone re-test: sweep 5
    // down, then drag back 2 to drop the last two). The range also fills any
    // rows a fast finger skipped between elementFromPoint samples.
    function applySweepSelection(base, anchorNode, node) {
      const visible = getVisibleNodes();
      const a = visible.findIndex((item) => sameNode(item, anchorNode));
      const b = visible.findIndex((item) => sameNode(item, node));
      const range = a < 0 || b < 0
        ? [node]
        : visible.slice(Math.min(a, b), Math.max(a, b) + 1);
      const seen = new Set();
      const merged = [];
      for (const candidate of [...base, ...range]) {
        const key = nodeKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...candidate });
      }
      multiSelectedNodes = merged;
      selectedNode = { ...node };
      selectionAnchorNode = { ...anchorNode };
      renderSelection();
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
        const item = task("", [], { createdInGroupId: group.id });
        group.tasks.unshift(item);
        group.collapsed = false;
        setSingleSelection({ kind: "task", id: item.id });
        saveState();
        renderGroupInPlace(group.id);
        return item;
      }

      const found = findTask(node.id);
      if (!found) {
        discardUndoState();
        return null;
      }
      // Evren's spec (2026-07-17): Enter on an EXPANDED parent item creates the
      // new item as its first child; on a collapsed parent (or a childless
      // item) it creates a sibling right below at the same depth.
      const resolved = resolveTaskItem(found.item) || found.item;
      const intoChildren = !resolved.collapsed && (resolved.children || []).length > 0;
      const item = task("", [], {
        createdInGroupId: found.group?.id || null,
        createdUnderTaskId: intoChildren ? resolved.id : (found.parent?.id || null),
      });
      if (intoChildren) {
        resolved.children.unshift(item);
      } else {
        found.list.splice(found.index + 1, 0, item);
      }
      setSingleSelection({ kind: "task", id: item.id });
      saveState();
      // writing into an alias's resolved children lands in ANOTHER group's
      // subtree; only the plain same-group insert may scope
      if (found.item.linkType || getLinkCount(resolved.id) > 0) render();
      else renderScoped(intoChildren ? found.item.id : (found.parent?.id ?? null), found.group.id);
      return item;
    }

    function insertSiblingBelowSelectedNode() {
      const inserted = insertSiblingBelowNode(selectedNode);
      if (!inserted) return inserted;
      focusTaskText(inserted.id);
      return inserted;
    }

    function indentTask(id, options = {}) {
      const found = findTask(id);
      if (!found || found.index <= 0) return false;
      const newParent = found.list[found.index - 1];
      if (options.pushUndo !== false) pushUndoState("move");
      const [item] = found.list.splice(found.index, 1);
      newParent.children = newParent.children || [];
      newParent.children.push(item);
      newParent.collapsed = false;
      if (options.select !== false) setSingleSelection({ kind: "task", id });
      if (options.save !== false) saveState();
      // the pre-op parent's subtree contains both the old slot and the new
      // parent (the previous sibling); top-level indents cover via the group
      if (options.render !== false) renderScoped(found.parent?.id ?? null, found.group.id);
      return true;
    }

    function outdentTask(id, options = {}) {
      const found = findTask(id);
      if (!found || !found.parent) return false;
      const parent = findTask(found.parent.id);
      if (!parent) return false;
      if (options.pushUndo !== false) pushUndoState("move");
      const [item] = found.list.splice(found.index, 1);
      parent.list.splice(parent.index + 1, 0, item);
      if (options.select !== false) setSingleSelection({ kind: "task", id });
      if (options.save !== false) saveState();
      // the item leaves its parent P for P's own list: P's parent covers both
      if (options.render !== false) renderScoped(parent.parent?.id ?? null, found.group.id);
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

    function shiftSelectedDepth(outdent) {
      const nodes = getSelectedNodes().filter((node) => node.kind === "task");
      if (nodes.length <= 1) return outdent ? outdentSelectedNode() : indentSelectedNode();
      const selectedIds = new Set(nodes.map((node) => node.id));
      const roots = nodes.filter((node) => {
        let parent = findTask(node.id)?.parent;
        while (parent) {
          if (selectedIds.has(parent.id)) return false;
          parent = findTask(parent.id)?.parent;
        }
        return true;
      });
      const visibleOrder = getVisibleNodes().filter((node) => node.kind === "task").map((node) => node.id);
      roots.sort((a, b) => visibleOrder.indexOf(a.id) - visibleOrder.indexOf(b.id));
      const sequence = outdent ? [...roots].reverse() : roots;
      // scope check BEFORE mutating: indent/outdent never change a task's
      // group, so one shared link-free group means one article to rebuild
      const rootGroups = new Set(roots.map((node) => findTask(node.id)?.group?.id));
      const scopedGroup = rootGroups.size === 1 && roots.every((node) => taskIsLinkFree(findTask(node.id)?.item))
        ? [...rootGroups][0]
        : null;
      pushUndoState("move", `${outdent ? "Outdented" : "Indented"} ${roots.length} items`);
      let changed = false;
      sequence.forEach((node) => {
        const moved = outdent
          ? outdentTask(node.id, { pushUndo: false, save: false, render: false, select: false })
          : indentTask(node.id, { pushUndo: false, save: false, render: false, select: false });
        changed = moved || changed;
      });
      if (!changed) {
        discardUndoState();
        return false;
      }
      multiSelectedNodes = nodes.map((node) => ({ ...node }));
      if (!nodes.some((node) => sameNode(node, selectedNode))) selectedNode = { ...nodes[0] };
      saveState();
      if (scopedGroup) renderGroupInPlace(scopedGroup);
      else render();
      return true;
    }

    // focus-outline moves stay inside the sibling list, unlike the board's
    // visual move which crosses parents and groups
    function moveTaskAmongSiblings(id, direction) {
      const found = findTask(id);
      if (!found || !found.list) return false;
      const to = found.index + direction;
      if (to < 0 || to >= found.list.length) return false;
      pushUndoState("move", `Moved "${shortText(resolveTaskItem(found.item)?.text)}"`);
      found.list.splice(to, 0, found.list.splice(found.index, 1)[0]);
      saveState();
      renderScoped(found.parent?.id ?? null, found.group.id);
      return true;
    }

    function moveTaskVisually(id, direction) {
      const found = findTask(id);
      if (!found) return false;
      const visible = getVisibleNodes().filter((node) => node.kind === "task" || node.kind === "group");
      const index = visible.findIndex((node) => node.kind === "task" && node.id === id);
      if (index < 0) return moveSelectedNodes(direction) || false;

      const descendantIds = new Set();
      (function collect(items) {
        (items || []).forEach((child) => {
          descendantIds.add(child.id);
          collect(child.children);
        });
      })(found.item.children);

      let target = null;
      if (direction > 0) {
        for (let cursor = index + 1; cursor < visible.length; cursor += 1) {
          const candidate = visible[cursor];
          if (candidate.kind === "task" && descendantIds.has(candidate.id)) continue;
          target = candidate;
          break;
        }
      } else {
        target = index > 0 ? visible[index - 1] : null;
      }
      if (!target) return false;

      pushUndoState("move", `Moved "${shortText(resolveTaskItem(found.item)?.text)}"`);
      const [item] = found.list.splice(found.index, 1);

      let placed = false;
      if (direction > 0) {
        if (target.kind === "group") {
          const group = findGroup(target.id);
          if (group) {
            group.tasks.unshift(item);
            group.collapsed = false;
            placed = true;
          }
        } else {
          const dest = findTask(target.id);
          if (dest) {
            if ((dest.item.children || []).length && !dest.item.collapsed) {
              dest.item.children.unshift(item);
            } else {
              dest.list.splice(dest.index + 1, 0, item);
            }
            placed = true;
          }
        }
      } else if (target.kind === "group") {
        const groupIndex = state.groups.findIndex((group) => group.id === target.id);
        const previousGroup = state.groups[groupIndex - 1];
        if (previousGroup) {
          previousGroup.tasks.push(item);
          previousGroup.collapsed = false;
          placed = true;
        }
      } else {
        const dest = findTask(target.id);
        if (dest) {
          dest.list.splice(dest.index, 0, item);
          placed = true;
        }
      }

      if (!placed) {
        found.list.splice(found.index, 0, item);
        discardUndoState();
        return false;
      }
      setSingleSelection({ kind: "task", id });
      saveState();
      render();
      return true;
    }

    function addTask(groupId, parentId = null) {
      pushUndoState("board", "Added a task");
      const item = task("", [], {
        createdInGroupId: groupId,
        createdUnderTaskId: parentId,
      });
      let scopedOk = true;
      if (parentId) {
        const parent = findTask(parentId);
        if (!parent) {
          discardUndoState();
          return null;
        }
        const resolvedParent = resolveTaskItem(parent.item);
        resolvedParent.children = resolvedParent.children || [];
        resolvedParent.children.push(item);
        if (parent.item.linkType === "alias") {
          parent.item.children = parent.item.children || [];
          parent.item.children.push(createLinkedTaskTree(item, "alias", groupId, parent.item.id));
        }
        parent.item.collapsed = false;
        // an aliased parent mirrors the new child into other groups' subtrees
        scopedOk = !parent.item.linkType && getLinkCount(resolvedParent.id) === 0;
      } else {
        const group = findGroup(groupId);
        if (!group) {
          discardUndoState();
          return null;
        }
        group.tasks.push(item);
      }
      setSingleSelection({ kind: "task", id: item.id });
      saveState();
      if (scopedOk) renderScoped(parentId || null, groupId);
      else render();
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

    function startOwnBoard() {
      if (typeof window.confirm === "function"
        && !window.confirm("Remove the example tasks and start your own empty board? Export JSON first if you want to keep them.")) {
        return;
      }
      state = normalizeState({ version: SCHEMA_VERSION, settings: state.settings, example: false });
      selectedNode = null;
      multiSelectedNodes = [];
      selectionAnchorNode = null;
      undoStack = [];
      undoActions = [];
      lastUndoAction = null;
      exitFocusMode();
      addGroup();
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
          if (taskMatchesFilter(item, query)) {
            nodes.push({ kind: "task", id: item.id });
            if (!item.linkType) {
              (resolveTaskItem(item)?.images || []).forEach((img) => {
                nodes.push({ kind: "image", id: img.id, taskId: item.id });
              });
            }
          }
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

    function findImageNode(imageId) {
      for (const group of state.groups) {
        const stack = [...group.tasks];
        while (stack.length) {
          const item = stack.pop();
          const image = (resolveTaskItem(item)?.images || []).find((img) => img.id === imageId);
          if (image && !item.linkType) return { taskId: item.id, image };
          stack.push(...(item.children || []));
        }
      }
      return null;
    }

    function removeTaskImage(taskId, imageId) {
      const found = findTask(taskId);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      pushUndoState("delete", "Removed an image");
      item.images = (item.images || []).filter((img) => img.id !== imageId);
      setSingleSelection({ kind: "task", id: item.id });
      saveState();
      render();
      return true;
    }

    function nodeExists(node) {
      if (!node) return false;
      if (node.kind === "section") return node.id === "completed" || node.id === "trash";
      if (node.kind === "image") return Boolean(findImageNode(node.id));
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
        // Never scroll while a press is in flight: mousedown on a half-visible
        // row's checkbox focuses it -> focusin selects -> this scroll moved the
        // row before mouseup, so the click resolved to an ancestor and the
        // checkbox never toggled (Evren: "only selects, doesn't check").
        if (!focusIsElsewhere && !boardPressActive) row.scrollIntoView({ block: "nearest" });
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

    function selectHierarchicalParent() {
      if (selectedNode?.kind === "image") {
        const info = findImageNode(selectedNode.id);
        if (info) {
          selectNode("task", info.taskId);
          return true;
        }
        return false;
      }
      if (selectedNode?.kind !== "task") return false;
      const found = findTask(selectedNode.id);
      if (found?.parent) {
        selectNode("task", found.parent.id);
        return true;
      }
      if (found?.group) {
        selectNode("group", found.group.id);
        return true;
      }
      return false;
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
      saveStateDebounced();
      return true;
    }

    const INLINE_STYLE_TAGS = { strong: "**", b: "**", em: "*", i: "*", del: "~~", s: "~~", strike: "~~" };

    function serializeEditableNode(node) {
      if (node.nodeType === 3) return node.nodeValue || "";
      const tagName = node.tagName?.toLowerCase();
      if (tagName === "br") return "\n";
      if (tagName === "a") {
        const href = node.getAttribute("href") || "";
        return node.dataset?.autoLink === "true"
          ? href
          : `[${node.textContent || href}](${href})`;
      }
      const inner = [...(node.childNodes || [])].map(serializeEditableNode).join("");
      const marker = INLINE_STYLE_TAGS[tagName];
      return marker ? marker + inner + marker : inner;
    }

    function getMarkdownTextFromEditable(valueOrElement) {
      if (typeof valueOrElement === "string" || !valueOrElement?.childNodes) {
        return getEditableText(valueOrElement);
      }
      return [...valueOrElement.childNodes].map(serializeEditableNode).join("").replace(/\u00a0/g, " ").trim();
    }

    // Markdown offset of a DOM point inside a task editable. Rendered text
    // hides link/style markers, so DOM-range character counts diverge from
    // markdown offsets (the known caret pinch point); this walks the same
    // rules as serializeEditableNode, counting an element's opening marker on
    // the way in and its closing marker only once the point is past it.
    function getMarkdownCaretOffset(element, container, offsetInContainer) {
      let offset = 0;
      let found = false;
      function walk(node) {
        if (found) return;
        if (node.nodeType === 3) {
          const text = node.nodeValue || "";
          if (node === container) {
            offset += Math.max(0, Math.min(text.length, offsetInContainer));
            found = true;
          } else {
            offset += text.length;
          }
          return;
        }
        const tagName = node.tagName?.toLowerCase();
        if (tagName === "br") {
          offset += 1;
          return;
        }
        const styleMarker = INLINE_STYLE_TAGS[tagName];
        const wrap = tagName === "a" && node.dataset?.autoLink !== "true"
          ? ["[", `](${node.getAttribute("href") || ""})`]
          : styleMarker ? [styleMarker, styleMarker] : ["", ""];
        offset += wrap[0].length;
        const kids = [...(node.childNodes || [])];
        const limit = node === container ? Math.max(0, Math.min(offsetInContainer, kids.length)) : kids.length;
        for (let index = 0; index < limit && !found; index += 1) walk(kids[index]);
        if (node === container) {
          found = true;
          return;
        }
        if (!found) offset += wrap[1].length;
      }
      walk(element);
      return offset;
    }

    // Toggle an inline style marker over [start, end) of markdown `text`.
    // Pure. Collapsed selections expand to the word under the caret (marker
    // chars excluded, so a caret inside **bold** grabs just "bold"). Returns
    // null when there is nothing to toggle, else { text, start, end, caret }
    // with markdown offsets; caret sits just past the toggled span.
    function toggleMarkdownStyle(text, start, end, marker) {
      const src = String(text || "");
      const len = marker.length;
      const ch = marker[0];
      let from = Math.max(0, Math.min(src.length, Number(start) || 0));
      let to = Math.max(from, Math.min(src.length, Number(end) || 0));
      if (from === to) {
        const isWordChar = (value) => Boolean(value) && !/[\s*~]/.test(value);
        while (isWordChar(src[from - 1])) from -= 1;
        while (isWordChar(src[to])) to += 1;
        if (from === to) return null;
      }
      while (from < to && /\s/.test(src[from])) from += 1;
      while (to > from && /\s/.test(src[to - 1])) to -= 1;
      if (from === to) return null;
      // marker-char runs hugging the selection decide presence: for * a run
      // is italic only when its count is odd (** is bold, *** is both); for
      // ** and ~~ any run of 2+ carries the style.
      let before = 0;
      while (src[from - before - 1] === ch) before += 1;
      let after = 0;
      while (src[to + after] === ch) after += 1;
      const wrapped = len === 2 ? before >= 2 && after >= 2 : before % 2 === 1 && after % 2 === 1;
      if (wrapped) {
        const next = src.slice(0, from - len) + src.slice(from, to) + src.slice(to + len);
        return { text: next, start: from - len, end: to - len, caret: to - len };
      }
      const sel = src.slice(from, to);
      const inner = sel.slice(len, -len);
      if (sel.length >= len * 2 + 1 && sel.startsWith(marker) && sel.endsWith(marker) && !inner.includes(marker)) {
        return { text: src.slice(0, from) + inner + src.slice(to), start: from, end: to - len * 2, caret: to - len * 2 };
      }
      return {
        text: src.slice(0, from) + marker + sel + marker + src.slice(to),
        start: from + len,
        end: to + len,
        caret: to + len * 2,
      };
    }

    function renderedTextLength(markdown) {
      const probe = document.createElement?.("div");
      if (!probe) return String(markdown || "").length;
      probe.innerHTML = renderInlineMarkdown(markdown);
      return (probe.textContent || "").length;
    }

    // Ctrl+B / Ctrl+I / Ctrl+Shift+S inside a task editable (board row or
    // focus overlay): toggle the marker on the markdown model, re-render just
    // this editable, and drop the caret after the toggled span.
    function toggleEditableStyle(editable, marker) {
      const selection = window.getSelection?.();
      if (!selection || !selection.rangeCount || !selectionContainsEditableContents(editable)) return false;
      const id = editable.dataset.taskText || editable.dataset.focusTaskText;
      const found = id ? findTask(id) : null;
      if (!found) return false;
      const range = selection.getRangeAt(0);
      // untrimmed serialization so the DOM-derived offsets line up
      const source = [...editable.childNodes].map(serializeEditableNode).join("").replace(/\u00a0/g, " ");
      const start = getMarkdownCaretOffset(editable, range.startContainer, range.startOffset);
      const end = getMarkdownCaretOffset(editable, range.endContainer, range.endOffset);
      const toggled = toggleMarkdownStyle(source, Math.min(start, end), Math.max(start, end), marker);
      if (!toggled) return false;
      pushUndoState("board", "Formatted task text");
      const lead = toggled.text.length - toggled.text.replace(/^\s+/, "").length;
      const item = resolveTaskItem(found.item);
      item.text = toggled.text.trim();
      saveStateDebounced();
      if (editable.dataset.focusTaskText) boardStaleBehindFocus = true;
      editable.innerHTML = renderInlineMarkdown(item.text);
      // caret target in rendered-text coordinates: render the markdown prefix
      // up to just past the toggled span and measure its visible length
      placeCaretAtTextOffset(editable, renderedTextLength(item.text.slice(0, Math.max(0, toggled.caret - lead))));
      return true;
    }

    function applyUrlPasteToText(text, start, end, url) {
      const source = String(text || "");
      const safeStart = Math.max(0, Math.min(source.length, Number(start) || 0));
      const safeEnd = Math.max(safeStart, Math.min(source.length, Number(end) || 0));
      if (!/^https?:\/\/\S+$/i.test(url) || safeStart === safeEnd) return source;
      const label = source.slice(safeStart, safeEnd);
      return `${source.slice(0, safeStart)}[${label}](${url})${source.slice(safeEnd)}`;
    }

    // Evren's pick (2026-07-17, via card): Backspace at the very start of a
    // task's text merges it into the item above, like outliners. The merged
    // item's children follow it: into the parent at the same spot, or adopted
    // by the previous item.
    function mergeTaskIntoPrevious(id) {
      const found = findTask(id);
      if (!found || found.item.linkType) return false;
      const visible = getVisibleNodes();
      const index = visible.findIndex((node) => node.kind === "task" && node.id === id);
      if (index <= 0) return false;
      const prev = visible[index - 1];
      const prevId = prev.kind === "task" ? prev.id : prev.kind === "image" ? prev.taskId : null;
      if (!prevId) return false;
      const prevFound = findTask(prevId);
      if (!prevFound || prevFound.item.linkType) return false;
      const target = resolveTaskItem(prevFound.item);
      const item = resolveTaskItem(found.item);
      pushUndoState("board", `Merged "${shortText(item.text)}" into "${shortText(target.text)}"`);
      target.text = (target.text || "") + (item.text || "");
      found.list.splice(found.index, 1);
      const children = item.children || [];
      if (children.length) {
        if (prevFound.item === found.parent) found.list.splice(found.index, 0, ...children);
        else target.children = [...(target.children || []), ...children];
      }
      setSingleSelection({ kind: "task", id: target.id });
      saveState();
      // merged text fans out through any linked placement of either item
      if (taskIsLinkFree(prevFound.item) && !getLinkCount(item.id)) renderScoped(found.parent?.id ?? null, found.group.id);
      else render();
      return true;
    }

    function handleEditingBackspaceDelete(event) {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return false;
      if (isEditableTextEmpty(textEl)) {
        event.preventDefault();
        deleteTaskAndSelectNeighbor(textEl.dataset.taskText, { forcePermanent: true });
        return true;
      }
      if (event.key === "Backspace" && window.getSelection?.()?.isCollapsed && getCaretOffset(textEl) === 0) {
        const id = textEl.dataset.taskText;
        event.preventDefault();
        const targetId = (() => {
          const visible = getVisibleNodes();
          const index = visible.findIndex((node) => node.kind === "task" && node.id === id);
          const prev = index > 0 ? visible[index - 1] : null;
          return prev?.kind === "task" ? prev.id : prev?.kind === "image" ? prev.taskId : null;
        })();
        const caretBase = targetId ? (document.querySelector(`[data-task-text="${targetId}"]`)?.textContent || "").length : 0;
        if (!mergeTaskIntoPrevious(id)) return true;
        const targetEl = document.querySelector(`[data-task-text="${targetId}"]`);
        if (targetEl) placeCaretAtTextOffset(targetEl, caretBase);
        return true;
      }
      return false;
    }

    function placeCaretAtTextOffset(element, offset) {
      element.focus();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let remaining = Math.max(0, offset);
      let node;
      while ((node = walker.nextNode())) {
        if (remaining <= node.textContent.length) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        remaining -= node.textContent.length;
      }
      focusEditableText(element, false);
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
      // Enter at the start of a NON-empty item pushes a fresh empty line ABOVE,
      // at the same depth, and drops his caret into it — he wants to write
      // before an item (Evren 2026-07-19 PM, reversing the 2026-07-19 AM call).
      // A fully empty line is the one exception: Enter there creates BELOW.
      if (caret === 0 && source !== "") return { beforeText: source, afterText: "", position: "before" };
      return {
        beforeText: source.slice(0, caret),
        afterText: source.slice(caret),
        position: "after",
      };
    }

    function getCaretOffset(element) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return getMarkdownTextFromEditable(element).length;
      const range = selection.getRangeAt(0);
      if (!selectionContainsEditableContents(element, range)) return getMarkdownTextFromEditable(element).length;
      // markdown offset, not rendered-text offset: callers feed this into
      // splits over item.text, and the fallbacks above already return
      // markdown lengths (the old rendered-domain count drifted past links)
      return getMarkdownCaretOffset(element, range.endContainer, range.endOffset);
    }

    function caretOnBoundaryLine(editable, direction) {
      const selection = window.getSelection?.();
      if (!selection || !selection.rangeCount) return true;
      const caret = selection.getRangeAt(0);
      // ranges from the text edges to the caret; their edge rects give the
      // caret's visual line without touching the live selection
      const pre = document.createRange();
      pre.selectNodeContents(editable);
      const post = pre.cloneRange();
      try {
        pre.setEnd(caret.startContainer, caret.startOffset);
        post.setStart(caret.endContainer, caret.endOffset);
      } catch {
        return true;
      }
      if (direction < 0 && pre.toString().length === 0) return true;
      if (direction > 0 && post.toString().length === 0) return true;
      const box = editable.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(editable).lineHeight) || 20;
      if (direction < 0) {
        const rects = pre.getClientRects();
        const caretLineTop = rects.length ? rects[rects.length - 1].top : box.top;
        return caretLineTop - box.top < lineHeight * 0.6;
      }
      const rects = post.getClientRects();
      const caretLineBottom = rects.length ? rects[0].bottom : box.bottom;
      return box.bottom - caretLineBottom < lineHeight * 0.6;
    }

    function splitTaskAtOffset(id, offset) {
      const found = findTask(id);
      if (!found) return null;
      const plan = getTaskSplitPlan(found.item.text, offset);
      pushUndoState("split");

      // Evren's spec (2026-07-17): Enter at the END of an EXPANDED parent's
      // text creates the new item as its first child; collapsed parents and
      // childless items get a sibling below. Mid-text splits stay siblings.
      const resolvedSplit = resolveTaskItem(found.item) || found.item;
      const before = plan.position === "before";
      const intoChildren = !before && plan.afterText === ""
        && !resolvedSplit.collapsed && (resolvedSplit.children || []).length > 0;
      const newItem = task(before ? "" : plan.afterText, [], {
        createdInGroupId: found.group?.id || found.item.createdInGroupId,
        createdUnderTaskId: intoChildren ? resolvedSplit.id : (found.parent?.id || null),
      });
      if (intoChildren) {
        resolvedSplit.children.unshift(newItem);
      } else if (before) {
        // new empty sibling ABOVE; his original text is untouched
        found.list.splice(found.index, 0, newItem);
      } else {
        found.item.text = plan.beforeText;
        found.list.splice(found.index + 1, 0, newItem);
      }

      setSingleSelection({ kind: "task", id: newItem.id });
      saveState();
      // the rewritten text of the split task shows in every linked placement
      if (taskIsLinkFree(found.item)) renderScoped(intoChildren ? found.item.id : (found.parent?.id ?? null), found.group.id);
      else render();
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
        bg: `color-mix(in srgb, ${color} 13%, white)`,
        selected: `color-mix(in srgb, ${color} 26%, white)`,
        border: `color-mix(in srgb, ${color} 48%, white)`,
        ink: `color-mix(in srgb, ${color} 74%, black)`,
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
      boardState.example = Boolean(boardState.example);
      boardState.settings = {
        ...DEFAULT_SETTINGS,
        ...(boardState.settings && typeof boardState.settings === "object" ? boardState.settings : {}),
      };
      boardState.trash = Array.isArray(boardState.trash) ? boardState.trash : [];
      boardState.history = Array.isArray(boardState.history) ? boardState.history.slice(-50) : [];
      boardState.devices = boardState.devices && typeof boardState.devices === "object" && !Array.isArray(boardState.devices) ? boardState.devices : {};
      boardState.contacts = boardState.contacts && typeof boardState.contacts === "object" && !Array.isArray(boardState.contacts) ? boardState.contacts : {};
      boardState.identity = boardState.identity && typeof boardState.identity === "object" && boardState.identity.privateKeyJwk && boardState.identity.publicKeyJwk ? boardState.identity : null;
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
          .filter((img) => img && (typeof img.assetId === "string" || (typeof img.src === "string" && img.src.startsWith("data:image/"))))
          .map((img) => ({
            id: typeof img.id === "string" ? img.id : createId("img"),
            ...(typeof img.assetId === "string" ? { assetId: img.assetId } : { src: img.src }),
            width: Number(img.width) > 0 ? Math.round(Number(img.width)) : 260,
            caption: typeof img.caption === "string" ? img.caption : "",
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
      renderGroupInPlace(id);
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
      // Only children that will actually render count. A chevron over children
      // that are all completed-and-hidden (or filtered out) reveals an empty
      // list on toggle — the "toggle reveals nothing" bug. Base the twisty on
      // what a toggle would truly show, matching renderTask's own skip rules.
      const visibleChildren = children.filter(
        (child) => !isTaskHiddenFromActive(child, group) && taskMatchesFilter(child, query)
      );
      const hasChildren = visibleChildren.length > 0;
      const expanded = hasChildren && (!item.collapsed || Boolean(query));
      const childHtml = expanded
        ? `<ul class="child-list">${visibleChildren.map((child) => renderTask(child, groupId, query)).join("")}</ul>`
        : "";
      const dropChild = hasChildren
        ? `<div class="drop-zone child" data-drop-target="${item.id}" data-position="child" aria-hidden="true"></div>`
        : "";
      const images = resolved?.images || [];
      const imagesHtml = images.length && !item.linkType
        ? `<div class="task-images">${images.map((img) => {
          const src = getAssetSrc(img);
          const width = Math.max(60, Number(img.width) || 260);
          // bytes not local yet (asset still syncing in): a sized placeholder
          // holds the slot so nothing jumps when the image lands
          const body = src
            ? `<img src="${src}" style="width: ${width}px" alt="Pasted image" draggable="false" decoding="sync">`
            : `<span class="image-pending" style="width: ${width}px" title="Image is syncing in">…</span>`;
          return `
            <span class="task-image ${isSelected("image", img.id) ? "selected" : ""}" data-node-kind="image" data-node-id="${img.id}" data-image-task="${resolved.id}" tabindex="0">
              <span class="task-image-frame">
                <span class="image-handle" data-image-handle="left" data-image-id="${img.id}" data-image-task="${resolved.id}" title="Drag to resize"></span>
                ${body}
                <span class="image-handle" data-image-handle="right" data-image-id="${img.id}" data-image-task="${resolved.id}" title="Drag to resize"></span>
                <button class="image-remove" type="button" data-image-remove="${img.id}" data-image-task="${resolved.id}" title="Remove image" aria-label="Remove image">×</button>
              </span>
              <span class="image-caption ${img.caption ? "" : "empty"}" contenteditable="true" spellcheck="true" data-image-caption="${img.id}" data-image-task="${resolved.id}" aria-label="Image caption">${escapeHtml(img.caption || "")}</span>
            </span>`;
        }).join("")}</div>`
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
      const empty = visibleTasks.trim()
        ? ""
        : `<p class="empty">${query ? "No tasks match this search." : "No tasks yet. Select the group and press Enter to add one."}</p>`;
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
                  <span class="delete-confirm-text">Delete ${pendingGroupDelete.label || "this group"}?</span>
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
        const deviceLabel = entry.deviceId ? deviceDisplayName(entry.deviceId) : "";
        let restoreId = entry.trashId && state.trash.some((record) => record.id === entry.trashId) ? entry.trashId : null;
        if (!restoreId && /^Deleted /.test(entry.text)) {
          const quoted = entry.text.match(/"(.+)"$/)?.[1];
          if (quoted) {
            const match = state.trash.find((record) => {
              const label = record.kind === "group" ? record.item.title : (resolveTaskItem(record.item)?.text || record.item.text || "");
              return shortText(label) === quoted;
            });
            restoreId = match?.id || null;
          }
        }
        const restorable = Boolean(restoreId);
        return `
          <details class="history-row">
            <summary><span class="disclosure-arrow" aria-hidden="true"></span><span class="history-time">${label}</span><span class="history-text">${escapeHtml(entry.text)}</span></summary>
            <div class="history-detail">
              ${escapeHtml(fullStamp)}${escapeHtml(kindLabel)}${deviceLabel ? escapeHtml(` · ${deviceLabel}`) : ""}
              ${restorable ? `<button class="control compact" type="button" data-action="restore-trash" data-trash-id="${restoreId}">Restore</button>` : ""}
            </div>
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

    function describeTrashOrigin(record) {
      if (record?.kind === "group") return "Top-level group";
      const source = record?.source || {};
      const group = findGroup(source.groupId);
      const parent = source.parentId ? findTask(source.parentId) : null;
      let label = group ? `In ${group.title}` : "In a removed group";
      if (parent) label += ` › ${shortText(resolveTaskItem(parent.item)?.text || "")}`;
      return label;
    }

    function renderLifecycleSections() {
      const completed = getCompletedEntries()
        .sort((a, b) => (Date.parse(b.item.completedAt) || 0) - (Date.parse(a.item.completedAt) || 0));
      const completedRows = completed.length
        ? completed.map(({ item, group }) => {
          const found = findTask(item.id);
          const location = found ? getTaskLocationLabel(found) : group.title;
          const when = item.completedAt ? describeRelativeDateTime(item.completedAt) : "";
          return `
          <details class="lifecycle-row">
            <summary>
              <span class="disclosure-arrow" aria-hidden="true"></span>
              <span class="lifecycle-task">${renderInlineMarkdown(item.text)}</span>
              <span class="lifecycle-context">${escapeHtml(group.title)}</span>
              <button class="control compact" type="button" data-action="restore-completed" data-task-id="${item.id}">Restore</button>
            </summary>
            <div class="lifecycle-detail">In ${escapeHtml(location)}${when ? ` · completed ${escapeHtml(when)}` : ""}</div>
          </details>
        `;
        }).join("")
        : '<p class="empty">No completed tasks are hidden.</p>';
      const trashRows = state.trash.length
        ? state.trash.slice().reverse().map((record) => {
          const label = record.kind === "group"
            ? record.item.title
            : (resolveTaskItem(record.item)?.text || record.item.text || "Deleted task");
          const when = record.deletedAt ? describeRelativeDateTime(record.deletedAt) : "";
          return `
            <details class="lifecycle-row">
              <summary>
                <span class="disclosure-arrow" aria-hidden="true"></span>
                <span class="lifecycle-task">${renderInlineMarkdown(label)}</span>
                <span class="lifecycle-context">${record.wasCompleted ? "Completed and deleted" : "Deleted"}</span>
                <button class="control compact" type="button" data-action="restore-trash" data-trash-id="${record.id}">Restore</button>
                <button class="control compact danger" type="button" data-action="purge-trash" data-trash-id="${record.id}">Purge</button>
              </summary>
              <div class="lifecycle-detail">${escapeHtml(describeTrashOrigin(record))}${when ? ` · deleted ${escapeHtml(when)}` : ""}</div>
            </details>
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

    function hideToast() {
      if (!toastEl) return;
      toastEl.classList.remove("visible");
      toastEl.classList.remove("toast--rich");
      toastEl.hidden = true;
      if (toastTimer !== null && typeof window.clearTimeout === "function") window.clearTimeout(toastTimer);
      toastTimer = null;
    }

    function flashToast(durationMs) {
      if (!toastEl) return;
      toastEl.hidden = false;
      toastEl.classList.add("visible");
      if (toastTimer !== null && typeof window.clearTimeout === "function") window.clearTimeout(toastTimer);
      if (typeof window.setTimeout === "function") toastTimer = window.setTimeout(hideToast, durationMs);
    }

    function showToast(message) {
      if (!toastEl) return;
      toastEl.classList.remove("toast--rich");
      toastEl.textContent = message;
      flashToast(4200);
    }

    // Numeric semver compare: 1 if a>b, -1 if a<b, 0 if equal. A leading "v" and
    // short or non-numeric parts are tolerated; missing parts count as zero.
    function compareVersions(a, b) {
      const parse = (v) => String(v).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
      const pa = parse(a);
      const pb = parse(b);
      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff) return diff > 0 ? 1 : -1;
      }
      return 0;
    }

    // Only a downloaded copy checks, only when the setting is on, never in demo.
    function updateChecksEnabled() {
      return IS_LOCAL_FILE && !IS_DEMO && state.settings.checkForUpdates !== false;
    }

    // Fire-and-forget on load: one GitHub Releases request, silent on any
    // failure (offline, rate limit, bad JSON). Never blocks or alarms.
    async function checkForUpdate() {
      if (!updateChecksEnabled() || typeof fetch !== "function") return;
      try {
        const response = await fetch(UPDATE_RELEASE_API, { cache: "no-store" });
        if (!response.ok) return;
        const release = await response.json();
        const latest = String(release?.tag_name || "").trim();
        if (!latest || compareVersions(latest, APP_VERSION) <= 0) return;
        const dismissed = localStorage.getItem(UPDATE_DISMISS_KEY) || "";
        if (dismissed && compareVersions(latest, dismissed) <= 0) return;
        showUpdateToast(latest, String(release?.html_url || UPDATE_RELEASES_PAGE));
      } catch {
        // offline, blocked, rate-limited, or malformed: skip in silence.
      }
    }

    // Reuses the toast element and its show/fade; the rich variant just carries
    // links and an X. Guarded so the DOM-less vm harness is a safe no-op.
    function showUpdateToast(latest, releaseUrl) {
      if (!toastEl || typeof document.createElement !== "function") return;
      toastEl.textContent = "";
      toastEl.classList.add("toast--rich");
      const message = document.createElement("span");
      message.textContent = `A newer version of Punchlist is available (${latest}).`;
      const actions = document.createElement("span");
      actions.className = "toast-actions";
      const linkTo = (href, text) => {
        const link = document.createElement("a");
        link.className = "toast-action";
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = text;
        return link;
      };
      actions.append(linkTo(releaseUrl, `Get ${latest}`), linkTo(UPDATE_NOTES_URL, "What changed"));
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "toast-dismiss";
      dismiss.setAttribute("aria-label", "Dismiss");
      dismiss.textContent = "×";
      dismiss.addEventListener("click", () => {
        localStorage.setItem(UPDATE_DISMISS_KEY, latest);
        hideToast();
      });
      toastEl.append(message, actions, dismiss);
      flashToast(12000);
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
      const ownsLinkCache = !linkCountCache;
      if (ownsLinkCache) linkCountCache = buildLinkCountCache();
      try {
        renderEverything();
      } finally {
        if (ownsLinkCache) linkCountCache = null;
      }
    }

    function renderEverything() {
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
      if (exampleBannerHostEl) {
        exampleBannerHostEl.innerHTML = state.example && showList
          ? '<div class="example-banner"><span>These are example tasks. Click around, then clear them when you are ready.</span><button class="control primary" type="button" data-action="start-own-board">Start my own board</button></div>'
          : "";
      }
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

    // Scoped render (grill Q23, 2026-07-19): rebuild ONE group's article
    // instead of the whole board — a full rebuild cost 75ms at 4500 nodes,
    // 4-5 dropped frames on every create/indent (the reported flash).
    // Callers guarantee the operation touched only this group; anything the
    // fast path cannot prove safe at runtime falls back to render().
    function renderGroupInPlace(groupId) {
      const ownsLinkCache = !linkCountCache;
      if (ownsLinkCache) linkCountCache = buildLinkCountCache();
      try {
        renderGroupInPlaceInner(groupId);
      } finally {
        if (ownsLinkCache) linkCountCache = null;
      }
    }

    function renderGroupInPlaceInner(groupId) {
      const index = state.groups.findIndex((group) => group.id === groupId);
      const article = document.querySelector?.(`[data-group-card="${groupId}"]`);
      const query = searchEl?.value?.trim().toLowerCase() || "";
      // search re-filters globally; vm and hidden-board render nothing to swap
      if (index < 0 || !article || boardEl.hidden || query) {
        render();
        return;
      }
      const wrap = document.createElement("div");
      wrap.innerHTML = renderGroup(state.groups[index], "", index);
      article.replaceWith(wrap.firstElementChild);
      // the 1s maintenance loop diffs this; a stale value forces a redundant
      // full render one second later and masks scoping bugs
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode) renderSelection();
    }

    // Scoping v2 (Evren 2026-07-19, "mainly sub items flash"): his boards are
    // a few HUGE groups, so a group-article swap is nearly a full render
    // (~150ms measured) and shifts the viewport ~90px on nested creates. A
    // task-subtree swap replaces one <li> — the drop zones ride inside it —
    // and leaves layout above and below untouched.
    function renderTaskSubtreeInPlace(taskId, groupId) {
      const ownsLinkCache = !linkCountCache;
      if (ownsLinkCache) linkCountCache = buildLinkCountCache();
      try {
        renderTaskSubtreeInPlaceInner(taskId, groupId);
      } finally {
        if (ownsLinkCache) linkCountCache = null;
      }
    }

    function renderTaskSubtreeInPlaceInner(taskId, groupId) {
      const li = document.querySelector?.(`li[data-task="${taskId}"]`);
      const found = li ? findTask(taskId) : null;
      const query = searchEl?.value?.trim() || "";
      if (!li || !found || boardEl.hidden || query) {
        renderGroupInPlace(groupId);
        return;
      }
      const wrap = document.createElement("div");
      wrap.innerHTML = renderTask(found.item, found.group?.id || groupId, "");
      li.replaceWith(wrap.firstElementChild);
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode) renderSelection();
    }

    // Route a scoped render to the smallest container that covers the change:
    // a task subtree when one exists, else the group article.
    function renderScoped(coveringTaskId, groupId) {
      if (coveringTaskId) renderTaskSubtreeInPlace(coveringTaskId, groupId);
      else renderGroupInPlace(groupId);
    }

    // A task placement is safe for scoped rendering only when nothing else
    // mirrors it: not a linked copy itself, and no other group holds a
    // placement of it (text/done/children/badges fan out through the links).
    function taskIsLinkFree(item) {
      if (!item || item.linkType) return false;
      const resolved = resolveTaskItem(item);
      return !resolved || getLinkCount(resolved.id) === 0;
    }

    function subtreeIsLinkFree(item) {
      if (!item) return true;
      if (item.linkType || getLinkCount(item.id) > 0) return false;
      return (item.children || []).every(subtreeIsLinkFree);
    }

    // Deletes move rows into the Completed/Trash details at the board bottom;
    // a scoped delete swaps those two sections alongside the group article.
    function refreshLifecycleSections() {
      const completed = document.querySelector?.("[data-completed-section]");
      const trash = document.querySelector?.("[data-trash-section]");
      if (!completed || !trash) return false;
      const wrap = document.createElement("div");
      wrap.innerHTML = renderLifecycleSections();
      const freshCompleted = wrap.querySelector("[data-completed-section]");
      const freshTrash = wrap.querySelector("[data-trash-section]");
      freshCompleted.open = completed.open;
      freshTrash.open = trash.open;
      completed.replaceWith(freshCompleted);
      trash.replaceWith(freshTrash);
      return true;
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
      // Links and bare URLs first in the alternation (a URL may contain * or
      // ~, so links must win); style spans (*** ** * ~~) render recursively
      // so **a [link](u) b** styles both. Closing markers reject a trailing
      // marker char, otherwise **bold *in*** would close two chars early.
      // Italic WRAPPING bold (*a **b** c*) is beyond one regex pass and
      // degrades to literal markers; the common nesting (***both***, bold
      // around italic) works.
      const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)|\*\*\*(?!\s)(.+?)(?<!\s)\*\*\*(?!\*)|\*\*(?!\s)(.+?)(?<!\s)\*\*(?!\*)|\*(?!\s)(.+?)(?<!\s)\*(?!\*)|~~(?!\s)(.+?)(?<!\s)~~(?!~)/gi;
      let html = "";
      let cursor = 0;
      let match;
      while ((match = pattern.exec(source))) {
        html += escapeHtml(source.slice(cursor, match.index));
        const styled = match[4] || match[5] || match[6] || match[7];
        if (styled) {
          const inner = renderInlineMarkdown(styled);
          html += match[4] ? `<strong><em>${inner}</em></strong>`
            : match[5] ? `<strong>${inner}</strong>`
            : match[6] ? `<em>${inner}</em>`
            : `<del>${inner}</del>`;
        } else {
          const label = match[1] || match[3];
          const url = match[2] || match[3];
          const autoLink = match[3] ? ' data-auto-link="true"' : "";
          html += `<a class="task-link" data-task-link href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Opens in a new tab"${autoLink}>${escapeHtml(label)}</a>`;
        }
        cursor = pattern.lastIndex;
      }
      return html + escapeHtml(source.slice(cursor)).replace(/\n/g, "<br>");
    }

    // Focus mode never rendered a task's photos (Evren: photos don't show).
    // Reuse the board's asset resolution; a pending asset just renders nothing
    // here rather than a resize placeholder, since focus is read-only.
    function renderFocusImages(item, cls) {
      const imgs = item?.images || [];
      if (!imgs.length || item.linkType) return "";
      return imgs.map((img) => {
        const src = getAssetSrc(img);
        return src
          ? `<img class="${cls}" src="${src}" alt="${escapeHtml(img.caption || "Image")}" draggable="false" decoding="sync">`
          : "";
      }).join("");
    }

    function renderFocusChildren(tasks, depth = 0, group = null) {
      const visible = (tasks || []).filter((item) => !(group && isTaskHiddenFromActive(item, group)));
      if (!visible.length) return "";
      const items = visible.map((item) => {
        const resolved = resolveTaskItem(item);
        const done = Boolean(resolved?.done);
        // chevron + collapse mirror the main board: base it on VISIBLE children
        // (the same skip rules), respect item.collapsed (so focus inherits the
        // board's fold state), and only recurse when expanded.
        const kids = item.linkType === "reference" ? [] : (item.children || []);
        const visibleKids = kids.filter((k) => !(group && isTaskHiddenFromActive(k, group)));
        const hasKids = visibleKids.length > 0;
        const expanded = hasKids && !item.collapsed;
        const id = resolved?.id || item.id;
        return `
        <li style="margin-left: ${depth * 18}px" class="${done ? "focus-child-done" : ""}">
          <button class="focus-child-chevron ${hasKids ? "" : "hidden"}" type="button" data-focus-chevron="${item.id}" aria-label="${expanded ? "Collapse" : "Expand"}" aria-expanded="${expanded ? "true" : "false"}">${renderIcon("chevron")}</button>
          <button class="focus-child-check ${done ? "done" : ""}" type="button" data-focus-toggle="${id}" aria-label="${done ? "Mark not done" : "Mark done"}">${done ? renderIcon("check") : ""}</button>
          <span class="focus-child-text" contenteditable="true" spellcheck="true" data-focus-task-text="${id}">${renderInlineMarkdown(resolved?.text || item.text)}</span>
          ${renderFocusImages(resolved || item, "focus-child-image")}
          ${expanded ? renderFocusChildren(item.children || [], depth + 1, group) : ""}
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

    // Static sum of a group's tasks' accumulated focus time, for the group
    // focus display. Focus TIMING stays per-task (no group timer runs); this
    // only totals what the tasks already banked. Resolved IDs are deduped so
    // a linked copy and its original count once; walks mirror the focus
    // outline (reference placements don't recurse).
    function getGroupFocusSeconds(group) {
      const seen = new Set();
      let total = 0;
      const walk = (list) => (list || []).forEach((placement) => {
        const item = resolveTaskItem(placement);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          total += Math.max(0, Math.floor(Number(item.focusSeconds) || 0));
        }
        if (placement.linkType !== "reference") walk(placement.children);
      });
      walk(group?.tasks);
      return total;
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
        if (focusCrumbEl) focusCrumbEl.textContent = group.title;
        if (focusTimerEl) {
          focusTimerEl.hidden = false;
          focusTimerEl.textContent = `${formatFocusSeconds(getGroupFocusSeconds(group))} total`;
        }
        focusTaskEl.innerHTML = `
          <div class="focus-mode__text focus-mode__group-title" contenteditable="true" spellcheck="true" data-focus-group-title="${group.id}">${escapeHtml(group.title)}</div>
          <div class="focus-mode__children">${renderFocusChildren(group.tasks, 0, group) || '<p class="empty">This group is empty. Press Enter on the title to add a task.</p>'}</div>
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
      if (focusCrumbEl) focusCrumbEl.textContent = String(item.text || "").split("\n")[0];
      const focusImagesHtml = renderFocusImages(item, "focus-mode__image");
      focusTaskEl.innerHTML = `
        <div class="focus-mode__text" contenteditable="true" spellcheck="true" data-focus-task-text="${item.id}">${renderInlineMarkdown(item.text)}</div>
        ${focusImagesHtml ? `<div class="focus-mode__images">${focusImagesHtml}</div>` : ""}
        <div class="focus-mode__children">${renderFocusChildren(item.children || [], 0, found.group)}</div>
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
      flushPendingSave();
      focusModeTaskId = null;
      focusModeGroupId = null;
      if (focusModeEl) {
        focusModeEl.hidden = true;
        focusModeEl.classList.remove("group-focus");
      }
      if (focusTaskEl) focusTaskEl.innerHTML = "";
      if (focusCrumbEl) focusCrumbEl.textContent = "";
      if (focusTimerEl) focusTimerEl.hidden = false;
      if (boardStaleBehindFocus) {
        boardStaleBehindFocus = false;
        render();
      } else {
        renderSelection();
      }
    }

    function focusFoldAll() {
      const roots = focusModeGroupId
        ? (findGroup(focusModeGroupId)?.tasks || [])
        : (findTask(focusModeTaskId)?.item.children || []);
      // one button, both directions: collapse everything if anything is open,
      // otherwise expand everything back out.
      let anyExpanded = false;
      const scan = (list) => list.forEach((t) => {
        if ((t.children || []).length) {
          if (!t.collapsed) anyExpanded = true;
          scan(t.children);
        }
      });
      scan(roots);
      const collapse = anyExpanded;
      const apply = (list) => list.forEach((t) => {
        if ((t.children || []).length) {
          t.collapsed = collapse;
          apply(t.children);
        }
      });
      apply(roots);
      boardStaleBehindFocus = true;
      saveState();
      renderFocusMode();
    }

    function toggleFocusMode() {
      if (focusModeTaskId || focusModeGroupId) {
        exitFocusMode();
        return false;
      }
      return enterFocusMode();
    }

    // Tracks whether a pointer is currently pressed anywhere on the board;
    // cleared at the window so a release outside the board can't strand it.
    boardEl.addEventListener("pointerdown", () => { boardPressActive = true; }, true);
    window.addEventListener?.("pointerup", () => { boardPressActive = false; }, true);
    window.addEventListener?.("pointercancel", () => { boardPressActive = false; }, true);

    boardEl.addEventListener("click", (event) => {
      if (Date.now() < squelchTapUntil) return;
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
      if (action === "delete-task") {
        // a parent's trash button asks like any other subtree delete
        if (countTaskDescendants(button.dataset.taskId) > 0) deleteSelectedNodes([{ kind: "task", id: button.dataset.taskId }]);
        else deleteTask(button.dataset.taskId);
      }
      if (button.dataset.imageRemove) {
        removeTaskImage(button.dataset.imageTask, button.dataset.imageRemove);
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
      if (action === "restore-completed" || action === "restore-trash" || action === "purge-trash") {
        event.preventDefault();
        if (action === "restore-completed") restoreCompletedTask(button.dataset.taskId);
        if (action === "restore-trash") restoreTrashRecord(button.dataset.trashId);
        if (action === "purge-trash") purgeTrashRecord(button.dataset.trashId);
        return;
      }
      if (action === "add-child") addTask(button.dataset.groupId, button.dataset.taskId);
      if (action === "add-task") addTask(button.dataset.groupId);
      if (action === "toggle-group") toggleGroup(button.dataset.groupId);
      if (action === "focus-task") selectTask(button.dataset.taskId);
    });

    boardEl.addEventListener("input", (event) => {
      const captionEl = event.target.closest("[data-image-caption]");
      if (captionEl) {
        const info = findImageNode(captionEl.dataset.imageCaption);
        if (info) {
          info.image.caption = getMarkdownTextFromEditable(captionEl);
          captionEl.classList.toggle("empty", !info.image.caption);
          saveStateDebounced();
        }
        return;
      }
      const textEl = event.target.closest("[data-task-text]");
      const groupTitle = event.target.closest("[data-group-title]");
      if (textEl) {
        updateTaskTextFromEditable(textEl.dataset.taskText, textEl);
      }
      if (groupTitle) {
        const group = findGroup(groupTitle.dataset.groupTitle);
        if (group) {
          group.title = groupTitle.textContent.trim() || "Untitled group";
          saveStateDebounced();
        }
      }
    });

    // Evren's pick (grill, 2026-07-19): a global "keep resolution" setting.
    // Medium is the default. "original" keeps the file untouched (pristine but
    // heavy); the rest downscale to a max width and re-encode to WebP.
    const IMAGE_TIERS = {
      original: null,
      high: { maxWidth: 2560, quality: 0.92 },
      medium: { maxWidth: 1440, quality: 0.85 },
      low: { maxWidth: 800, quality: 0.75 },
    };

    function compressImageFile(file, tierName = state.settings.imageResolution) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const original = String(reader.result);
          const tier = IMAGE_TIERS[tierName] || (tierName === "original" ? null : IMAGE_TIERS.medium);
          if (!tier) { resolve(original); return; } // "original": keep the file as-is
          const image = new Image();
          image.onload = () => {
            const scale = Math.min(1, tier.maxWidth / (image.naturalWidth || tier.maxWidth));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
            canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            let output = canvas.toDataURL("image/webp", tier.quality);
            if (!output.startsWith("data:image/webp")) output = canvas.toDataURL("image/jpeg", Math.min(0.95, tier.quality + 0.02));
            resolve(output.length < original.length ? output : original);
          };
          image.onerror = reject;
          image.src = original;
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
        if (assetsAvailable()) {
          const assetId = createId("asset");
          storeAsset(assetId, src);
          item.images.push({ id: createId("img"), assetId, width: 260, caption: "" });
        } else {
          item.images.push({ id: createId("img"), src, width: 260, caption: "" });
        }
        saveState();
        render();
      }).catch(() => showToast("That image could not be read."));
    }

    boardEl.addEventListener("paste", (event) => {
      const captionEl = event.target.closest("[data-image-caption]");
      const textEl = event.target.closest("[data-task-text]");
      if (!captionEl && !textEl) return;
      const imageFile = [...(event.clipboardData?.files || [])].find((file) => file.type?.startsWith("image/"));
      if (imageFile) {
        event.preventDefault();
        attachImageToTask(captionEl ? captionEl.dataset.imageTask : textEl.dataset.taskText, imageFile);
        return;
      }
      if (captionEl) return;
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
      flushPendingSave();
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
      if (suppressFocusSelection || Date.now() < squelchTapUntil) return;
      const sectionRow = event.target.closest("[data-section-row]");
      if (sectionRow) {
        selectNode("section", sectionRow.dataset.sectionRow);
        return;
      }
      const imageWrap = event.target.closest('[data-node-kind="image"]');
      if (imageWrap) {
        selectNode("image", imageWrap.dataset.nodeId);
        return;
      }
      const groupRow = event.target.closest("[data-group-row]");
      const row = event.target.closest("[data-task-row]");
      if (groupRow) selectNode("group", groupRow.dataset.groupRow);
      if (row) selectTask(row.dataset.taskRow);
    });

    boardEl.addEventListener("dragstart", (event) => {
      // touch never gets the OS-native HTML5 drag (iOS lifts a text-snapshot
      // ghost with no drop indicators — his "copy-paste-like" report); the
      // long-press pointer drag owns touch, the mouse keeps native drag
      if (lastPressWasTouch) {
        event.preventDefault();
        return;
      }
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

    // A press inside the ACTIVELY EDITED text belongs to iOS text editing:
    // magnifier, word select, callout. No gesture may claim it (Evren's test
    // results, 2026-07-19: "can't get magnifier to show, goes dark").
    function pressInsideFocusedText(target) {
      const editable = target?.closest?.("[contenteditable='true']");
      return Boolean(editable && editable === document.activeElement);
    }

    // A render that replaces the pressed row mid-press takes the touch stream
    // with it (implicit capture dies with the node): pointerup never arrives,
    // the hold timers arm with no finger down, and the ghost then eats the
    // next tap's click (iOS reuses pointerIds) or every scroll (the reported
    // intermittent dead toggles). A new primary press is proof no older touch
    // is still live, so it starts from a clean slate.
    boardEl.addEventListener("pointerdown", (event) => {
      lastPressWasTouch = event.pointerType !== "mouse";
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      clearTouchDrag();
      clearTouchSelect();
      touchSwipe = null;
    });

    boardEl.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || touchDrag) return;
      if (pressInsideFocusedText(event.target)) return;
      // Evren's touch spec (2026-07-17): a hold anywhere on the item is a
      // move, not just on the grip. The grip stays for rows whose press
      // target is a button.
      const handle = event.target.closest("[data-touch-drag], [data-task-row]");
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
      if (!touchDrag.selected) {
        touchDrag.selected = true;
        selectNode(draggedNode.kind, draggedNode.id);
      }
      updateDragAutoScroll(event.clientY);
      touchDrag.lastX = event.clientX;
      touchDrag.lastY = event.clientY;
      refreshTouchDragTarget(event.clientX, event.clientY);
    });

    boardEl.addEventListener("pointerup", (event) => finishTouchDrag(event));
    boardEl.addEventListener("pointercancel", (event) => finishTouchDrag(event, true));

    let touchSwipe = null;

    function finishTouchSwipe(cancelled = false) {
      if (!touchSwipe) return 0;
      const { row, taskId, dx = 0, locked, editingId } = touchSwipe;
      row.classList.remove("swiping");
      row.style.transform = "";
      touchSwipe = null;
      if (!locked || cancelled) return 0;
      const applied = applySwipeIndent(taskId, getSwipeLevels(dx));
      // the re-render replaced the focused element; hand the caret (and the
      // phone keyboard) back to the text he was editing
      if (applied && editingId) focusTaskText(editingId, false);
      return applied;
    }

    boardEl.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      const row = event.target.closest("[data-task-row]");
      if (!row) return;
      // dragging INSIDE focused text is iOS text selection — not a swipe; a
      // swipe from elsewhere on the row while editing works and must give the
      // keyboard back afterwards (his report: it vanished)
      if (pressInsideFocusedText(event.target)) return;
      const editingId = document.activeElement?.dataset?.taskText || null;
      touchSwipe = { pointerId: event.pointerId, row, taskId: row.dataset.taskRow, startX: event.clientX, startY: event.clientY, locked: false, editingId };
    });

    boardEl.addEventListener("pointermove", (event) => {
      if (!touchSwipe || event.pointerId !== touchSwipe.pointerId) return;
      const dx = event.clientX - touchSwipe.startX;
      const dy = event.clientY - touchSwipe.startY;
      if (!touchSwipe.locked) {
        // whoever wins first owns the gesture: an armed long-press drag or a
        // clearly vertical move kills the swipe candidate
        if (touchDrag?.armed || (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx))) {
          touchSwipe = null;
          return;
        }
        if (!(Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2)) return;
        touchSwipe.locked = true;
        clearTouchDrag();
        clearTouchSelect();
        // the preview must stop at what the release can actually do (his
        // note: the pull kept going past the max indent level)
        const found = findTask(touchSwipe.taskId);
        let maxIn = 0;
        if (found && found.index > 0) {
          maxIn = 1;
          let host = found.list[found.index - 1];
          while (maxIn < SWIPE_MAX_LEVELS && (host.children || []).length) {
            host = host.children[host.children.length - 1];
            maxIn += 1;
          }
        }
        let maxOut = 0;
        let climb = found;
        while (climb?.parent && maxOut < SWIPE_MAX_LEVELS) {
          maxOut += 1;
          climb = findTask(climb.parent.id);
        }
        touchSwipe.maxIn = maxIn;
        touchSwipe.maxOut = maxOut;
        touchSwipe.row.classList.add("swiping");
        try {
          touchSwipe.row.setPointerCapture?.(event.pointerId);
        } catch {
          /* pointer already released */
        }
      }
      event.preventDefault();
      const limit = Math.min(SWIPE_MAX_LEVELS, touchSwipe.maxIn ?? SWIPE_MAX_LEVELS) * SWIPE_LEVEL_PX;
      const limitOut = Math.min(SWIPE_MAX_LEVELS, touchSwipe.maxOut ?? SWIPE_MAX_LEVELS) * SWIPE_LEVEL_PX;
      touchSwipe.dx = Math.max(-limitOut, Math.min(limit, dx));
      // snap the preview to level detents so the row clicks between levels
      touchSwipe.row.style.transform = `translateX(${getSwipeLevels(touchSwipe.dx) * SWIPE_LEVEL_PX}px)`;
    });

    boardEl.addEventListener("pointerup", () => finishTouchSwipe());
    boardEl.addEventListener("pointercancel", () => finishTouchSwipe(true));

    // Evren's touch spec (2026-07-17): a hold past 1.5s stops being a move and
    // becomes drag select — sweep over rows to take them, and every later hold
    // past 1.5s adds more items to the selection.
    let touchSelect = null;

    function clearTouchSelect() {
      if (!touchSelect) return;
      if (touchSelect.timer) window.clearTimeout?.(touchSelect.timer);
      boardEl.classList.remove("is-touch-selecting");
      // killing the unarmed select candidate mid-drag must not stall the
      // drag's auto-scroll frame (it stuttered scrolls started near an edge)
      if (!touchDrag?.armed) stopDragAutoScroll();
      touchSelect = null;
    }

    function armTouchSelect() {
      if (!touchSelect) return;
      touchSelect.timer = null;
      touchSelect.armed = true;
      clearTouchDrag();
      touchSwipe = null;
      boardEl.classList.add("is-touch-selecting");
      // snapshot earlier holds BEFORE the anchor joins, so a reversed sweep
      // only drops what this sweep added, never the accumulated selection
      touchSelect.base = getSelectedNodes().map((existing) => ({ ...existing }));
      touchSelect.anchorNode = { ...touchSelect.node };
      addNodeToSelection(touchSelect.node);
      touchSelect.lastNode = touchSelect.node;
      navigator.vibrate?.(15);
    }

    boardEl.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || touchSelect) return;
      if (pressInsideFocusedText(event.target)) return;
      const row = event.target.closest("[data-node-kind]");
      if (!row) return;
      touchSelect = {
        pointerId: event.pointerId,
        node: { kind: row.dataset.nodeKind, id: row.dataset.nodeId },
        startX: event.clientX,
        startY: event.clientY,
        armed: false,
        lastNode: null,
        timer: window.setTimeout?.(armTouchSelect, SELECT_HOLD_MS),
      };
    });

    boardEl.addEventListener("pointermove", (event) => {
      if (!touchSelect || event.pointerId !== touchSelect.pointerId) return;
      if (!touchSelect.armed) {
        // fingers drift during a 1.5s hold; a tight threshold was killing the
        // select candidate while move stayed armed (his "collides with drag")
        if (shouldCancelLongPress(touchSelect.startX, touchSelect.startY, event.clientX, event.clientY, 28)) clearTouchSelect();
        return;
      }
      event.preventDefault();
      updateDragAutoScroll(event.clientY);
      const row = document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.("[data-node-kind]");
      if (!row) return;
      const node = { kind: row.dataset.nodeKind, id: row.dataset.nodeId };
      if (sameNode(node, touchSelect.lastNode)) return;
      applySweepSelection(touchSelect.base, touchSelect.anchorNode, node);
      touchSelect.lastNode = node;
    });

    function finishTouchSelect(event) {
      if (!touchSelect || event.pointerId !== touchSelect.pointerId) return;
      // the release still fires focusin + click on the row under the finger;
      // either would collapse the selection we just built
      if (touchSelect.armed) squelchTapUntil = Date.now() + 500;
      clearTouchSelect();
    }

    boardEl.addEventListener("pointerup", (event) => finishTouchSelect(event));
    boardEl.addEventListener("pointercancel", (event) => finishTouchSelect(event));

    // touch-action pan-y lets the browser own vertical pans; once a hold has
    // armed move or select, the first cancelable touchmove must be eaten or
    // the scroll steals the pointer stream (pointercancel) mid-gesture.
    boardEl.addEventListener("touchmove", (event) => {
      if ((touchDrag?.armed || touchSelect?.armed) && event.cancelable) event.preventDefault();
    }, { passive: false });

    boardEl.addEventListener("contextmenu", (event) => {
      // long-press must not pop the OS menu while a touch gesture is pending
      if (touchDrag || touchSelect) event.preventDefault();
    });

    focusTaskEl?.addEventListener("click", (event) => {
      const chevron = event.target.closest("[data-focus-chevron]");
      if (chevron) {
        const found = findTask(chevron.dataset.focusChevron);
        if (found) {
          found.item.collapsed = !found.item.collapsed;
          boardStaleBehindFocus = true;
          saveState();
          renderFocusMode();
        }
        return;
      }
      const toggle = event.target.closest("[data-focus-toggle]");
      if (!toggle) return;
      const found = findTask(toggle.dataset.focusToggle);
      const item = found ? resolveTaskItem(found.item) : null;
      if (item) {
        setTaskCompleted(item.id, !item.done, new Date().toISOString(), { render: false });
        boardStaleBehindFocus = true;
        renderFocusMode();
      }
    });

    focusTaskEl?.addEventListener("keydown", (event) => {
      const overlayEditable = event.target.closest?.("[contenteditable='true']");
      if (overlayEditable && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        const id = overlayEditable.dataset.focusTaskText;
        const found = id ? findTask(id) : null;
        const item = found ? resolveTaskItem(found.item) : null;
        if (item) {
          setTaskCompleted(item.id, !item.done, new Date().toISOString(), { render: false });
          boardStaleBehindFocus = true;
          renderFocusMode();
          focusEditableText(focusTaskEl.querySelector(`[data-focus-task-text="${item.id}"]`), false);
        }
        return;
      }
      if (overlayEditable && (event.key === "ArrowUp" || event.key === "ArrowDown") && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        // arrows inside the overlay browse the outline; the board handler
        // underneath must never see them (it was re-selecting hidden rows)
        event.stopPropagation();
        if (event.altKey) {
          event.preventDefault();
          const id = overlayEditable.dataset.focusTaskText;
          if (id && moveTaskAmongSiblings(id, direction)) {
            renderFocusMode();
            focusEditableText(focusTaskEl.querySelector(`[data-focus-task-text="${id}"]`), false);
          }
          return;
        }
        if (!caretOnBoundaryLine(overlayEditable, direction)) return;
        event.preventDefault();
        const fields = [...focusTaskEl.querySelectorAll("[contenteditable='true']")];
        const next = fields[fields.indexOf(overlayEditable) + direction];
        if (!next) return;
        next.focus();
        const range = document.createRange();
        range.selectNodeContents(next);
        range.collapse(direction > 0);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      const groupTitleEl = event.target.closest?.("[data-focus-group-title]");
      if (groupTitleEl && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        const group = findGroup(groupTitleEl.dataset.focusGroupTitle);
        if (!group) return;
        group.title = groupTitleEl.textContent.trim() || "Untitled group";
        const inserted = insertSiblingBelowNode({ kind: "group", id: group.id });
        renderFocusMode();
        if (inserted) focusEditableText(focusTaskEl.querySelector(`[data-focus-task-text="${inserted.id}"]`), false);
        return;
      }
      const mainTextEl = event.target.closest?.(".focus-mode__text:not(.focus-mode__group-title)");
      if (mainTextEl && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        const found = findTask(mainTextEl.dataset.focusTaskText);
        if (!found) return;
        const item = resolveTaskItem(found.item);
        item.text = getMarkdownTextFromEditable(mainTextEl);
        pushUndoState("board", "Added a task");
        const child = task("", [], { createdInGroupId: found.group?.id || null, createdUnderTaskId: item.id });
        item.children = item.children || [];
        item.children.unshift(child);
        item.collapsed = false;
        saveState();
        render();
        renderFocusMode();
        focusEditableText(focusTaskEl.querySelector(`[data-focus-task-text="${child.id}"]`), false);
        return;
      }
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
        if (event.shiftKey) {
          // the focus root is the floor: outdenting a direct child of the
          // focused task (task focus) or a top-level task (group focus) would
          // lift the item out of the view and looked like losing it (Evren).
          const found = findTask(id);
          const atFocusFloor = focusModeGroupId ? !found?.parent : found?.parent?.id === focusModeTaskId;
          if (!atFocusFloor) outdentTask(id);
        } else {
          indentTask(id);
        }
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
      const groupTitleEl = event.target.closest?.("[data-focus-group-title]");
      if (groupTitleEl) {
        const group = findGroup(groupTitleEl.dataset.focusGroupTitle);
        if (group) {
          group.title = groupTitleEl.textContent.trim() || "Untitled group";
          saveStateDebounced();
          boardStaleBehindFocus = true;
        }
        return;
      }
      const target = event.target.closest("[data-focus-task-text]");
      if (!target) return;
      const found = findTask(target.dataset.focusTaskText);
      if (!found) return;
      resolveTaskItem(found.item).text = getMarkdownTextFromEditable(target);
      saveStateDebounced();
      boardStaleBehindFocus = true;
    });

    focusButtonEl?.addEventListener("click", toggleFocusMode);
    focusExitEl?.addEventListener("click", exitFocusMode);
    focusFoldEl?.addEventListener("click", focusFoldAll);
    window.addEventListener?.("beforeunload", () => stopFocusTimer());
    function syncSettingsControls() {
      const settings = state.settings;
      if (pasteModeEl) pasteModeEl.value = ["alias", "reference", "duplicate", "ask"].includes(settings.pasteMode) ? settings.pasteMode : "alias";
      if (imageResolutionEl) imageResolutionEl.value = ["original", "high", "medium", "low"].includes(settings.imageResolution) ? settings.imageResolution : "medium";
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
      if (deviceNameEl) deviceNameEl.value = String(deviceIdentity.name || "");
      if (identityLineEl) {
        identityLineEl.hidden = !state.identity;
        if (state.identity) identityLineEl.textContent = `Signing identity: ${String(settings.username || "").trim() || "unnamed"} · ${state.identity.fingerprint}`;
      }
      if (syncDevicesEl) syncDevicesEl.innerHTML = renderDeviceRoster();
      if (syncSectionEl) syncSectionEl.hidden = IS_DEMO;
      if (reportBugEl) reportBugEl.hidden = IS_DEMO;
      if (syncEnabledEl) syncEnabledEl.checked = Boolean(syncConfig.enabled);
      if (syncFieldsEl) syncFieldsEl.hidden = !syncConfig.enabled;
      if (syncRepoEl) syncRepoEl.value = String(syncConfig.repo || "");
      if (syncTokenEl) syncTokenEl.value = String(syncConfig.token || "");
      if (checkUpdatesEl) checkUpdatesEl.checked = settings.checkForUpdates !== false;
      if (updateVersionEl) updateVersionEl.textContent = `This copy is v${APP_VERSION}.`;
      // Only a downloaded (file://) copy can go stale, so only it gets the
      // Updates box. On the hosted app there is nothing to check or turn off, so
      // showing an inert toggle there is dead UI — hide the whole section.
      if (updatesSectionEl) updatesSectionEl.hidden = IS_DEMO || !IS_LOCAL_FILE;
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
    // Changing the tier only affects pastes from now on; compressImageFile is
    // the sole caller and it runs at paste time. Nothing revisits stored images.
    function describeImageResolutionChange(previous, next) {
      const rank = (tier) => ["low", "medium", "high", "original"].indexOf(tier);
      return rank(next) > rank(previous)
        ? "Images pasted from now on keep more detail. Existing images are unchanged."
        : "New pastes will be smaller. Existing images are not downscaled.";
    }

    imageResolutionEl?.addEventListener("change", () => {
      const previous = state.settings.imageResolution;
      const next = imageResolutionEl.value;
      updateSettings({ imageResolution: next });
      if (next !== previous) showToast(describeImageResolutionChange(previous, next));
    });
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
    deviceNameEl?.addEventListener("change", () => {
      saveDeviceIdentity({ name: deviceNameEl.value.trim() });
      saveState();
      syncSettingsControls();
    });
    exportSettingsEl?.addEventListener("click", downloadSettingsExport);

    syncEnabledEl?.addEventListener("change", () => {
      saveSyncConfig({ enabled: syncEnabledEl.checked });
      syncSettingsControls();
      if (syncIsActive()) syncNow("enable");
    });
    syncRepoEl?.addEventListener("change", () => {
      // Accept a pasted repo URL; store it as owner/name. A new repo means the
      // remembered sha no longer describes anything.
      const repo = syncRepoEl.value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/+$/, "");
      saveSyncConfig({ repo, lastSha: null });
      syncSettingsControls();
      if (syncIsActive()) syncNow("config");
    });
    syncTokenEl?.addEventListener("change", () => {
      saveSyncConfig({ token: syncTokenEl.value.trim() });
      if (syncIsActive()) syncNow("config");
    });
    syncNowEl?.addEventListener("click", () => syncNow("manual"));

    checkUpdatesEl?.addEventListener("change", () => updateSettings({ checkForUpdates: checkUpdatesEl.checked }));

    const FEEDBACK_EMAIL = "evrenucar1999@gmail.com";
    const BUG_ISSUE_BASE = "https://github.com/evrenucar/punchlist_app/issues/new";

    // Pure so the suite can pin it: URL-encodes the description and appends
    // the running version plus whether this copy is hosted or downloaded.
    function buildBugReportUrl(description) {
      const body = `${String(description || "").trim()}\n\nApp version: v${APP_VERSION} (${IS_LOCAL_FILE ? "downloaded" : "hosted"})`;
      return `${BUG_ISSUE_BASE}?title=${encodeURIComponent("Bug report")}&body=${encodeURIComponent(body)}`;
    }

    function openBugDialog() {
      if (!bugDialogEl || IS_DEMO) return;
      bugDialogEl.hidden = false;
      bugTextEl?.focus?.();
    }

    function closeBugDialog() {
      if (bugDialogEl) bugDialogEl.hidden = true;
    }

    reportBugEl?.addEventListener("click", openBugDialog);
    bugCloseEl?.addEventListener("click", closeBugDialog);
    bugDialogEl?.addEventListener("click", (event) => {
      if (event.target === bugDialogEl) closeBugDialog();
    });
    bugGithubEl?.addEventListener("click", () => {
      window.open?.(buildBugReportUrl(bugTextEl?.value || ""), "_blank", "noopener");
      closeBugDialog();
    });
    bugEmailEl?.addEventListener("click", () => {
      const description = String(bugTextEl?.value || "").trim();
      const text = description ? `${FEEDBACK_EMAIL}\n\n${description}` : FEEDBACK_EMAIL;
      const done = () => {
        closeBugDialog();
        showToast(`${FEEDBACK_EMAIL}${description ? " and your description" : ""} copied. Please send Evren a kind email.`);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
          window.prompt?.("Copy the feedback address:", FEEDBACK_EMAIL);
        });
        return;
      }
      window.prompt?.("Copy the feedback address:", FEEDBACK_EMAIL);
    });

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
      if (event.key === "ArrowRight" || event.key === "Escape") {
        event.preventDefault();
        if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        const target = [...document.querySelectorAll(".sidebar button, .sidebar summary")].find((el) => el.offsetParent !== null);
        if (target) target.focus();
        else if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
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
    exportBoardEl?.addEventListener("click", () => {
      downloadBoardState().catch(() => showToast("Export failed."));
    });
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
        // Evren's rule (2026-07-19): a tap on the link opens it. Mobile had no
        // way to before, it needed Ctrl+Click that phones do not have. Tapping
        // the text still edits and tapping the row elsewhere still selects,
        // because those are different targets. Blur first so a soft keyboard
        // that popped on press does not linger over the opened tab.
        event.preventDefault();
        document.activeElement?.blur?.();
        window.open(link.href, "_blank", "noopener");
        return;
      }
      const button = event.target.closest("[data-action]");
      if (!button || boardEl.contains(button)) return;
      if (button.dataset.action === "add-group") addGroup();
      if (button.dataset.action === "start-own-board") startOwnBoard();
      if (button.dataset.action === "expand-all") setEveryCollapsed(false);
      if (button.dataset.action === "collapse-all") setEveryCollapsed(true);
      if (button.dataset.action === "restore-trash") {
        restoreTrashRecord(button.dataset.trashId);
        renderHistoryList();
      }
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
      const imageInfo = selectedNode?.kind === "image" ? findImageNode(selectedNode.id) : null;
      const targetNode = imageInfo ? { kind: "task", id: imageInfo.taskId } : selectedNode;
      const imageFile = [...(event.clipboardData?.files || [])].find((file) => file.type?.startsWith("image/"));
      if (imageFile && targetNode?.kind === "task") {
        event.preventDefault();
        attachImageToTask(targetNode.id, imageFile);
        return;
      }
      const text = event.clipboardData?.getData("text/plain") || "";
      if (imageInfo && text.trim()) {
        event.preventDefault();
        pushUndoState("paste", "Captioned an image");
        imageInfo.image.caption = imageInfo.image.caption
          ? `${imageInfo.image.caption}\n${text.trim()}`
          : text.trim();
        saveState();
        render();
        return;
      }
      if (internalClipboard?.taskIds?.length && text.trim() === internalClipboard.markdown.trim()) {
        event.preventDefault();
        // cut detached the originals at cut time; re-insert those same objects
        // (items undo brought back in place are left where they are)
        const detached = internalClipboard.mode === "cut"
          ? (internalClipboard.detached || []).filter((item) => !findTask(item.id))
          : [];
        if (detached.length) {
          if (targetNode) {
            pushUndoState("paste");
            const inserted = insertPastedItems(detached, targetNode);
            if (inserted.length) {
              setSingleSelection({ kind: "task", id: inserted[0].id });
              saveState();
              render();
              internalClipboard = null;
            } else {
              discardUndoState();
            }
          }
          return;
        }
        pasteTaskIds(internalClipboard.taskIds, targetNode, resolvePasteMode());
        pasteLinkOverride = null;
        if (internalClipboard.mode === "cut") internalClipboard = null;
        return;
      }
      if (parseMarkdownTasks(text).length) {
        event.preventDefault();
        pasteExternalMarkdown(text, targetNode);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && lightboxView) {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === "Escape" && bugDialogEl && !bugDialogEl.hidden) {
        event.preventDefault();
        closeBugDialog();
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

      const isEditingText = event.target.matches?.("[contenteditable='true']") ?? false;

      // Alt+Left is the browser's Back shortcut — a stray press was navigating
      // the whole page away (Evren, 2026-07-17). Swallow the pair everywhere;
      // on a selected row they outdent/indent, matching the swipe gesture.
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && event.altKey && !event.ctrlKey) {
        event.preventDefault();
        if (!isEditingText && !focusModeTaskId && !focusModeGroupId
          && !event.target.closest?.(".sidebar")
          && !(event.target.matches?.("input, select, textarea") ?? false)) {
          shiftSelectedDepth(event.key === "ArrowLeft");
        }
        return;
      }

      if (event.key.toLowerCase() === "v" && event.ctrlKey && event.shiftKey && !isEditingText) {
        // paste special (Evren 2026-07-19): the browser's paste event follows
        // this keydown; arm it to land as a real unlinked copy, one shot
        pasteLinkOverride = "duplicate";
        window.setTimeout?.(() => { pasteLinkOverride = null; }, 800);
        return;
      }

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

      // Inline formatting (Evren 2026-07-21): Ctrl+B / Ctrl+I / Ctrl+Shift+S
      // toggle **bold** / *italic* / ~~strike~~ on the markdown model. Task
      // text only (board rows and the focus overlay); captions, group titles,
      // search, chat and other inputs keep their browser defaults. !altKey
      // keeps AltGr (Ctrl+Alt) layouts safe.
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        const marker = !event.shiftKey && key === "b" ? "**"
          : !event.shiftKey && key === "i" ? "*"
          : event.shiftKey && key === "s" ? "~~" : null;
        const styleTarget = marker ? event.target.closest?.("[data-task-text], [data-focus-task-text]") : null;
        if (styleTarget) {
          event.preventDefault();
          toggleEditableStyle(styleTarget, marker);
          return;
        }
      }

      if (event.key.toLowerCase() === "z" && event.ctrlKey) {
        if (shouldUseBoardUndo(isEditingText)) {
          event.preventDefault();
          restoreUndoState();
        }
        return;
      }

      // AltGr on Turkish/European layouts reports as Ctrl+Alt, so typing
      // AltGr-composed characters was toggling focus mode mid-sentence.
      if (event.key.toLowerCase() === "f" && event.ctrlKey && event.altKey
        && !event.getModifierState?.("AltGraph")
        && !(event.target.matches?.("[contenteditable='true'], input, textarea") ?? false)) {
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

      if (event.target.matches?.("input, select, textarea") && !event.altKey) return;
      if (event.target.closest?.(".sidebar")) return;
      if (!boardEl.contains(event.target) && event.target.closest?.("button, summary, a")) return;

      // Focus mode owns the screen: keys landing here must never drive the
      // board rows underneath (arrows were re-selecting hidden rows; Backspace
      // with an overlay button focused would delete the board's selection).
      if (focusModeTaskId || focusModeGroupId) {
        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.shiftKey && !event.altKey
          && !event.ctrlKey && !focusTaskEl?.contains(document.activeElement)) {
          event.preventDefault();
          const fields = focusTaskEl ? [...focusTaskEl.querySelectorAll("[contenteditable='true']")] : [];
          focusEditableText(event.key === "ArrowDown" ? fields[0] : fields.at(-1), false);
        }
        return;
      }

      const visible = getVisibleNodes();
      if (!visible.length) return;
      const currentIndex = visible.findIndex((node) => node.kind === selectedNode?.kind && node.id === selectedNode?.id);
      const index = Math.max(0, currentIndex);

      if (selectedNode?.kind === "image" && !isEditingText) {
        const info = findImageNode(selectedNode.id);
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          if (info) removeTaskImage(info.taskId, selectedNode.id);
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          if (info) selectNode("task", info.taskId);
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const caption = document.querySelector(`[data-image-caption="${selectedNode.id}"]`);
          if (caption && info) {
            focusEditableText(caption, false);
            insertTextAtSelection(event.key, caption);
            info.image.caption = getMarkdownTextFromEditable(caption);
            caption.classList.remove("empty");
            saveState();
          }
          return;
        }
        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && (event.ctrlKey || event.altKey)) return;
      }

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
        // Evren's spec (2026-07-17, via card): left arrow climbs the hierarchy
        // instead of jumping straight to the sidebar. Task -> parent task ->
        // group header -> sidebar, so the menu stays reachable but never by surprise.
        if (selectHierarchicalParent()) return;
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
        shiftSelectedDepth(event.shiftKey);
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

      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.altKey && !event.ctrlKey) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const selection = getSelectedNodes();
        if (selection.length === 1 && selection[0].kind === "task") moveTaskVisually(selection[0].id, direction);
        else moveSelectedNodes(direction);
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

      // In a multi-line task, plain Up/Down first moves the caret WITHIN the
      // text; only a caret already on the first/last visual line switches rows.
      if (isEditingText && (event.key === "ArrowUp" || event.key === "ArrowDown") && !event.shiftKey) {
        const editable = event.target.closest?.("[contenteditable='true']");
        if (editable && !caretOnBoundaryLine(editable, event.key === "ArrowUp" ? -1 : 1)) return;
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
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (itemIndex > 0) items[itemIndex - 1].focus();
        else sidebarToggleEl?.focus();
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
      // selects and text inputs own their arrow keys; checkboxes don't
      if (tag === "SELECT" || (tag === "INPUT" && event.target.type !== "checkbox")) return;
      const sidebar = event.currentTarget;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const focusables = [...sidebar.querySelectorAll("a, button, summary, input[type='checkbox']")].filter((el) => el.offsetParent !== null);
        const focusIndex = focusables.indexOf(document.activeElement);
        if (focusIndex < 0) return;
        event.preventDefault();
        if (event.key === "ArrowUp" && focusIndex === 0) {
          sidebarToggleEl?.focus();
          return;
        }
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
    // Demo theme always follows the embedding page (the &dark flag), never a
    // remembered value: the frame must match the page around it on every load.
    if (IS_DEMO) applyTheme(/[?&]dark\b/.test(location.search || "") ? "dark" : "light");
    if (IS_DEMO) document.body?.setAttribute("data-demo", "true");
    applySidebarWidth();
    syncSettingsControls();
    updateClock();
    if (typeof window.setInterval === "function") window.setInterval(updateClock, 30000);
    if (typeof window.setInterval === "function") window.setInterval(runLifecycleMaintenance, 1000);
    if (typeof window.setInterval === "function") window.setInterval(() => checkDueReminders(), 5000);
    render();
    // In demo mode nothing is preselected: focusing a row on load or during
    // the driver loop would scroll the embedding page to the iframe.
    selectedNode = IS_DEMO ? null : (getVisibleNodes()[0] || null);
    if (selectedNode) selectNode(selectedNode);

    // Create the user's signing identity once per board; a pulled identity
    // always wins over a freshly generated one (see createSigningIdentity).
    ensureSigningIdentity().catch(() => {});

    // Fire-and-forget update check (downloaded copy only; see checkForUpdate).
    checkForUpdate();

    // ?probe: a disposable on-device layout instrument for the iOS sideways
    // drift (does not reproduce in emulation). Zero UI without the flag.
    // ponytail: throwaway diagnostic, delete once the phone bug is closed.
    if (/[?&]probe\b/.test(typeof location !== "undefined" ? location.search || "" : "") && document.body && typeof window.setInterval === "function") {
      const probeEl = document.createElement("div");
      probeEl.style.cssText = "position:fixed;left:4px;right:4px;bottom:4px;z-index:9999;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre-wrap;";
      document.body.appendChild(probeEl);
      const probe = () => {
        const vv = window.visualViewport;
        const mainEl = document.querySelector("main");
        const wide = [];
        document.querySelectorAll("body *").forEach((el) => {
          if (wide.length >= 3 || el === probeEl) return;
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth + 1 || r.left < -1) {
            wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0] || "-"} L${Math.round(r.left)} R${Math.round(r.right)}`);
          }
        });
        const box = (el) => {
          if (!el) return "-";
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return `L${Math.round(r.left)} R${Math.round(r.right)} pad ${cs.paddingLeft}/${cs.paddingRight} mar ${cs.marginLeft}/${cs.marginRight}`;
        };
        const firstGroup = document.querySelector("main article");
        probeEl.textContent =
          `inner ${window.innerWidth} docW ${document.scrollingElement.scrollWidth}` +
          ` | vv w${vv ? Math.round(vv.width) : "-"} x${vv ? Math.round(vv.offsetLeft) : "-"} s${vv ? vv.scale.toFixed(2) : "-"}` +
          ` | main sL ${mainEl ? Math.round(mainEl.scrollLeft) : "-"}` +
          `\nmain ${box(mainEl)}` +
          `\ngroup ${box(firstGroup)}` +
          `\nwide: ${wide.length ? wide.join(" | ") : "none"}`;
      };
      window.setInterval(probe, 700);
      window.addEventListener?.("scroll", probe, true);
      probe();
    }

    // Sync on load, when the tab regains focus (that's the moment a second
    // device's edits matter), and after edits via the debounce in saveState.
    // The asset cache loads first: pushes need it to know what to upload, and
    // boot migration must not race a pull.
    initAssetStore().then(() => {
      if (syncIsActive()) syncNow("load");
    });
    window.addEventListener?.("focus", () => {
      if (syncIsActive()) syncNow("focus");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && syncIsActive()) syncNow("visible");
    });

    // Ask the browser to exempt this origin's storage from eviction under
    // storage pressure. Chromium grants it silently; failures don't matter.
    if (!IS_DEMO && typeof navigator !== "undefined") navigator.storage?.persist?.().catch?.(() => {});

    // Safari deletes a site's script-writable storage (tasks included) after
    // 7 days of Safari use without visiting the site. Web apps opened from
    // the Home Screen are exempt, so nudge iOS Safari users there once.
    function maybeShowHomeScreenHint() {
      if (IS_DEMO || typeof navigator === "undefined" || !document.body || typeof document.createElement !== "function") return;
      if (window.parent && window.parent !== window) return;
      if (localStorage.getItem(STORAGE_KEY + "-home-screen-hint")) return;
      const ua = navigator.userAgent || "";
      const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
      const isSafari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/.test(ua);
      if (!isIos || !isSafari || navigator.standalone === true) return;
      const hint = document.createElement("div");
      hint.className = "home-screen-hint";
      const text = document.createElement("p");
      text.textContent = "Safari deletes this site's saved data, tasks included, after 7 days without a visit. Add Punchlist to your Home Screen (Share button, then Add to Home Screen); the copy that opens from there keeps its data.";
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "control";
      dismiss.textContent = "Got it";
      dismiss.addEventListener("click", () => {
        localStorage.setItem(STORAGE_KEY + "-home-screen-hint", "dismissed");
        hint.remove();
      });
      hint.append(text, dismiss);
      document.body.appendChild(hint);
    }
    maybeShowHomeScreenHint();

    // The landing page embeds ?demo in an iframe it sizes from these reports,
    // so the whole board stays visible with no cropping or inner scrollbar.
    if (IS_DEMO && window.parent && window.parent !== window) {
      // The frame catches up to reported heights with a delay; the document
      // must never grow a scrollbar of its own in that gap.
      if (document.documentElement) document.documentElement.style.overflow = "hidden";
      const postDemoHeight = () => {
        const height = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
        if (height) window.parent.postMessage?.({ punchlistDemoHeight: height }, "*");
      };
      if (typeof ResizeObserver === "function" && document.body) new ResizeObserver(postDemoHeight).observe(document.body);
      window.addEventListener?.("load", postDemoHeight);
      postDemoHeight();
    }

    // Demo driver: edits the live board through the app's own functions on a
    // loop, stopping forever at the first real interaction. Runs only with
    // ?demo, so it can never touch a real board.
    function startDemoDriver() {
      if (!IS_DEMO || typeof window.setTimeout !== "function") return;
      let stopped = false;
      let timer = null;
      const DEMO_IMAGE_SRC = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><g fill="none" stroke="#65716b"><rect x="4" y="4" width="112" height="72" stroke-width="2"/><path d="M62 4v26M62 46v30M4 44h26M42 44h20M62 52h22M94 52h22" stroke-width="2"/><path d="M62 30a16 16 0 0 1 16 16M30 44a12 12 0 0 0 12 12" stroke-width="1"/><rect x="10" y="54" width="16" height="14" stroke-width="1"/><path d="M84 76h20" stroke-width="4"/></g></svg>');

      function findTaskByTextIn(tasks, text) {
        for (const item of tasks) {
          if (item.text === text) return item;
          const nested = findTaskByTextIn(item.children || [], text);
          if (nested) return nested;
        }
        return null;
      }

      function findDemoTask(text) {
        for (const group of state.groups) {
          const item = findTaskByTextIn(group.tasks, text);
          if (item) return item;
        }
        return null;
      }

      const steps = [
        [2000, () => {
          const item = findDemoTask("Buy groceries");
          if (item) setTaskCompleted(item.id, true);
        }],
        [2300, () => {
          const group = state.groups.find((entry) => entry.title === "Today");
          if (!group) return;
          group.tasks.push(task("Water the plants"));
          saveState();
          render();
        }],
        [2400, () => {
          const group = state.groups.find((entry) => entry.title === "Today");
          const index = group ? group.tasks.findIndex((item) => item.text === "Book a dentist appointment") : -1;
          if (index >= 0 && moveNodeInList(group.tasks, index, -1)) {
            saveState();
            render();
          }
        }],
        [2300, () => {
          const item = findDemoTask("Plan a weekend trip");
          if (!item) return;
          item.images = [...(item.images || []), { id: createId("image"), src: DEMO_IMAGE_SRC, width: 220, caption: "floor-plan.png" }];
          saveState();
          render();
        }],
        [2400, () => {
          const group = state.groups.find((entry) => entry.title === "Projects");
          if (group) {
            group.collapsed = true;
            saveState();
            render();
          }
        }],
        [1800, () => {
          const group = state.groups.find((entry) => entry.title === "Projects");
          if (group) {
            group.collapsed = false;
            saveState();
            render();
          }
        }],
        [2000, () => {
          const item = findDemoTask("Go for a 30-minute walk");
          if (item) setTaskCompleted(item.id, true);
        }],
        [1600, () => {
          const item = findDemoTask("Go for a 30-minute walk");
          if (item) setTaskCompleted(item.id, false);
        }],
        [3200, () => {
          localStorage.removeItem(STORAGE_KEY);
          state = migrateState(demoSeedState());
          selectedNode = null;
          multiSelectedNodes = [];
          selectionAnchorNode = null;
          undoStack = [];
          undoActions = [];
          lastUndoAction = null;
          render();
        }],
      ];

      function runStep(index) {
        if (stopped) return;
        const [delay, action] = steps[index % steps.length];
        timer = window.setTimeout(() => {
          if (stopped) return;
          action();
          runStep(index + 1);
        }, delay);
      }

      function stopDriver() {
        stopped = true;
        if (timer) window.clearTimeout?.(timer);
      }

      document.addEventListener("pointerdown", stopDriver);
      document.addEventListener("keydown", stopDriver);
      runStep(0);
    }

    startDemoDriver();

    window.taskBoardTestApi = {
      get state() {
        return state;
      },
      getTaskSplitPlan,
      splitTaskAtOffset,
      moveTaskAmongSiblings,
      mergeTaskIntoPrevious,
      selectHierarchicalParent,
      getSwipeLevels,
      applySwipeIndent,
      applyUrlPasteToText,
      renderInlineMarkdown,
      getMarkdownTextFromEditable,
      getMarkdownCaretOffset,
      toggleMarkdownStyle,
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
      syncDecision,
      syncNow,
      saveSyncConfig,
      encodeBase64Utf8,
      decodeBase64Utf8,
      getSyncPayload,
      applySyncedState,
      applyExternalState,
      syncIsActive,
      compareVersions,
      updateChecksEnabled,
      checkForUpdate,
      buildBugReportUrl,
      openBugDialog,
      closeBugDialog,
      describeImageResolutionChange,
      getExportState,
      storeAsset,
      getAssetSrc,
      assetIdsReferenced,
      offloadEmbeddedImages,
      embedImagesInExport,
      assetFileName,
      saveSyncConfig,
      getDeviceIdentity: () => deviceIdentity,
      saveDeviceIdentity,
      deviceDisplayName,
      touchDeviceRoster,
      renderDeviceRoster,
      signingAvailable,
      ensureSigningIdentity,
      signText,
      verifySignedText,
      publicKeyFingerprint,
      importTrustVerdict,
      describeImportSender,
      importVerdictToast,
      setTaskSchedule,
      getTimelineEntries,
      timelineTimeFromOffset,
      getEffortVariance,
      isReminderDue,
      getDueReminders,
      checkDueReminders,
      renderTask,
      renderTaskDetailsPanel,
      renderGroupDetailsPanel,
      renderDetailsPanel,
      renderFocusChildren,
      compressImageFile,
      findImageNode,
      removeTaskImage,
      describeTrashOrigin,
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
      addNodeToSelection,
      applySweepSelection,
      renderGroupInPlace,
      renderTaskSubtreeInPlace,
      renderScoped,
      taskIsLinkFree,
      moveSelectedNode,
      moveSelectedNodes,
      moveTaskVisually,
      shiftSelectedDepth,
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
      saveStateDebounced,
      flushPendingSave,
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
      getGroupFocusSeconds,
      getFocusElapsedSeconds,
      addFocusElapsedSeconds,
      stopFocusTimer,
      renderFocusTimer,
      focusSelectedTextField,
      insertEditingLineBreak,
      addTask,
      APP_VERSION,
      IS_DEMO,
      STORAGE_KEY,
      startOwnBoard,
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
