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

    // Editable text carries two chars the model must never see: the nbsp
    // contenteditable leaves behind, and the zero-width caret boundary
    // placeCaretAtTextOffset parks past a style span.
    const CARET_BOUNDARY = "\u200b";
