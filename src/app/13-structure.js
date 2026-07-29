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
      // subtree; the original's placement and every link repaint in place
      if (found.item.linkType || getLinkCount(resolved.id) > 0) {
        renderLinkedPlacements(found.item, intoChildren ? found.item.id : (found.parent?.id ?? null), found.group.id);
      } else {
        renderScoped(intoChildren ? found.item.id : (found.parent?.id ?? null), found.group.id, [found.item.id, item.id]);
      }
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
      // parent (the previous sibling); a top-level indent swaps just the two lis
      if (options.render !== false) renderScoped(found.parent?.id ?? null, found.group.id, [newParent.id, id]);
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
      // the item leaves its parent P for P's own list: P's parent covers both;
      // at the top level, only P's li and the arriving li change
      if (options.render !== false) renderScoped(parent.parent?.id ?? null, found.group.id, [parent.item.id, id]);
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
      // the two lists this move touches, so the repaint can be two <li> swaps
      // instead of a board rebuild (Evren: "when moving items all flash")
      const from = { groupId: found.group.id, parentId: found.parent?.id ?? null };
      let to = null;
      const [item] = found.list.splice(found.index, 1);

      let placed = false;
      if (direction > 0) {
        if (target.kind === "group") {
          const group = findGroup(target.id);
          if (group) {
            group.tasks.unshift(item);
            // expanding a collapsed group changes the whole article
            to = { groupId: group.id, parentId: null, whole: group.collapsed };
            group.collapsed = false;
            placed = true;
          }
        } else {
          const dest = findTask(target.id);
          if (dest) {
            if ((dest.item.children || []).length && !dest.item.collapsed) {
              dest.item.children.unshift(item);
              to = { groupId: dest.group.id, parentId: dest.item.id };
            } else {
              dest.list.splice(dest.index + 1, 0, item);
              to = { groupId: dest.group.id, parentId: dest.parent?.id ?? null };
            }
            placed = true;
          }
        }
      } else if (target.kind === "group") {
        const groupIndex = state.groups.findIndex((group) => group.id === target.id);
        const previousGroup = state.groups[groupIndex - 1];
        if (previousGroup) {
          previousGroup.tasks.push(item);
          to = { groupId: previousGroup.id, parentId: null, whole: previousGroup.collapsed };
          previousGroup.collapsed = false;
          placed = true;
        }
      } else {
        const dest = findTask(target.id);
        if (dest) {
          dest.list.splice(dest.index, 0, item);
          to = { groupId: dest.group.id, parentId: dest.parent?.id ?? null };
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
      repaintMovedTask(id, from, to);
      return true;
    }

    // Repaint the list the task left and the list it joined, nothing else. Same
    // container twice is one call; a destination that needs its whole article
    // (a group that just expanded) takes the group render.
    function repaintMovedTask(id, from, to) {
      const key = (scope) => (scope ? `${scope.groupId}/${scope.parentId || ""}` : "");
      const paint = (scope) => {
        if (!scope) return;
        if (scope.whole) renderGroupInPlace(scope.groupId);
        else if (scope.parentId) renderChildrenInPlace(scope.parentId, scope.groupId, [id]);
        else renderTopLevelInPlace(scope.groupId, [id]);
      };
      paint(from);
      if (key(to) !== key(from)) paint(to);
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
      if (!scopedOk) renderLinkedPlacements(findTask(parentId)?.item || item, parentId || null, groupId);
      else if (parentId) renderChildrenInPlace(parentId, groupId, [item.id]);
      else renderScoped(null, groupId, [item.id]);
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

