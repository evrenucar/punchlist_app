    function countTasks(tasks) {
      return tasks.reduce((total, item) => total + 1 + countTasks(item.children || []), 0);
    }

    function findTask(id, tasks = null, parent = null, group = null) {
      if (!tasks) {
        for (const currentGroup of state.groups) {
          const found = findTask(id, currentGroup.tasks, parent, currentGroup);
          if (found) return found;
        }
        return null;
      }
      const list = tasks;
      for (let index = 0; index < list.length; index += 1) {
        const item = list[index];
        if (item.id === id) return { item, parent, group, list, index };
        const child = findTask(id, item.children || [], item, group);
        if (child) return child;
      }
      return null;
    }

    function findGroup(id) {
      return state.groups.find((group) => group.id === id);
    }

    function resolveTaskItem(item, visited = new Set()) {
      if (!item?.targetTaskId || !["alias", "reference"].includes(item.linkType)) return item;
      if (visited.has(item.id)) return item;
      visited.add(item.id);
      const target = findTask(item.targetTaskId)?.item;
      return target ? resolveTaskItem(target, visited) : item;
    }

    function walkPlacements(tasks, callback) {
      (tasks || []).forEach((item) => {
        callback(item);
        walkPlacements(item.children, callback);
      });
    }

    // One whole-board walk per render, not one per rendered task: getLinkCount
    // runs for every non-link task while serializing, which made big renders
    // QUADRATIC (measured ~111ms of pure link counting per full render on a
    // 1.4k-task board; worse on Evren's). Render entry points build this map
    // once and clear it when done; everything else falls back to the walk.
    let linkCountCache = null;
    function buildLinkCountCache() {
      const counts = new Map();
      state.groups.forEach((group) => walkPlacements(group.tasks, (item) => {
        if (item.targetTaskId && ["alias", "reference"].includes(item.linkType)) {
          counts.set(item.targetTaskId, (counts.get(item.targetTaskId) || 0) + 1);
        }
      }));
      return counts;
    }

    function getLinkCount(taskId) {
      if (linkCountCache) return linkCountCache.get(taskId) || 0;
      let count = 0;
      state.groups.forEach((group) => walkPlacements(group.tasks, (item) => {
        if (item.targetTaskId === taskId && ["alias", "reference"].includes(item.linkType)) count += 1;
      }));
      return count;
    }

    function createLinkedTaskTree(sourceItem, linkType = "alias", groupId = null, parentId = null) {
      const source = resolveTaskItem(sourceItem);
      if (!source || !["alias", "reference"].includes(linkType)) return null;
      const linked = task(source.text, [], {
        createdInGroupId: groupId,
        createdUnderTaskId: parentId,
      });
      linked.linkType = linkType;
      linked.targetTaskId = source.id;
      linked.collapsed = Boolean(sourceItem?.collapsed);
      linked.children = linkType === "alias"
        ? (source.children || []).map((child) => createLinkedTaskTree(child, "alias", groupId, linked.id))
        : [];
      return linked;
    }

    function ensureDoingNowGroup() {
      let group = state.groups.find((item) => item.title.toLowerCase() === "doing now");
      if (group) return group;

      group = {
        id: "group-doing-now",
        title: "Doing now",
        collapsed: false,
        color: "#ef4444",
        tasks: [],
      };
      state.groups.unshift(group);
      return group;
    }

    function cloneTaskTree(item) {
      const source = resolveTaskItem(item);
      return {
        id: createId("task"),
        text: source.text,
        done: Boolean(source.done),
        completedAt: source.completedAt || null,
        collapsed: Boolean(item.collapsed),
        focusSeconds: Math.max(0, Math.floor(Number(source.focusSeconds) || 0)),
        plannedMinutes: source.plannedMinutes || null,
        schedule: source.schedule ? { ...source.schedule } : null,
        reminderAt: source.reminderAt || null,
        createdAt: new Date().toISOString(),
        createdInGroupId: null,
        createdUnderTaskId: null,
        children: (source.children || []).map(cloneTaskTree),
      };
    }

    function insertPastedItems(items, targetNode) {
      if (!items.length || !targetNode) return [];
      if (targetNode.kind === "group") {
        const group = findGroup(targetNode.id);
        if (!group) return [];
        items.forEach((item) => {
          item.createdInGroupId ||= group.id;
          group.tasks.push(item);
        });
        return items;
      }
      const target = findTask(targetNode.id);
      if (!target) return [];
      items.forEach((item, offset) => target.list.splice(target.index + 1 + offset, 0, item));
      return items;
    }

    function pasteTaskIds(taskIds, targetNode, mode = state.settings.pasteMode) {
      const sources = [...new Set(taskIds || [])].map((id) => findTask(id)).filter(Boolean);
      if (!sources.length || !targetNode) return [];
      const targetItem = targetNode.kind === "task" ? resolveTaskItem(findTask(targetNode.id)?.item) : null;
      if (targetItem && sources.some((found) => {
        const sourceItem = resolveTaskItem(found.item);
        return sourceItem.id === targetItem.id || isDescendant(sourceItem, targetItem.id);
      })) return [];
      const normalizedMode = ["alias", "reference", "duplicate", "move"].includes(mode) ? mode : "alias";
      pushUndoState(normalizedMode === "move" ? "move" : "paste");

      let items;
      if (normalizedMode === "move") {
        items = sources.map((found) => removeTask(found.item.id)).filter(Boolean);
      } else if (normalizedMode === "duplicate") {
        items = sources.map((found) => cloneTaskTree(found.item));
      } else {
        const targetGroupId = targetNode.kind === "group" ? targetNode.id : findTask(targetNode.id)?.group?.id;
        items = sources.map((found) => createLinkedTaskTree(found.item, normalizedMode, targetGroupId)).filter(Boolean);
      }

      const inserted = insertPastedItems(items, targetNode);
      if (!inserted.length) {
        discardUndoState();
        return [];
      }
      setSingleSelection({ kind: "task", id: inserted[0].id });
      saveState();
      render();
      return inserted;
    }

    function tasksToMarkdown(tasks, depth = 0) {
      return (tasks || []).flatMap((placement) => {
        const item = resolveTaskItem(placement);
        const line = `${"  ".repeat(depth)}- ${item?.text || ""}`;
        const children = placement.linkType === "reference"
          ? []
          : (placement.children?.length ? placement.children : item?.children || []);
        const nested = tasksToMarkdown(children, depth + 1);
        return nested ? [line, nested] : [line];
      }).join("\n");
    }

    function parseMarkdownTasks(markdown, groupId = null) {
      const roots = [];
      const stack = [];
      String(markdown || "").split(/\r?\n/).forEach((line) => {
        const match = line.match(/^(\s*)[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/);
        if (!match) return;
        const spaces = match[1].replace(/\t/g, "  ").length;
        const depth = Math.floor(spaces / 2);
        const parent = depth > 0 ? stack[depth - 1] : null;
        const item = task(match[2].trim(), [], {
          createdInGroupId: groupId,
          createdUnderTaskId: parent?.id || null,
        });
        if (parent) parent.children.push(item);
        else roots.push(item);
        stack[depth] = item;
        stack.length = depth + 1;
      });
      return roots;
    }

    function getSelectedTaskRoots(nodes = getSelectedNodes()) {
      const selectedIds = new Set(nodes.filter((node) => node.kind === "task").map((node) => node.id));
      return nodes.filter((node) => {
        if (node.kind !== "task") return false;
        let parent = findTask(node.id)?.parent;
        while (parent) {
          if (selectedIds.has(parent.id)) return false;
          parent = findTask(parent.id)?.parent;
        }
        return true;
      }).map((node) => findTask(node.id)?.item).filter(Boolean);
    }

    function selectedNodesToMarkdown(nodes = getSelectedNodes()) {
      const groupIds = new Set(nodes.filter((node) => node.kind === "group").map((node) => node.id));
      const groups = [...groupIds].map((id) => findGroup(id)).filter(Boolean);
      const tasks = getSelectedTaskRoots(nodes)
        .filter((item) => !groupIds.has(findTask(item.id)?.group?.id));
      const sections = groups.map((group) => `## ${group.title}\n\n${tasksToMarkdown(group.tasks)}`);
      if (tasks.length) sections.push(tasksToMarkdown(tasks));
      return sections.join("\n\n").trim();
    }

    function rememberInternalClipboard(mode = "copy") {
      const nodes = getSelectedNodes();
      const markdown = selectedNodesToMarkdown(nodes);
      if (!markdown) return null;
      const groupIds = new Set(nodes.filter((node) => node.kind === "group").map((node) => node.id));
      const tasks = getSelectedTaskRoots(nodes)
        .filter((item) => !groupIds.has(findTask(item.id)?.group?.id));
      internalClipboard = {
        mode,
        taskIds: tasks.map((item) => item.id),
        markdown,
      };
      // Evren's spec (2026-07-17): cut removes items immediately like any
      // editor; paste re-inserts the same objects, undo restores them in place
      if (mode === "cut" && tasks.length) {
        const cutIds = new Set(tasks.map((item) => item.id));
        const visible = getVisibleNodes();
        const firstIndex = visible.findIndex((node) => node.kind === "task" && cutIds.has(node.id));
        const neighbor = visible.slice(0, Math.max(0, firstIndex)).reverse()
          .find((node) => !(node.kind === "task" && cutIds.has(node.id)));
        pushUndoState("cut", tasks.length === 1
          ? `Cut "${shortText(resolveTaskItem(tasks[0])?.text)}"`
          : `Cut ${tasks.length} tasks`);
        internalClipboard.detached = tasks.map((item) => removeTask(item.id)).filter(Boolean);
        if (neighbor) setSingleSelection(neighbor);
        saveState();
        render();
      }
      return internalClipboard;
    }

    let pasteLinkOverride = null; // Ctrl+Shift+V arms a one-shot unlinked paste

    function resolvePasteMode() {
      if (internalClipboard?.mode === "cut") return "move";
      if (pasteLinkOverride) return pasteLinkOverride;
      if (state.settings.pasteMode !== "ask") return state.settings.pasteMode;
      const answer = window.prompt?.("Paste as: linked (stays in sync), shortcut (jumps to original), or duplicate?", "linked")?.toLowerCase();
      const modes = { linked: "alias", alias: "alias", shortcut: "reference", reference: "reference", duplicate: "duplicate" };
      return modes[answer] || "alias";
    }

    function pasteExternalMarkdown(markdown, targetNode = selectedNode) {
      if (!targetNode) return [];
      const groupId = targetNode.kind === "group" ? targetNode.id : findTask(targetNode.id)?.group?.id;
      const items = parseMarkdownTasks(markdown, groupId);
      if (!items.length) return [];
      pushUndoState("paste");
      const inserted = insertPastedItems(items, targetNode);
      if (!inserted.length) {
        discardUndoState();
        return [];
      }
      setSingleSelection({ kind: "task", id: inserted[0].id });
      saveState();
      render();
      return inserted;
    }

    function removeTask(id) {
      const found = findTask(id);
      if (!found) return null;
      const [removed] = found.list.splice(found.index, 1);
      return removed;
    }

