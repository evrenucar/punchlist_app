    function render() {
      const ownsLinkCache = !linkCountCache;
      if (ownsLinkCache) linkCountCache = buildLinkCountCache();
      try {
        renderEverything();
      } finally {
        if (ownsLinkCache) linkCountCache = null;
      }
    }

    function renderEverything() {
      const query = searchEl.value.trim().toLowerCase();
      if (!state.settings.timelineView) showTimeline = false;
      if (!showList && !showTimeline) showList = true;
      // The markdown mode is one attribute and the CSS does the rest, so it
      // rides on every render rather than on the settings control alone: a
      // sync pull or an import replaces settings wholesale and both land here.
      document.body?.setAttribute("data-md-mode", MARKDOWN_MODES.includes(state.settings.markdownMode) ? state.settings.markdownMode : "edit");
      document.body?.classList.toggle("app-sidebar-collapsed", Boolean(state.settings.sidebarCollapsed));
      if (viewsTimelineNavEl) {
        viewsTimelineNavEl.hidden = !state.settings.timelineView;
        viewsTimelineNavEl.classList.toggle("active", showTimeline && state.settings.timelineView);
      }
      viewsNavEl?.querySelector('[data-view-nav="board"]')?.classList.toggle("active", showList);
      if (viewToggleEl) {
        viewToggleEl.hidden = !state.settings.timelineView;
        viewListEl?.classList.toggle("active", showList);
        viewTimelineEl?.classList.toggle("active", showTimeline);
        if (timelineDateEl) {
          timelineDateEl.hidden = !showTimeline;
          timelineDateEl.value = timelineDate;
        }
      }
      if (taskDetailsHostEl) taskDetailsHostEl.innerHTML = renderDetailsPanel();
      if (boardSplitEl) boardSplitEl.classList.toggle("with-timeline", showTimeline && showList);
      if (timelinePaneEl) {
        timelinePaneEl.hidden = !showTimeline;
        timelinePaneEl.innerHTML = showTimeline ? renderTimelineSection(timelineDate) : "";
      }
      boardEl.hidden = !showList;
      if (exampleBannerHostEl) {
        exampleBannerHostEl.innerHTML = state.example && showList
          ? '<div class="example-banner"><span>These are example tasks. Click around, then clear them when you are ready.</span><button class="control primary" type="button" data-action="start-own-board">Start my own board</button></div>'
          : "";
      }
      // Not gated on showList: the storage it warns about is shared whichever
      // view is open.
      renderSharedOriginWarning();
      renderHistoryList();
      if (!showList) {
        lifecycleSignature = getLifecycleSignature();
        return;
      }
      const firstGroup = state.groups[0];
      const topDrop = firstGroup
        ? `<div class="group-top-drop" data-board-top-drop data-drop-target="${firstGroup.id}" data-drop-kind="group" data-position="before" aria-label="Move group to top"></div>`
        : "";
      boardEl.innerHTML = topDrop
        + state.groups.map((group, index) => renderGroup(group, query, index)).join("")
        + renderLifecycleSections();
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode) renderSelection();
    }

    // Scoped render (grill Q23, 2026-07-19): rebuild ONE group's article
    // instead of the whole board — a full rebuild cost 75ms at 4500 nodes,
    // 4-5 dropped frames on every create/indent (the reported flash).
    // Callers guarantee the operation touched only this group; anything the
    // fast path cannot prove safe at runtime falls back to render().
    function renderGroupInPlace(groupId) {
      const ownsLinkCache = !linkCountCache;
      if (ownsLinkCache) linkCountCache = buildLinkCountCache();
      try {
        renderGroupInPlaceInner(groupId);
      } finally {
        if (ownsLinkCache) linkCountCache = null;
      }
    }

    function renderGroupInPlaceInner(groupId) {
      const index = state.groups.findIndex((group) => group.id === groupId);
      const article = document.querySelector?.(`[data-group-card="${groupId}"]`);
      const query = searchEl?.value?.trim().toLowerCase() || "";
      // search re-filters globally; vm and hidden-board render nothing to swap
      if (index < 0 || !article || boardEl.hidden || query) {
        render();
        return;
      }
      const wrap = document.createElement("div");
      wrap.innerHTML = renderGroup(state.groups[index], "", index);
      article.replaceWith(wrap.firstElementChild);
      // the 1s maintenance loop diffs this; a stale value forces a redundant
      // full render one second later and masks scoping bugs
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode) renderSelection();
    }

    // Scoping v2 (Evren 2026-07-19, "mainly sub items flash"): his boards are
    // a few HUGE groups, so a group-article swap is nearly a full render
    // (~150ms measured) and shifts the viewport ~90px on nested creates. A
    // task-subtree swap replaces one <li> — the drop zones ride inside it —
    // and leaves layout above and below untouched.
    function renderTaskSubtreeInPlace(taskId, groupId) {
      const ownsLinkCache = !linkCountCache;
      if (ownsLinkCache) linkCountCache = buildLinkCountCache();
      try {
        renderTaskSubtreeInPlaceInner(taskId, groupId);
      } finally {
        if (ownsLinkCache) linkCountCache = null;
      }
    }

    function renderTaskSubtreeInPlaceInner(taskId, groupId) {
      const li = document.querySelector?.(`li[data-task="${taskId}"]`);
      const found = li ? findTask(taskId) : null;
      const query = searchEl?.value?.trim() || "";
      if (!li || !found || boardEl.hidden || query) {
        renderGroupInPlace(groupId);
        return;
      }
      const wrap = document.createElement("div");
      wrap.innerHTML = renderTask(found.item, found.group?.id || groupId, "");
      const next = wrap.firstElementChild;
      // a task that became hidden (retention) renders to nothing: its li just
      // leaves — replaceWith(null) would throw
      if (next) li.replaceWith(next);
      else li.remove();
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode) renderSelection();
    }

    // Top-level li surgery: reconcile ONLY the named task ids against a group's
    // top-level list, so depth-0 splits/inserts/indents swap one or two <li>s
    // instead of rebuilding the whole (huge) group article. Ids no longer at
    // the top level lose their li; ids present get their li swapped in place or
    // inserted after the nearest preceding sibling that has one.
    function renderTopLevelInPlace(groupId, taskIds) {
      const group = findGroup(groupId);
      const ul = document.querySelector?.(`[data-group-list="${groupId}"]`);
      const query = searchEl?.value?.trim() || "";
      if (!group || !ul || boardEl.hidden || query || group.collapsed) {
        renderGroupInPlace(groupId);
        return;
      }
      // an empty group renders an empty-state <p> outside the ul; going from
      // empty to first task must rebuild the article to clear it
      if (!ul.querySelector(':scope > li[data-task]')) {
        renderGroupInPlace(groupId);
        return;
      }
      reconcileListInPlace(ul, group.tasks, groupId, taskIds);
      // ...and the last task leaving has to bring that empty state back
      if (!ul.querySelector(':scope > li[data-task]')) renderGroupInPlace(groupId);
    }

    // Reconcile ONLY the named ids inside one already-rendered <ul>. An id the
    // model no longer holds loses its li; an id it holds gets its li swapped in
    // place, or inserted after the nearest preceding sibling that has one.
    // Every other li in the list keeps its DOM — that is what stops the flash.
    function reconcileListInPlace(ul, tasks, groupId, taskIds) {
      for (const id of taskIds) {
        const li = ul.querySelector(`:scope > li[data-task="${id}"]`);
        const index = tasks.findIndex((t) => t.id === id);
        if (li) li.remove();
        if (index < 0) continue; // left this list (indent/merge/move away)
        const html = renderTask(tasks[index], groupId, "");
        if (!html) continue; // hidden — nothing to show
        let anchor = null;
        for (let i = index - 1; i >= 0 && !anchor; i--) {
          anchor = ul.querySelector(`:scope > li[data-task="${tasks[i].id}"]`);
        }
        if (anchor) anchor.insertAdjacentHTML("afterend", html);
        else ul.insertAdjacentHTML("afterbegin", html);
      }
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode) renderSelection();
    }

    // Sub-item surgery: patch a parent's child <ul> and leave the parent's own
    // ROW alone. A subtree swap rebuilt that row too, which is what Evren saw
    // as "when creating a sub item the item above flashes" (2026-07-26) — the
    // item above being the parent. Only safe while the parent row itself cannot
    // have changed: it had a rendered, expanded child list and still has one.
    // First child, a collapse flip, or the last child leaving all fall back.
    function renderChildrenInPlace(parentId, groupId, taskIds) {
      const ul = document.querySelector?.(`li[data-task="${parentId}"] > ul.child-list`);
      const found = ul ? findTask(parentId) : null;
      const query = searchEl?.value?.trim() || "";
      if (!found || boardEl.hidden || query || found.item.collapsed) {
        renderTaskSubtreeInPlace(parentId, groupId);
        return;
      }
      const children = found.item.linkType === "reference" ? [] : (found.item.children || []);
      reconcileListInPlace(ul, children, found.group?.id || groupId, taskIds);
      // the row's chevron and child drop-zone hang off having visible children
      if (!ul.querySelector(':scope > li[data-task]')) renderTaskSubtreeInPlace(parentId, groupId);
    }

    // A linked task's edit repaints the edited scope plus every other placement
    // of the same underlying task(s), instead of the whole board. Each
    // placement rides the subtree primitive, whose own fallback (a group swap)
    // already covers a missing li.
    function renderLinkedPlacements(editedItems, coveringTaskId, groupId) {
      const items = Array.isArray(editedItems) ? editedItems : [editedItems];
      const resolvedIds = new Set(items.map((item) => resolveTaskItem(item)?.id || item?.id).filter(Boolean));
      if (!resolvedIds.size || typeof document.querySelector !== "function") {
        render();
        return;
      }
      renderScoped(coveringTaskId, groupId);
      const seen = new Set(items.map((item) => item?.id).filter(Boolean));
      state.groups.forEach((group) => walkPlacements(group.tasks, (placement) => {
        if (seen.has(placement.id)) return;
        const hits = resolvedIds.has(placement.id)
          || (["alias", "reference"].includes(placement.linkType) && resolvedIds.has(placement.targetTaskId));
        if (!hits) return;
        seen.add(placement.id);
        renderTaskSubtreeInPlace(placement.id, group.id);
      }));
    }

    // After a completion slide-away (or the 1s lifecycle tick), retire exactly
    // the rows that became hidden: remove their lis, repaint placements that
    // stay visible (per-placement retention can differ), refresh the lifecycle
    // sections. A vanished selection falls back to the full render.
    function retireHiddenRows(resolvedIds) {
      const ids = new Set(resolvedIds);
      const query = searchEl?.value?.trim() || "";
      if (!ids.size || typeof document.querySelector !== "function" || boardEl.hidden || query) {
        render();
        return;
      }
      state.groups.forEach((group) => walkPlacements(group.tasks, (placement) => {
        const resolved = resolveTaskItem(placement);
        if (!resolved || !ids.has(resolved.id)) return;
        if (!isTaskHiddenFromActive(placement, group)) {
          // this placement's own retention keeps it visible: repaint its row
          renderTaskSubtreeInPlace(placement.id, group.id);
          return;
        }
        document.querySelector(`li[data-task="${placement.id}"]`)?.remove();
      }));
      refreshLifecycleSections();
      lifecycleSignature = getLifecycleSignature();
      if (selectedNode && !getNodeRow(selectedNode)) {
        render();
        return;
      }
      if (selectedNode) renderSelection();
    }

    // Route a scoped render to the smallest container that covers the change:
    // a task subtree when one exists, else named top-level lis, else the group.
    function renderScoped(coveringTaskId, groupId, topLevelTaskIds) {
      if (coveringTaskId) renderTaskSubtreeInPlace(coveringTaskId, groupId);
      else if (topLevelTaskIds && topLevelTaskIds.length) renderTopLevelInPlace(groupId, topLevelTaskIds);
      else renderGroupInPlace(groupId);
    }

    // A task placement is safe for scoped rendering only when nothing else
    // mirrors it: not a linked copy itself, and no other group holds a
    // placement of it (text/done/children/badges fan out through the links).
    function taskIsLinkFree(item) {
      if (!item || item.linkType) return false;
      const resolved = resolveTaskItem(item);
      return !resolved || getLinkCount(resolved.id) === 0;
    }

    function subtreeIsLinkFree(item) {
      if (!item) return true;
      if (item.linkType || getLinkCount(item.id) > 0) return false;
      return (item.children || []).every(subtreeIsLinkFree);
    }

    // Deletes move rows into the Completed/Trash details at the board bottom;
    // a scoped delete swaps those two sections alongside the group article.
    function refreshLifecycleSections() {
      const completed = document.querySelector?.("[data-completed-section]");
      const trash = document.querySelector?.("[data-trash-section]");
      if (!completed || !trash) return false;
      const wrap = document.createElement("div");
      wrap.innerHTML = renderLifecycleSections();
      const freshCompleted = wrap.querySelector("[data-completed-section]");
      const freshTrash = wrap.querySelector("[data-trash-section]");
      freshCompleted.open = completed.open;
      freshTrash.open = trash.open;
      completed.replaceWith(freshCompleted);
      trash.replaceWith(freshTrash);
      return true;
    }

