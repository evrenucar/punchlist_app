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
      if (/^https?:\/\/\S+$/i.test(pasted)) {
        const selection = window.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed && selectionContainsEditableContents(textEl)) {
          const label = selection.toString();
          if (label) {
            event.preventDefault();
            insertTextAtSelection(`[${label}](${pasted})`, textEl);
            return;
          }
        }
      }
      pasteRichTextIntoEditable(event, textEl);
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
      // A row button owns its activation. Selecting the row during button
      // focus can repaint the row before the synthesized click, retargeting
      // that click to the row and losing the button action on touch.
      if (event.target.closest("button")) return;
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
      // Ctrl+Up / Ctrl+Down collapse and expand, the same pair the board has
      // always used. Focus mode drew chevrons on the outline and gave them no
      // key at all, so the one shortcut he reaches for did nothing in here.
      // The focus ROOT is deliberately left out: renderFocusMode shows its
      // children whatever its collapsed flag says, so toggling it would change
      // the board underneath while nothing moved on screen.
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        event.stopPropagation();
        const id = overlayEditable?.dataset.focusTaskText;
        const found = id && id !== focusModeTaskId ? findTask(id) : null;
        if (!found || !(found.item.children || []).length) return;
        event.preventDefault();
        const collapsed = event.key === "ArrowUp";
        if (found.item.collapsed === collapsed) return;
        found.item.collapsed = collapsed;
        boardStaleBehindFocus = true;
        saveState();
        renderFocusMode();
        focusEditableText(focusTaskEl.querySelector(`[data-focus-task-text="${id}"]`), false);
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

    focusTaskEl?.addEventListener("paste", (event) => {
      const textEl = event.target.closest?.("[data-focus-task-text]");
      if (textEl) pasteRichTextIntoEditable(event, textEl);
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
