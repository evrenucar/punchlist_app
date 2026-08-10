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
      const button = event.target.closest("button");
      // A long touch-selection release suppresses the synthetic row click that
      // follows it. Buttons own their own activation and must not select their
      // parent row first: selection can focus/reflow the row during the same
      // synthesized click, which turns a later tap into a row-only action.
      if (!button) {
        if (Date.now() < squelchTapUntil) return;
        const groupRow = event.target.closest("[data-group-row]");
        const row = event.target.closest("[data-task-row]");
        if (groupRow) selectNode("group", groupRow.dataset.groupRow);
        if (row) selectTask(row.dataset.taskRow);
        return;
      }

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
        const confirmGroupId = pendingGroupDelete?.groupId || null;
        pendingGroupDelete = null;
        if (confirmGroupId) renderGroupInPlace(confirmGroupId);
        else render();
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

