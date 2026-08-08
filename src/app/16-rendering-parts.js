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

    // Every id on the board is written straight into an HTML attribute by the
    // renderers (data-task, data-node-id, data-image-task, data-trash-id) and
    // into a querySelector by the in-place repaints. An imported, synced or
    // hand-edited board can carry any string it likes in those fields, and one
    // quote is enough to close the attribute and open a tag of its own. So ids
    // are pinned to the shape createId generates, here at the one seam every
    // board passes through. Fields that POINT at another id drop to null
    // instead of getting a fresh one: an invented target resolves to nothing
    // anyway, and the renderers already handle a link that doesn't resolve.
    function safeIdRef(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
    }

    function safeId(value, prefix) {
      return safeIdRef(value) || createId(prefix);
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
      // Logical sync counter (2026-07-21 data-loss fix): floor of 0 so every
      // board carries one and cross-version comparisons never hit undefined.
      boardState.rev = Number.isFinite(Number(boardState.rev)) && Number(boardState.rev) >= 0 ? Number(boardState.rev) : 0;
      // Wall-clock stamp of the last local edit: the recency half of the sync
      // ranking (2026-07-28). Boards written by older builds have none, which is
      // why syncDecision treats a missing stamp as unknown and falls back to the
      // counter alone rather than guessing a date.
      boardState.editedAt = typeof boardState.editedAt === "string" && Number.isFinite(Date.parse(boardState.editedAt))
        ? boardState.editedAt
        : null;
      boardState.example = Boolean(boardState.example);
      boardState.settings = {
        ...DEFAULT_SETTINGS,
        ...(boardState.settings && typeof boardState.settings === "object" ? boardState.settings : {}),
      };
      boardState.trash = Array.isArray(boardState.trash) ? boardState.trash : [];
      // Trash carries whole subtrees back onto the board on Restore without
      // passing through here again, so the records get the same treatment as
      // live ones: their own id (it renders as data-trash-id) and everything
      // waiting inside them.
      boardState.trash.forEach((record) => {
        if (!record || typeof record !== "object") return;
        record.id = safeId(record.id, "trash");
        if (record.source && typeof record.source === "object") {
          record.source.groupId = safeIdRef(record.source.groupId);
          record.source.parentId = safeIdRef(record.source.parentId);
        }
        if (!record.item || typeof record.item !== "object") return;
        if (record.kind === "group") normalizeGroup(record.item, 0, now);
        else normalizeTask(record.item, { now });
      });
      boardState.history = Array.isArray(boardState.history) ? boardState.history.slice(-50) : [];
      boardState.devices = boardState.devices && typeof boardState.devices === "object" && !Array.isArray(boardState.devices) ? boardState.devices : {};
      boardState.contacts = boardState.contacts && typeof boardState.contacts === "object" && !Array.isArray(boardState.contacts) ? boardState.contacts : {};
      boardState.identity = boardState.identity && typeof boardState.identity === "object" && boardState.identity.privateKeyJwk && boardState.identity.publicKeyJwk ? boardState.identity : null;
      boardState.groups = Array.isArray(boardState.groups) ? boardState.groups : [];
      boardState.groups.forEach((group, index) => normalizeGroup(group, index, now));
      return boardState;
    }

    function normalizeGroup(group, index, now = new Date().toISOString()) {
      group.id = safeId(group.id, "group");
      group.title = typeof group.title === "string" ? group.title : "Untitled group";
      // The color goes into a style attribute, so it is the same escape hatch
      // as an id: anything but the six-digit hex the picker writes falls back
      // to the group's default.
      const color = normalizeColor(group.color);
      group.color = /^#[0-9a-f]{6}$/i.test(color) ? color : getDefaultGroupColor(group, index);
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
      return group;
    }

    function normalizeTask(item, context = {}) {
      const now = context.now || new Date().toISOString();
      item.id = safeId(item.id, "task");
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
      item.createdInGroupId = safeIdRef(item.createdInGroupId) || safeIdRef(context.groupId);
      item.createdUnderTaskId = safeIdRef(item.createdUnderTaskId) || safeIdRef(context.parentId);
      item.policyOverrides = item.policyOverrides && typeof item.policyOverrides === "object"
        ? item.policyOverrides
        : null;
      // Where this task sat before ticking sank it, so unticking can put it
      // back. Only meaningful while done; anything else in the field is noise
      // from a hand-edited or older file.
      if (typeof item.sunkFrom !== "number" || !item.done) delete item.sunkFrom;
      item.images = Array.isArray(item.images)
        ? item.images
          .filter((img) => img && (typeof img.assetId === "string" || (typeof img.src === "string" && img.src.startsWith("data:image/"))))
          .map((img) => ({
            id: safeId(img.id, "img"),
            ...(typeof img.assetId === "string" ? { assetId: img.assetId } : { src: img.src }),
            width: Number(img.width) > 0 ? Math.round(Number(img.width)) : 260,
            caption: typeof img.caption === "string" ? img.caption : "",
          }))
        : [];
      item.linkType = ["alias", "reference"].includes(item.linkType) ? item.linkType : null;
      item.targetTaskId = item.linkType ? safeIdRef(item.targetTaskId) : null;
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
            ? `<img src="${escapeHtml(src)}" style="width: ${width}px" alt="Pasted image" draggable="false" decoding="sync">`
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
            <button class="chevron ${hasChildren ? "" : "hidden"}" type="button" data-action="toggle-task" data-task-id="${item.id}" title="${expanded ? "Collapse" : "Expand"} task (Ctrl+${expanded ? "Up" : "Down"})" aria-label="${expanded ? "Collapse" : "Expand"} task" aria-expanded="${expanded ? "true" : "false"}">
              ${renderIcon("chevron")}
            </button>
            <button class="checkbox ${resolved?.done ? "done" : ""}" type="button" data-action="toggle-done" data-task-id="${item.id}" title="${resolved?.done ? "Mark not done" : "Mark done"} (Ctrl+Enter)" aria-label="${resolved?.done ? "Mark not done" : "Mark done"}">
              ${resolved?.done ? renderIcon("check") : ""}
            </button>
            <div class="task-text" data-task-text="${item.id}" contenteditable="true" spellcheck="true">${renderInlineMarkdown(resolved?.text || item.text)}</div>
            ${renderTaskLinkBadge(item, resolved)}
            <div class="task-actions">
              ${item.linkType ? "" : renderPolicyMenu("task", item.id, item.policyOverrides)}
              <button class="icon-button drag-handle" type="button" data-action="focus-task" data-task-id="${item.id}" data-touch-drag title="Drag to move; hold on touch screens (Alt+arrows)" aria-label="Drag task; hold on touch screens">${renderIcon("grip")}</button>
              <button class="icon-button" type="button" data-action="add-child" data-task-id="${item.id}" data-group-id="${groupId}" title="Add a subtask (Enter, then Tab)" aria-label="Add subtask">${renderIcon("plus")}</button>
              <button class="icon-button" type="button" data-action="delete-task" data-task-id="${item.id}" title="Delete task (Backspace)" aria-label="Delete task">${renderIcon("trash")}</button>
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
              <button class="chevron" type="button" data-action="toggle-group" data-group-id="${group.id}" title="${collapsed ? "Expand" : "Collapse"} group (Ctrl+${collapsed ? "Down" : "Up"})" aria-label="${collapsed ? "Expand" : "Collapse"} group" aria-expanded="${collapsed ? "false" : "true"}">${renderIcon("chevron")}</button>
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
              <button class="icon-button" type="button" data-action="add-task" data-group-id="${group.id}" title="Add a task (Enter)" aria-label="Add task">${renderIcon("plus")}</button>
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

    // Which trash record does a history entry's Restore button act on?
    // Modern entries carry trashId. Legacy ones only quote the item's name, so
    // same-named deletions tie; break the tie on time, since the entry was
    // written at delete time and the right record's deletedAt sits closest.
    function resolveHistoryRestoreId(entry) {
      if (entry.trashId && state.trash.some((record) => record.id === entry.trashId)) return entry.trashId;
      if (!/^Deleted /.test(entry.text || "")) return null;
      const quoted = entry.text.match(/"(.+)"$/)?.[1];
      if (!quoted) return null;
      const entryAt = Date.parse(entry.at);
      const distance = (record) => {
        const deletedAt = Date.parse(record.deletedAt);
        if (!Number.isFinite(entryAt) || !Number.isFinite(deletedAt)) return Infinity;
        return Math.abs(deletedAt - entryAt);
      };
      const match = state.trash
        .filter((record) => {
          const label = record.kind === "group" ? record.item.title : (resolveTaskItem(record.item)?.text || record.item.text || "");
          return shortText(label) === quoted;
        })
        .sort((a, b) => distance(a) - distance(b))[0];
      return match?.id || null;
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
        const restoreId = resolveHistoryRestoreId(entry);
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
      // hiding rows retire surgically; anything else (trash purge, restores
      // from elsewhere) keeps the full render
      if (newlyHidden.length) animateRowsAway(newlyHidden, () => retireHiddenRows(newlyHidden));
      else render();
      return true;
    }

