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

    // Evren corrected this on 2026-07-29, after using the v1.5.34 version:
    // "it shouldn't be pushed to the bottom of the big group. If there is a sub
    // sub group when I tick it should stay at the same hierarchy level but go to
    // the bottom of that hierarchy level. If it has sub items it should move
    // together with them." And: "I want it to remember where it came from and go
    // back when unticked."
    //
    // So a sink never changes a task's parent. It slides down its OWN sibling
    // list, carries its subtree because the item IS its subtree, and records
    // where it started so unticking can undo it. Returns false when it is
    // already last, so the caller keeps its cheap in-place render.
    function sinkTaskAmongSiblings(found) {
      if (!found) return false;
      const siblings = found.list;
      if (siblings[siblings.length - 1] === found.item) return false;
      found.item.sunkFrom = found.index;
      siblings.splice(found.index, 1);
      siblings.push(found.item);
      return true;
    }

    // The other half of his ask. Puts the task back where it was sitting when it
    // was ticked, as long as that slot still makes sense: if the list changed
    // underneath it, land as close as the list allows rather than refusing.
    function restoreSunkTask(found) {
      if (!found || typeof found.item.sunkFrom !== "number") return false;
      const siblings = found.list;
      const target = Math.min(found.item.sunkFrom, siblings.length - 1);
      delete found.item.sunkFrom;
      if (target === found.index) return false;
      siblings.splice(found.index, 1);
      siblings.splice(target, 0, found.item);
      return true;
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
      // Ticking sinks it among its own siblings; unticking puts it back. Both
      // are his, and the second half is why sunkFrom exists at all.
      const moved = state.settings.sinkCompleted
        && (nextDone ? sinkTaskAmongSiblings(found) : restoreSunkTask(found));
      const sank = Boolean(moved);
      if (options.save !== false) saveState();
      if (sank) {
        if (options.render !== false) render();
        return true;
      }
      if (options.render !== false) {
        if (nextDone && isTaskHiddenFromActive(found.item, found.group)) {
          // the row leaves for the Completed section: retire exactly the rows
          // that hid after the slide-away (per-placement retention respected)
          animateRowsAway([found.item.id], () => retireHiddenRows([item.id]));
        } else if (taskIsLinkFree(found.item)) {
          renderTaskSubtreeInPlace(found.item.id, found.group.id);
        } else {
          renderLinkedPlacements(found.item, found.item.id, found.group.id);
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

