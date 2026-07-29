    function getExportState() {
      const includeCompleted = state.settings.exportCompleted !== false;
      const groups = state.groups.map((group) => ({
        ...group,
        tasks: filterTasksForExport(group.tasks, includeCompleted),
      }));
      // identity holds the private key and contacts is the local trust book;
      // neither may ever land in a shared file. Device names stay: attribution
      // is the point of the roster.
      return embedImagesInExport(JSON.parse(JSON.stringify({
        ...state,
        settings: undefined,
        identity: undefined,
        contacts: undefined,
        groups,
        trash: state.settings.exportTrash ? state.trash : [],
      })));
    }

    function filterTasksForExport(tasks, includeCompleted) {
      return (tasks || []).flatMap((placement) => {
        const item = resolveTaskItem(placement);
        if (!includeCompleted && item?.done) return [];
        return [{
          ...placement,
          children: filterTasksForExport(placement.children || [], includeCompleted),
        }];
      });
    }

    async function serializeBoardState() {
      return JSON.stringify(await getBoardExportPayload(), null, 2);
    }

    async function importBoardStateFromJson(jsonText) {
      const payload = JSON.parse(jsonText);
      if (payload?.kind === "punchlist-settings" && payload.settings && typeof payload.settings === "object") {
        pushUndoState("board", `Imported settings${payload.exportedBy ? ` from ${payload.exportedBy}` : ""}`);
        state.settings = { ...DEFAULT_SETTINGS, ...payload.settings };
        saveState();
        syncSettingsControls();
        applySidebarWidth();
        render();
        showToast("Settings imported.");
        return true;
      }
      const importedState = payload?.state || payload;
      if (!importedState || !Array.isArray(importedState.groups)) {
        throw new Error("Imported file must contain a state.groups array.");
      }
      const sender = await describeImportSender(payload);
      if (sender.verdict === "invalid") {
        const proceed = window.confirm?.("This file's signature does not match its content — it was changed after being signed, or corrupted in transit. Import it anyway?");
        if (!proceed) return false;
      }
      if (focusModeTaskId) exitFocusMode();
      const senderLabel = sender.fingerprint ? `${sender.name || "unnamed"} (${sender.fingerprint})` : "";
      pushUndoState("board", `Imported a board from JSON${senderLabel ? `, signed by ${senderLabel}` : ""}`);
      const currentSettings = state.settings;
      const currentIdentity = state.identity || null;
      const currentContacts = state.contacts && typeof state.contacts === "object" ? state.contacts : {};
      state = migrateState(importedState, new Date().toISOString(), { includeResearch: false });
      state.settings = { ...DEFAULT_SETTINGS, ...currentSettings };
      // Never adopt an identity from a shared file while one exists here:
      // exports carry no private key, and a raw dump's key belongs to its owner.
      if (currentIdentity) state.identity = currentIdentity;
      state.contacts = Object.keys(currentContacts).length ? currentContacts : (state.contacts || {});
      if ((sender.verdict === "known" || sender.verdict === "first-contact") && sender.fingerprint) {
        const existing = state.contacts[sender.fingerprint];
        const now = new Date().toISOString();
        state.contacts[sender.fingerprint] = {
          name: sender.name || existing?.name || "",
          firstSeenAt: existing?.firstSeenAt || now,
          lastSeenAt: now,
        };
      }
      // The imported board's history replaced the local one above, so the
      // provenance entry has to land in the new state to survive the import.
      logHistory(`Imported a board from JSON${senderLabel ? `, signed by ${senderLabel}` : ""}`);
      selectedNode = getVisibleNodes()[0] || null;
      multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
      selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      // imported files carry embedded images (lossless exports); they move
      // straight into the asset store like any other first run
      if (assetsAvailable()) offloadEmbeddedImages();
      saveState();
      syncSettingsControls();
      render();
      showToast(importVerdictToast(sender));
      return true;
    }

    function importVerdictToast(sender) {
      const label = sender.name || (sender.fingerprint ? `sender ${sender.fingerprint}` : "");
      if (sender.verdict === "self") return "Imported a board signed with this board's own key.";
      if (sender.verdict === "known") return `Imported a board from ${label}, the same sender as before.`;
      if (sender.verdict === "first-contact") return `Imported a board from ${label}, the first import from this sender.`;
      if (sender.verdict === "invalid") return "Imported a board whose signature did not match its content.";
      return "Imported an unsigned board.";
    }

    function downloadJsonFile(filename, text) {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    async function downloadBoardState() {
      downloadJsonFile(`punchlist-board-${new Date().toISOString().slice(0, 10)}.json`, await serializeBoardState());
    }

    function downloadSettingsExport() {
      const name = String(state.settings.username || "").trim();
      const payload = {
        kind: "punchlist-settings",
        exportedBy: name || null,
        exportedAt: new Date().toISOString(),
        settings: { ...state.settings },
      };
      const slug = name ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-` : "";
      downloadJsonFile(`punchlist-settings-${slug}${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
    }

    function handleImportFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        importBoardStateFromJson(String(reader.result || "")).catch((error) => window.alert(error.message));
      });
      reader.readAsText(file);
    }

    // ---- GitHub sync -------------------------------------------------------
    // The board lives as one JSON file in a private repo the user owns; every
    // device reads and writes it through the GitHub contents API with a
    // fine-grained token scoped to that repo. Each push is a commit, so any
    // overwritten version stays recoverable in the repo's git history.
    // Reads past the contents API's ~1 MB cap fall back to the Git blobs API
    // (100 MB) — the deferred ponytail note came due when Evren's board
    // outgrew the cap and his devices split-brained (2026-07-18).

