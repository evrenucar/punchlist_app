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
      if (button.dataset.action === "dismiss-shared-origin") dismissSharedOriginWarning();
      if (button.dataset.action === "expand-all") setEveryCollapsed(false);
      if (button.dataset.action === "collapse-all") setEveryCollapsed(true);
      if (button.dataset.action === "restore-trash") {
        restoreTrashRecord(button.dataset.trashId);
        renderHistoryList();
      }
      if (button.dataset.action === "reset") openResetDialog();
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
        const confirmGroupId = pendingGroupDelete.groupId || null;
        pendingGroupDelete = null;
        if (confirmGroupId) renderGroupInPlace(confirmGroupId);
        else render();
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

      // Inline formatting: Ctrl+B / Ctrl+I / Ctrl+Shift+S toggle **bold** /
      // *italic* / ~~strike~~ on the markdown model. His answer on which
      // shortcuts apply formatting was "default can be standard shortcuts",
      // and the settings toggle is the other half of that sentence. Task text
      // only (board rows and the focus overlay); captions, group titles,
      // search, chat and other inputs keep their browser defaults. !altKey
      // keeps AltGr (Ctrl+Alt) layouts safe.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && state.settings.markdownShortcuts !== false) {
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

      // Alt+S mirrors the hamburger exactly, click and all, so the drawer/collapse
      // split stays in one place. Allowed mid-edit: it inserts nothing.
      if (event.altKey && !event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        sidebarToggleEl?.click();
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

    // Evren, 2026-07-28: "Settings is not browsable with arrow keys / ctrl like
    // the rest of the board." Arrows already walked the sidebar, but nothing could
    // OPEN a disclosure and the walk skipped every text field and select, so the
    // settings themselves were mouse-or-Tab only. Board keys now: arrows walk,
    // Right opens, Left closes then climbs, Ctrl+arrows expand and collapse.
    // Arrows are taken from a select the way a list takes them from a row; Alt+Down
    // still drops its menu open, which is how you change one from the keyboard.
    sidebarEl?.addEventListener("keydown", (event) => {
      const target = event.target;
      const tag = target.tagName;
      if (tag === "TEXTAREA") return;
      // A text caret owns left and right; up and down are free to walk out.
      const isTextField = tag === "INPUT" && target.type !== "checkbox";
      if (isTextField && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;

      const details = target.closest?.("details");

      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.ctrlKey && details) {
        event.preventDefault();
        details.open = event.key === "ArrowDown";
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return; // Alt+S stays global

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const focusables = [...event.currentTarget.querySelectorAll("a, button, summary, input, select")]
          .filter(sidebarStopIsVisible);
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

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (tag === "SUMMARY" && details && !details.open) details.open = true;
        else leaveSidebarForBoard();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (tag === "SUMMARY" && details?.open) details.open = false;
        // Otherwise climb: out of a section to its own summary, or up one level.
        else (tag === "SUMMARY" ? details?.parentElement?.closest("details") : details)
          ?.querySelector(":scope > summary")?.focus();
        return;
      }

      // Evren, 2026-07-28: "with enter should be able to toggle toggles, for
      // example currently dark light mode toggle doesn't work". Space toggles a
      // checkbox natively and Enter does not, which is a form-submit convention
      // with no form here. On a board you walk with arrows, the key under your
      // finger is Enter.
      if (event.key === "Enter" && tag === "INPUT" && target.type === "checkbox") {
        event.preventDefault();
        target.click();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        leaveSidebarForBoard();
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

    // Hosted builds register the same-origin service worker so the normal web
    // app can reopen offline after its first HTTPS visit. Downloaded file://
    // copies already work offline and cannot register service workers.
    function registerOfflineApp() {
      if (IS_LOCAL_FILE || !window.isSecureContext || !("serviceWorker" in navigator)) return;
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    }
    registerOfflineApp();

    // Fire-and-forget update check (downloaded copy only; see checkForUpdate).
    checkForUpdate();

    // Requiring the device name means an already-syncing device with no name
    // stops syncing on this build, and Evren's roster shows exactly that shape
    // ("device a07y" is the fallback for unnamed). Silently going quiet is the
    // class of bug this whole week was about, so say it out loud. It stops the
    // moment the field has a name, which is one action away.
    if (!IS_DEMO && syncConfig.enabled && syncConfig.repo && syncConfig.token && !deviceIdentity.name.trim()) {
      showToast("Sync is paused: name this device in Settings. It is how your devices tell each other apart.");
    }

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
      markdownFromNodes,
      tidyPastedMarkdown,
      shouldCancelLongPress,
      resolveTaskItem,
      getLinkCount,
      createLinkedTaskTree,
      pasteTaskIds,
      tasksToMarkdown,
      parseMarkdownTasks,
      selectedNodesToMarkdown,
      rememberInternalClipboard,
      resolveLifecyclePolicy,
      durationToSeconds,
      secondsToDurationParts,
      updateSettings,
      syncDecision,
      syncNow,
      encodeBase64Utf8,
      decodeBase64Utf8,
      getSyncPayload,
      applySyncedState,
      applyExternalState,
      syncIsActive,
      syncSetupGap,
      compareVersions,
      updateChecksEnabled,
      checkForUpdate,
      buildBugReportUrl,
      openBugDialog,
      closeBugDialog,
      searchEmoji,
      emojiTriggerAt,
      emojiCount: () => EMOJI_LIST.length,
      openResetDialog,
      closeResetDialog,
      countBoard,
      describeImageResolutionChange,
      getExportState,
      getAssetSrc,
      assetIdsReferenced,
      offloadEmbeddedImages,
      saveSyncConfig,
      getDeviceIdentity: () => deviceIdentity,
      saveDeviceIdentity,
      forgetDevice,
      deviceDisplayName,
      touchDeviceRoster,
      renderDeviceRoster,
      signingAvailable,
      ensureSigningIdentity,
      importTrustVerdict,
      describeImportSender,
      setTaskSchedule,
      getTimelineEntries,
      timelineTimeFromOffset,
      getEffortVariance,
      isReminderDue,
      getDueReminders,
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
      describeGlobalCompletionPolicy,
      logHistory,
      deleteSelectedNodesConfirmed: (nodes) => deleteSelectedNodes(nodes, { confirmed: true }),
      get pendingGroupDelete() {
        return pendingGroupDelete;
      },
      describeRelativeDate,
      describeRelativeDateTime,
      renderTimelineSection,
      isTaskHiddenFromActive,
      setTaskCompleted,
      restoreCompletedTask,
      deleteTaskWithPolicy,
      restoreTrashRecord,
      resolveHistoryRestoreId,
      purgeExpiredTrash,
      getCompletedEntries,
      moveTask,
      ensureDoingNowGroup,
      cloneTaskTree,
      copyTaskToDoingNow,
      deleteTask,
      toggleTask,
      moveGroup,
      normalizeState,
      migrateState,
      changeGroupColor,
      toggleSelectedNode,
      toggleSelectedNodes,
      getVisibleNodes,
      getSelectedNodes,
      selectNode,
      addNodeToSelection,
      applySweepSelection,
      renderGroupInPlace,
      taskIsLinkFree,
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
      restoreUndoState,
      shouldUseBoardUndo,
      loadStateFromLocalStorage,
      flushPendingSave,
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
      insertEditingLineBreak,
      addTask,
      isSharedOrigin,
      countForeignStorageKeys,
      sharedOriginWarning,
      sharedOriginWarningHtml,
      renderSharedOriginWarning,
      dismissSharedOriginWarning,
      syncSettingsControls,
      APP_VERSION,
      IS_DEMO,
      IS_LOCAL_FILE,
      STORAGE_KEY,
      SHARED_ORIGIN_DISMISS_KEY,
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
