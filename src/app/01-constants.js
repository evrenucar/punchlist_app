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
    // The update channel: build-task-board.mjs writes this file fresh on every
    // build ({version, download, notes}), so a downloaded copy learns about
    // the latest DEPLOYED build, not the latest GitHub Release milestone —
    // those are cut by hand now and can sit behind for weeks on purpose.
    const LATEST_JSON_URL = LATEST_BUILD_URL + "latest.json";
    // No longer polled for update checks (see checkForUpdate); kept as the
    // human-facing fallback link if a fetched latest.json ever comes back
    // without a usable download URL.
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
      sinkCompleted: false, // his ask, and his default: off
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
      // Inline formatting, round two (his answers, 2026-07-29). "edit" is his
      // default and his mode E: the row being typed in goes raw, the rest of
      // the board stays rendered. "rendered" is B, "raw" is A. Mode D (only
      // the caret's visual line goes raw) is boarded as future, not built.
      markdownMode: "edit",
      markdownShortcuts: true,
      markdownWholeWords: true,
    });
    const MARKDOWN_MODES = ["edit", "rendered", "raw"];
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
    const sidebarEl = document.querySelector(".sidebar");
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
    const markdownModeEl = document.querySelector("[data-markdown-mode]");
    const markdownShortcutsEl = document.querySelector("[data-markdown-shortcuts]");
    const markdownWholeWordsEl = document.querySelector("[data-markdown-whole-words]");
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
    const sinkCompletedEl = document.querySelector("[data-sink-completed]");
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
    const bugSummaryEl = document.querySelector("[data-bug-summary]");
    const bugCloseEl = document.querySelector("[data-bug-close]");
    const bugGithubEl = document.querySelector("[data-bug-github]");
    const bugEmailEl = document.querySelector("[data-bug-email]");
    const resetDialogEl = document.querySelector("[data-reset-dialog]");
    const resetBodyEl = document.querySelector("[data-reset-body]");
    const resetConfirmEl = document.querySelector("[data-reset-confirm]");
    const resetExportEl = document.querySelector("[data-reset-export]");
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

