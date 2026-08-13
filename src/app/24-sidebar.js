    function closeSidebarDrawer() {
      document.body?.classList.remove("sidebar-open");
      if (sidebarBackdropEl) sidebarBackdropEl.hidden = true;
    }

    sidebarToggleEl?.addEventListener("click", () => {
      if (window.matchMedia?.("(max-width: 980px)").matches) {
        const open = !document.body?.classList.contains("sidebar-open");
        document.body?.classList.toggle("sidebar-open", open);
        if (sidebarBackdropEl) sidebarBackdropEl.hidden = !open;
        return;
      }
      updateSettings({ sidebarCollapsed: !state.settings.sidebarCollapsed });
    });

    sidebarBackdropEl?.addEventListener("click", closeSidebarDrawer);

    let mobileSidebarTogglePinAt = null;
    function updateMobileSidebarTogglePin() {
      if (!sidebarToggleEl || !mainEl) return;
      const mobile = Boolean(window.matchMedia?.("(max-width: 640px)").matches);
      if (!mobile) {
        sidebarToggleEl.classList.remove("mobile-pinned");
        mobileSidebarTogglePinAt = null;
        return;
      }
      if (mobileSidebarTogglePinAt === null && !sidebarToggleEl.classList.contains("mobile-pinned")) {
        mobileSidebarTogglePinAt = sidebarToggleEl.getBoundingClientRect().bottom + mainEl.scrollTop;
      }
      sidebarToggleEl.classList.toggle("mobile-pinned", mainEl.scrollTop > mobileSidebarTogglePinAt);
    }

    mainEl?.addEventListener("scroll", updateMobileSidebarTogglePin, { passive: true });
    window.matchMedia?.("(max-width: 640px)")?.addEventListener?.("change", updateMobileSidebarTogglePin);

    // Evren, 2026-07-28: "scrolling is dead while the cursor is over the help
    // text". The drawer backdrop is what sat under it. Under 980px the sidebar
    // is a fixed drawer at z-index 60 and the backdrop covers the screen at 55.
    // Widen the window past 980 and the sidebar goes back to static, which has
    // no z-index at all, so the backdrop is suddenly on top of the whole page:
    // it swallows every wheel and every click, and a wheel that lands on it
    // chains to a body that cannot scroll. Nothing was closing the drawer on a
    // resize, so a drawer opened at a narrow width outlived the width.
    window.matchMedia?.("(max-width: 980px)")?.addEventListener?.("change", (event) => {
      if (!event.matches) closeSidebarDrawer();
    });

    sidebarToggleEl?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "Escape") {
        event.preventDefault();
        if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        const target = [...document.querySelectorAll(".sidebar button, .sidebar summary")].find((el) => el.offsetParent !== null);
        if (target) target.focus();
        else if (selectedNode) renderSelection(true);
        else selectNode(getVisibleNodes()[0]);
      }
    });

    function leaveSidebarForBoard() {
      if (selectedNode) renderSelection(true);
      else selectNode(getVisibleNodes()[0]);
    }

    // Evren, 2026-07-28: "still can't go all the way down on the menu". Chrome
    // hides a closed <details>'s content with content-visibility on the details
    // slot, and that leaves every child reporting an offsetParent. So the walk
    // list was full of settings nobody could see, .focus() did nothing on them,
    // and the walk looked frozen on the Settings row. Ask the disclosure, not
    // the layout. offsetParent still earns its place: it catches [hidden] and a
    // collapsed sidebar. A summary is judged by what encloses its OWN details,
    // or a closed section would hide the very row that opens it.
    function sidebarStopIsVisible(el) {
      if (el.offsetParent === null) return false;
      const from = el.tagName === "SUMMARY" ? el.parentElement?.parentElement : el;
      return !from?.closest("details:not([open])");
    }

    historyMenuEl?.addEventListener("toggle", renderHistoryList);

    let lightboxView = null;
    function openLightbox(src) {
      if (!lightboxEl || !lightboxImgEl) return;
      lightboxView = { scale: 1, x: 0, y: 0, panning: null };
      lightboxImgEl.src = src;
      applyLightboxTransform();
      lightboxEl.hidden = false;
    }

    function closeLightbox() {
      if (!lightboxEl) return;
      lightboxEl.hidden = true;
      lightboxView = null;
      if (lightboxImgEl) lightboxImgEl.src = "";
    }

    function applyLightboxTransform() {
      if (!lightboxImgEl || !lightboxView) return;
      lightboxImgEl.style.transform = `translate(${lightboxView.x}px, ${lightboxView.y}px) scale(${lightboxView.scale})`;
    }

    boardEl.addEventListener("dblclick", (event) => {
      const image = event.target.closest(".task-image img");
      if (image) openLightbox(image.src);
    });

    lightboxEl?.addEventListener("click", (event) => {
      if (event.target === lightboxEl) closeLightbox();
    });

    lightboxEl?.addEventListener("wheel", (event) => {
      if (!lightboxView) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      lightboxView.scale = Math.min(8, Math.max(0.2, lightboxView.scale * factor));
      applyLightboxTransform();
    }, { passive: false });

    lightboxEl?.addEventListener("pointerdown", (event) => {
      if (!lightboxView || event.target !== lightboxImgEl) return;
      lightboxView.panning = { pointerId: event.pointerId, startX: event.clientX - lightboxView.x, startY: event.clientY - lightboxView.y };
      event.preventDefault();
    });

    lightboxEl?.addEventListener("pointermove", (event) => {
      const pan = lightboxView?.panning;
      if (!pan || event.pointerId !== pan.pointerId) return;
      lightboxView.x = event.clientX - pan.startX;
      lightboxView.y = event.clientY - pan.startY;
      applyLightboxTransform();
    });

    lightboxEl?.addEventListener("pointerup", () => {
      if (lightboxView) lightboxView.panning = null;
    });

    let imageResize = null;
    boardEl.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest("[data-image-handle]");
      if (!handle) return;
      const img = handle.closest(".task-image")?.querySelector("img");
      if (!img) return;
      imageResize = {
        pointerId: event.pointerId,
        taskId: handle.dataset.imageTask,
        imageId: handle.dataset.imageId,
        side: handle.dataset.imageHandle,
        startX: event.clientX,
        startWidth: img.getBoundingClientRect().width,
        img,
      };
      event.preventDefault();
      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch {
        /* pointer already released */
      }
    });
    boardEl.addEventListener("pointermove", (event) => {
      if (!imageResize || event.pointerId !== imageResize.pointerId) return;
      const delta = event.clientX - imageResize.startX;
      const width = Math.min(900, Math.max(60, imageResize.startWidth + (imageResize.side === "right" ? delta : -delta)));
      imageResize.img.style.width = `${width}px`;
      event.preventDefault();
    });
    boardEl.addEventListener("pointerup", (event) => {
      if (!imageResize || event.pointerId !== imageResize.pointerId) return;
      const found = findTask(imageResize.taskId);
      const record = found ? (resolveTaskItem(found.item).images || []).find((img) => img.id === imageResize.imageId) : null;
      if (record) {
        record.width = Math.round(parseFloat(imageResize.img.style.width) || record.width);
        saveState();
      }
      imageResize = null;
    });

    viewsNavEl?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view-nav]");
      if (!button) return;
      const target = button.dataset.viewNav;
      if (target === "board") showList = true;
      if (target === "timeline") showTimeline = !showTimeline;
      if (target === "completed" || target === "trash") showList = true;
      render();
      closeSidebarDrawer();
      if (target === "completed" || target === "trash") {
        const section = document.querySelector(target === "completed" ? "[data-completed-section]" : "[data-trash-section]");
        if (section) {
          section.open = true;
          section.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }
        return;
      }
      (mainEl || window).scrollTo?.({ top: 0, behavior: "smooth" });
    });

    function applySidebarWidth() {
      const width = Math.min(420, Math.max(200, Number(state.settings.sidebarWidth) || 280));
      document.documentElement?.style?.setProperty("--sidebar-w", `${width}px`);
    }

    let sidebarResize = null;
    sidebarResizerEl?.addEventListener("pointerdown", (event) => {
      sidebarResize = { pointerId: event.pointerId };
      sidebarResizerEl.classList.add("dragging");
      try {
        sidebarResizerEl.setPointerCapture?.(event.pointerId);
      } catch {
        /* pointer already released */
      }
      event.preventDefault();
    });
    sidebarResizerEl?.addEventListener("pointermove", (event) => {
      if (!sidebarResize || event.pointerId !== sidebarResize.pointerId) return;
      state.settings.sidebarWidth = Math.min(420, Math.max(200, Math.round(event.clientX)));
      applySidebarWidth();
    });
    sidebarResizerEl?.addEventListener("pointerup", (event) => {
      if (!sidebarResize || event.pointerId !== sidebarResize.pointerId) return;
      sidebarResize = null;
      sidebarResizerEl.classList.remove("dragging");
      saveState();
    });

    viewListEl?.addEventListener("click", () => {
      showList = !showList;
      render();
    });
    viewTimelineEl?.addEventListener("click", () => {
      showTimeline = !showTimeline;
      render();
    });
    timelineDateEl?.addEventListener("change", () => {
      if (!SCHEDULE_DATE_PATTERN.test(timelineDateEl.value)) return;
      timelineDate = timelineDateEl.value;
      render();
    });

