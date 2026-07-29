    // Pure so the suite can pin it: URL-encodes the description and appends
    // the running version plus whether this copy is hosted or downloaded.
    // Evren, 2026-07-28: "Open-a-GitHub-issue must autofill BOTH (currently the
    // issue title is the standard boilerplate)." His summary IS the title now,
    // and "Bug report" is only the fallback for someone who typed nothing.
    // Images deliberately do not ride along: a prefilled issue URL carries text
    // and nothing else, GitHub does not render data: URIs in an issue body, and
    // a screenshot as base64 is far past any URL length that survives. His call,
    // asked and answered the same day: "If there are images or other fiels user
    // can be asked to add it to the github issue themselves."
    function buildBugReportUrl(description, summary) {
      const title = String(summary || "").trim() || "Bug report";
      const said = String(description || "").trim();
      const body = [
        said,
        "",
        "**Screenshots, exported JSON, console logs:** please attach them here, they cannot travel from the app.",
        "",
        `App version: v${APP_VERSION} (${IS_LOCAL_FILE ? "downloaded" : "hosted"})`,
      ].join("\n");
      return `${BUG_ISSUE_BASE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }

    function openBugDialog() {
      if (!bugDialogEl || IS_DEMO) return;
      bugDialogEl.hidden = false;
      bugSummaryEl?.focus?.();
    }

    // Evren, 2026-07-28: "reopening the dialog keeps the previous text. Clear it
    // once either button is clicked. For the email path keep it on screen and
    // only clear when the menu is closed." So GitHub clears on the spot (the
    // text is safely in the issue), and the email path holds it, because his
    // copy may have failed and retyping a bug report twice is the worst outcome
    // here. Closing is the signal that he is done with it.
    function clearBugFields() {
      if (bugSummaryEl) bugSummaryEl.value = "";
      if (bugTextEl) bugTextEl.value = "";
    }

    function closeBugDialog() {
      if (bugDialogEl) bugDialogEl.hidden = true;
      clearBugFields();
    }

    // Evren, 2026-07-28: "the restore-example-board button is far too easy to
    // press". It sat mid-panel at full width beside Export settings, one click
    // from erasing everything, and a window.confirm cannot hold a backup
    // button. So: two deliberate presses, the size of the loss counted out in
    // his own board's numbers, and Export JSON inside the dialog.
    let resetArmed = false;

    function countBoard() {
      let tasks = 0;
      const walk = (list) => (list || []).forEach((task) => {
        tasks += 1;
        walk(task.children);
      });
      (state.groups || []).forEach((group) => walk(group.tasks));
      return { tasks, groups: (state.groups || []).length };
    }

    function renderResetDialog() {
      const { tasks, groups } = countBoard();
      const size = `${tasks} ${tasks === 1 ? "task" : "tasks"} in ${groups} ${groups === 1 ? "group" : "groups"}`;
      if (resetBodyEl) {
        resetBodyEl.textContent = resetArmed
          ? `Last check. ${size} go, and Trash, history and undo go with them. There is no way back from this one.`
          : `This replaces your board with the built-in example. ${size} will be erased, along with Trash and history. Export first if you might want any of it back.`;
      }
      if (resetConfirmEl) resetConfirmEl.textContent = resetArmed ? "Yes, erase my board" : "Replace my board";
    }

    function openResetDialog() {
      if (!resetDialogEl) return;
      resetArmed = false;
      renderResetDialog();
      resetDialogEl.hidden = false;
      resetExportEl?.focus?.();
    }

    function closeResetDialog() {
      if (resetDialogEl) resetDialogEl.hidden = true;
      resetArmed = false;
    }

    function restoreExampleBoard() {
      localStorage.removeItem(STORAGE_KEY);
      state = normalizeState(seedState());
      selectedNode = null;
      multiSelectedNodes = [];
      selectionAnchorNode = null;
      undoStack = [];
      undoActions = [];
      lastUndoAction = null;
      exitFocusMode();
      render();
    }

    resetConfirmEl?.addEventListener("click", () => {
      if (!resetArmed) {
        resetArmed = true;
        renderResetDialog();
        return;
      }
      closeResetDialog();
      restoreExampleBoard();
      showToast("Example board restored.");
    });

    resetExportEl?.addEventListener("click", () => {
      downloadBoardState()
        .then(() => showToast("Board exported. Nothing has been erased yet."))
        .catch(() => showToast("Export failed."));
    });

    document.querySelectorAll("[data-reset-close]").forEach((el) => el.addEventListener("click", closeResetDialog));

    resetDialogEl?.addEventListener("click", (event) => {
      if (event.target === resetDialogEl) closeResetDialog();
    });

    reportBugEl?.addEventListener("click", openBugDialog);
    bugCloseEl?.addEventListener("click", closeBugDialog);
    bugDialogEl?.addEventListener("click", (event) => {
      if (event.target === bugDialogEl) closeBugDialog();
    });
    bugGithubEl?.addEventListener("click", () => {
      window.open?.(buildBugReportUrl(bugTextEl?.value || "", bugSummaryEl?.value || ""), "_blank", "noopener");
      closeBugDialog();
    });
    // Evren, 2026-07-29: "Copy evrens imail shouldn't copy summary. Can just
    // copy the email. It already doesn't close the window user would be able to
    // do their own copy paste." So the clipboard gets the address and nothing
    // else; the dialog staying open is what makes that enough.
    bugEmailEl?.addEventListener("click", () => {
      const text = FEEDBACK_EMAIL;
      const done = () => {
        // stays open and keeps the text on purpose: see clearBugFields
        showToast(`${FEEDBACK_EMAIL} copied. Your text is still here to paste into the email.`);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {
          window.prompt?.("Copy the feedback address:", FEEDBACK_EMAIL);
        });
        return;
      }
      window.prompt?.("Copy the feedback address:", FEEDBACK_EMAIL);
    });

    featureMetadataEl?.addEventListener("change", () => updateSettings({ metadata: featureMetadataEl.checked }));
    featureTimelineEl?.addEventListener("change", () => updateSettings({ timelineView: featureTimelineEl.checked }));
    featureRemindersEl?.addEventListener("change", () => updateSettings({ reminders: featureRemindersEl.checked }));
    featureNotificationsEl?.addEventListener("change", () => {
      updateSettings({ browserNotifications: featureNotificationsEl.checked });
      if (featureNotificationsEl.checked && typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission?.();
      }
    });

