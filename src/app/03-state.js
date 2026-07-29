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
      const syncable = syncIsActive() && !syncApplying;
      // Bump the logical rev on every real local edit (2026-07-21 data-loss
      // fix). This single counter is what lets sync tell a genuinely newer
      // board from a stale one, with no wall clock to be fooled by. Pulls run
      // under syncApplying, so adopting a remote board never inflates our rev.
      // editedAt is stamped alongside it (2026-07-28): the counter ranks how
      // MANY edits a device made and never how RECENTLY, so a device sitting on
      // many old offline edits outranked one with a few fresh ones and the
      // newer board lost. syncDecision cross-checks the two.
      if (syncable) {
        state.rev = (Number(state.rev) || 0) + 1;
        state.editedAt = new Date().toISOString();
      }
      saveStateToLocalStorage();
      if (syncable) {
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

