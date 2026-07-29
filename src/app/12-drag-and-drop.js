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
      renderGroupCollapse(id, nextCollapsed);
      selectNode("group", id);
    }

    // Collapse/expand is a class toggle, not a re-serialize. renderGroup emits
    // every task even when collapsed (hidden by .is-hidden), so rebuilding the
    // whole article on a toggle re-serialized the entire group — the group-
    // toggle lag on his huge groups (mobile). Just flip the class and the
    // chevron; the .group:has(.is-hidden) rule restyles the header for free.
    function renderGroupCollapse(groupId, collapsed) {
      const article = document.querySelector?.(`[data-group-card="${groupId}"]`);
      const ul = article?.querySelector?.(`[data-group-list="${groupId}"]`);
      // empty groups toggle an empty-state <p> outside the list; search re-
      // filters globally; the vm/hidden board has nothing to touch: fall back
      if (!article || !ul || boardEl.hidden || (searchEl?.value?.trim()) || !ul.querySelector(":scope > li[data-task]")) {
        renderGroupInPlace(groupId);
        return;
      }
      ul.classList.toggle("is-hidden", collapsed);
      const chevron = article.querySelector('[data-action="toggle-group"]');
      if (chevron) {
        chevron.setAttribute("aria-expanded", collapsed ? "false" : "true");
        chevron.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} group`);
      }
      if (selectedNode) renderSelection();
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
      // reordering never changes a task's parent, so the container each moved id
      // lives in is the only thing that has to repaint
      const scopes = new Map();
      nodes.filter((node) => node.kind === "task").forEach((node) => {
        const found = findTask(node.id);
        if (!found) return;
        if (!taskLists.has(found.list)) taskLists.set(found.list, []);
        taskLists.get(found.list).push({ index: found.index });
        const parentId = found.parent?.id ?? null;
        const key = `${found.group.id}/${parentId || ""}`;
        if (!scopes.has(key)) scopes.set(key, { groupId: found.group.id, parentId, ids: [] });
        scopes.get(key).ids.push(node.id);
      });

      taskLists.forEach((entries, list) => {
        moved = moveEntriesInList(list, entries, direction) || moved;
      });

      if (!moved) {
        discardUndoState();
        return;
      }
      saveState();
      // a group reorder moves every article; nothing smaller than a full render
      if (groupEntries.length) {
        render();
        return;
      }
      scopes.forEach((scope) => {
        if (scope.parentId) renderChildrenInPlace(scope.parentId, scope.groupId, scope.ids);
        else renderTopLevelInPlace(scope.groupId, scope.ids);
      });
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
        // the confirm card lives in the group header: one group swap shows it
        if (pendingGroupDelete.groupId) renderGroupInPlace(pendingGroupDelete.groupId);
        else render();
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
      // Sweep the board, not just the remembered source. A cancel arriving once
      // touchDrag is already null took the early return and left the dragged row
      // faded and outlined for good — Evren, "some items stay with a low opacity
      // highlight on them even tho I don't have them selected". The mouse drag
      // path has swept globally all along; this one only cleaned one element.
      document.querySelectorAll?.(".touch-dragging").forEach((element) => element.classList.remove("touch-dragging"));
      boardEl.classList.remove("is-dragging-group", "is-touch-dragging");
      clearDropIndicators();
      if (!touchDrag) return;
      if (touchDrag.timer) window.clearTimeout?.(touchDrag.timer);
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

