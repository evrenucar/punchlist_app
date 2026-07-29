    function loadSyncConfig() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }

    function saveSyncConfig(patch) {
      Object.assign(syncConfig, patch);
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncConfig));
    }

    // Evren, 2026-07-28: the device name is MANDATORY for sync. It is the only
    // thing that tells one device from another in the roster, in history entries
    // and in the confirm dialog that asks which board to keep, and "device a07y"
    // is not an answer to that question. Gating here rather than at the toggle
    // covers every path at once: push, pull, the rev bump and the roster all
    // already ask this function first.
    function syncIsActive() {
      return !IS_DEMO && Boolean(syncConfig.enabled && syncConfig.repo && syncConfig.token && deviceIdentity.name.trim());
    }

    // What is still missing before sync can run, in the order the fields appear.
    function syncSetupGap() {
      if (!syncConfig.enabled) return "";
      if (!deviceIdentity.name.trim()) return "Name this device before syncing. It is how you tell your devices apart when they disagree.";
      if (!syncConfig.repo) return "Add the repository that stores the board.";
      if (!syncConfig.token) return "Add a token with Contents read and write on that repository.";
      return "";
    }

    function bytesToBase64(bytes) {
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    }

    function base64ToBytes(base64) {
      return Uint8Array.from(atob(String(base64).replace(/\s+/g, "")), (ch) => ch.charCodeAt(0));
    }

    function encodeBase64Utf8(text) {
      return bytesToBase64(new TextEncoder().encode(text));
    }

    function decodeBase64Utf8(base64) {
      return new TextDecoder().decode(base64ToBytes(base64));
    }

    // Same shape the History panel uses for a full stamp. Boards from builds
    // before 2026-07-28 carry no stamp, and saying so beats printing a fake date.
    function describeEditStamp(iso) {
      const at = new Date(Date.parse(iso));
      if (!Number.isFinite(at.getTime())) return "unknown (synced by an older version)";
      return `${at.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} ${formatClockTime(at)}`;
    }

    // Pure decision core: given where local and remote stand, one action.
    // Divergence (the remote moved since our last sync) is resolved by the
    // logical rev counter, never by the dirty flag or a wall clock — a stale
    // device (low rev) must never overwrite a newer board (2026-07-21 data-loss
    // fix). base = our rev at the last agreed sync. Missing rev fails safe to
    // pull. The one conflict neither counter can rank — an exact tie with local
    // edits — returns "conflict" so the caller can ask (Evren's blend).
    //
    // The counter alone was not enough (2026-07-28 data-loss fix). It ranks how
    // MANY edits a device made, never how RECENTLY: a phone holding fifty
    // week-old offline edits outranked the laptop edited a minute ago, so the
    // phone won, pushed over the fresh work, and the laptop then pulled that
    // older board down on top of itself. Both signals are now read, and when
    // they disagree about who is newer neither one can be trusted, so the
    // caller asks instead of silently picking a side. Agreement is the common
    // case and still resolves silently, so this adds no new dialogs to a normal
    // two-device day. Missing stamps (older builds) fall back to the counter.
    function syncDecision({ remoteExists, remoteSha, lastSha, dirty, base, localRev, remoteRev, localEditedAt, remoteEditedAt }) {
      if (!remoteExists) return "create";
      if (remoteSha === lastSha) return dirty ? "push" : "none";
      const knownRemote = Number.isFinite(remoteRev);
      const knownBase = Number.isFinite(base);
      const localTime = Date.parse(localEditedAt);
      const remoteTime = Date.parse(remoteEditedAt);
      // Equal stamps carry no ranking information, so they count as unknown.
      const ranked = Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime !== remoteTime;
      if (knownRemote && knownBase && remoteRev < base) return "push"; // remote regressed below our base -> heal it
      // more edits, but the other board was edited later -> the counters lie, ask
      if (knownRemote && localRev > remoteRev) return ranked && remoteTime > localTime ? "conflict" : "push";
      // fewer edits, but ours was edited later -> the 2026-07-28 bug, ask
      if (knownRemote && localRev < remoteRev) return ranked && localTime > remoteTime ? "conflict" : "pull";
      if (knownRemote && dirty) return "conflict";                     // exact tie with local edits -> ask
      return "pull";                                                   // unknown rev / nothing local to lose -> fail safe
    }

    // Sync payloads are lossless: unlike user exports they ignore the
    // exportCompleted/exportTrash filters and only strip per-device settings.
    function getSyncPayload() {
      return JSON.stringify({
        version: SCHEMA_VERSION,
        syncedAt: new Date().toISOString(),
        state: JSON.parse(JSON.stringify({ ...state, settings: undefined })),
      }, null, 2);
    }

    function applySyncedState(payload) {
      const imported = payload?.state;
      if (!imported || !Array.isArray(imported.groups)) throw new Error("The synced file has no board in it.");
      if (focusModeTaskId) exitFocusMode();
      pushUndoState("board", "Pulled board changes from GitHub");
      const currentSettings = state.settings;
      const currentIdentity = state.identity || null;
      const currentContacts = state.contacts && typeof state.contacts === "object" ? state.contacts : {};
      // A pull must not throw the user across the board: keep the selection
      // when its node survives the pull (decided from DATA, so collapsed-away
      // nodes count too) and hold the scroller where it was. The old reset to
      // the first node was Evren's "my viewport is reset".
      const keepSelection = selectedNode ? { ...selectedNode } : null;
      const scroller = typeof document.querySelector === "function" ? document.querySelector("main") : null;
      const keepScrollTop = scroller ? scroller.scrollTop : null;
      const keepRev = Number(state.rev) || 0;
      state = migrateState(imported, new Date().toISOString(), { includeResearch: false });
      // Never let the logical counter regress after adopting a remote board.
      state.rev = Math.max(Number(state.rev) || 0, keepRev);
      state.settings = currentSettings;
      // A payload from an older build must not wipe the shared key or the
      // contact book; when the remote has them, the remote versions win.
      if (!state.identity && currentIdentity) state.identity = currentIdentity;
      if (!Object.keys(state.contacts || {}).length && Object.keys(currentContacts).length) state.contacts = currentContacts;
      const survives = keepSelection
        && (keepSelection.kind === "group" ? Boolean(findGroup(keepSelection.id)) : Boolean(findTask(keepSelection.id)));
      if (survives) {
        selectedNode = keepSelection;
        multiSelectedNodes = [{ ...keepSelection }];
        selectionAnchorNode = { ...keepSelection };
      } else {
        selectedNode = getVisibleNodes()[0] || null;
        multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
        selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      }
      syncApplying = true;
      try {
        saveState();
      } finally {
        syncApplying = false;
      }
      syncSettingsControls();
      render();
      if (survives && scroller && keepScrollTop !== null) scroller.scrollTop = keepScrollTop;
    }

    // For embedders (the status/ wrapper): swap in a new whole-board state
    // WITHOUT reloading the page. Unlike applySyncedState this keeps the
    // user's selection when the node survives, logs no history entry (the
    // writer already attributed its edit), and adopts incoming settings —
    // the caller owns the whole board, not a settings-stripped sync payload.
    function applyExternalState(rawState) {
      if (!rawState || !Array.isArray(rawState.groups)) throw new Error("applyExternalState needs a board with groups");
      if (focusModeTaskId || focusModeGroupId) exitFocusMode();
      const keepSelection = selectedNode ? { ...selectedNode } : null;
      const currentIdentity = state.identity || null;
      const currentContacts = state.contacts && typeof state.contacts === "object" ? state.contacts : {};
      state = migrateState(rawState, new Date().toISOString(), { includeResearch: false });
      if (!state.identity && currentIdentity) state.identity = currentIdentity;
      if (!Object.keys(state.contacts || {}).length && Object.keys(currentContacts).length) state.contacts = currentContacts;
      saveStateToLocalStorage();
      render();
      if (keepSelection && getNodeRow(keepSelection)) {
        selectNode(keepSelection);
      } else {
        selectedNode = getVisibleNodes()[0] || null;
        multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
        selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
        if (selectedNode) renderSelection();
      }
    }

    function syncApiUrl() {
      const repo = String(syncConfig.repo || "").trim();
      return `https://api.github.com/repos/${repo}/contents/punchlist-board.json`;
    }

    function syncBlobUrl(sha) {
      const repo = String(syncConfig.repo || "").trim();
      return `https://api.github.com/repos/${repo}/git/blobs/${sha}`;
    }

    function syncAssetUrl(name) {
      const repo = String(syncConfig.repo || "").trim();
      return `https://api.github.com/repos/${repo}/contents/assets${name ? `/${name}` : ""}`;
    }

    function syncAuthHeaders() {
      return {
        Authorization: `Bearer ${syncConfig.token}`,
        Accept: "application/vnd.github+json",
      };
    }

    function setSyncStatus(message) {
      if (syncStatusEl) syncStatusEl.textContent = message || "";
    }

    function scheduleSyncPush() {
      if (typeof window.setTimeout !== "function") return;
      if (syncTimer !== null) window.clearTimeout?.(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        syncNow("edit");
      }, 2500);
    }

    async function syncNow(trigger) {
      if (!syncIsActive() || typeof fetch !== "function") return;
      if (syncBusy) {
        syncQueued = true;
        return;
      }
      syncBusy = true;
      // A debounced typing save may still be pending; land it NOW so the dirty
      // flag is truthful before the pull/push decision. Without this, a tab
      // switch mid-typing read dirty=false and PULLED the remote over the
      // unsaved edit — Evren's "my most recent change disappears".
      flushPendingSave();
      setSyncStatus("Syncing…");
      try {
        const branch = syncConfig.branch || "main";
        const get = await fetch(`${syncApiUrl()}?ref=${branch}`, { headers: syncAuthHeaders(), cache: "no-store" });
        let remote = { exists: false, sha: null, content: null };
        if (get.ok) {
          const data = await get.json();
          if (!data.content && data.size > 0) {
            // Boards past ~1 MB come back with empty content from the contents
            // API; the Git blobs API serves the same file up to 100 MB (this
            // stranded Evren's devices on 2026-07-18 — the split-brain bug).
            const blob = await fetch(syncBlobUrl(data.sha), { headers: syncAuthHeaders(), cache: "no-store" });
            if (!blob.ok) throw new Error(`Board is over 1 MB and the blob fetch answered ${blob.status}.`);
            data.content = (await blob.json()).content;
          }
          remote = { exists: true, sha: data.sha, content: data.content };
        } else if (get.status !== 404) {
          throw new Error(`GitHub answered ${get.status}${get.status === 401 ? "; check the token" : ""}.`);
        }
        let remotePayload = null;
        if (remote.exists && remote.content) {
          try { remotePayload = JSON.parse(decodeBase64Utf8(remote.content)); } catch { remotePayload = null; }
        }
        const action = syncDecision({
          remoteExists: remote.exists,
          remoteSha: remote.sha,
          lastSha: syncConfig.lastSha || null,
          dirty: Boolean(syncConfig.dirty),
          base: Number(syncConfig.lastRev),
          localRev: Number(state.rev) || 0,
          remoteRev: Number(remotePayload?.state?.rev),
          localEditedAt: state.editedAt,
          remoteEditedAt: remotePayload?.state?.editedAt,
        });
        // A true two-sided tie (equal rev, different board) is the only case
        // neither counter can rank, so it is the only one that asks (Evren's
        // blend, 2026-07-21). Background syncs never ambush with a dialog: they
        // defer the tie to a manual Sync. Everything else auto-resolves.
        let resolved = action;
        if (action === "conflict") {
          const userInitiated = trigger === "manual" || trigger === "edit" || trigger === "config" || trigger === "enable";
          if (!userInitiated || typeof window.confirm !== "function") {
            setSyncStatus("Conflict: both devices changed. Press Sync now to choose.");
            return;
          }
          // Naming both edit times is the point of the dialog (2026-07-28): the
          // old wording asked which board to keep while showing nothing to
          // decide on, so the answer was a coin flip on the board's real data.
          resolved = window.confirm(
            "Both boards changed since the last sync.\n\n"
            + `THIS device last edited:  ${describeEditStamp(state.editedAt)}\n`
            + `The other device last edited:  ${describeEditStamp(remotePayload?.state?.editedAt)}\n\n`
            + "Keep THIS device's version? Cancel keeps the other one. Either way the other stays in Undo and the repo history.")
            ? "push"
            : "pull";
        }
        if (resolved === "pull") {
          // Never yank the board out from under an active caret: retry shortly
          // instead (the debounce re-runs syncNow; it re-decides from scratch).
          const active = document.activeElement;
          if (active && active.isContentEditable && boardEl?.contains?.(active)) {
            setSyncStatus("Remote changes waiting (finishing your edit first)");
            scheduleSyncPush();
            return;
          }
          const hadLocalEdits = Boolean(syncConfig.dirty);
          applySyncedState(remotePayload || JSON.parse(decodeBase64Utf8(remote.content)));
          saveSyncConfig({ lastSha: remote.sha, dirty: false, lastRev: state.rev, lastSyncedAt: new Date().toISOString() });
          showToast(hadLocalEdits
            ? "Another device had newer changes; kept those. Your edits are in Undo and the repo history."
            : "Pulled board changes from GitHub.");
          // a not-yet-migrated device may push embedded images; offload them
          // here and let the debounced push send the slim board back
          if (assetsAvailable() && offloadEmbeddedImages()) saveState();
          await pullMissingAssets(branch);
        } else if (resolved === "push" || resolved === "create") {
          const overwroteRemote = remote.exists && remote.sha !== (syncConfig.lastSha || null);
          // asset files land before the board that references them, so a
          // crash between the two never strands a device on broken references
          await pushMissingAssets(branch);
          const put = await fetch(syncApiUrl(), {
            method: "PUT",
            headers: syncAuthHeaders(),
            body: JSON.stringify({
              message: `punchlist sync (${trigger}, ${deviceDisplayName(deviceIdentity.id)})`,
              content: encodeBase64Utf8(getSyncPayload()),
              branch,
              ...(remote.exists ? { sha: remote.sha } : {}),
            }),
          });
          if (!put.ok) throw new Error(`GitHub answered ${put.status} on push.`);
          const putData = await put.json();
          saveSyncConfig({ lastSha: putData.content?.sha || null, dirty: false, lastRev: state.rev, lastSyncedAt: new Date().toISOString() });
          if (overwroteRemote) showToast("Pushed this device's board over an older remote; the previous version is in the repo's commit history.");
        }
        setSyncStatus(`Synced ${formatClockTime()}`);
      } catch (error) {
        setSyncStatus(`Sync failed: ${error?.message || error}`);
        // 409 = the remote moved between our GET and PUT (another device
        // pushed). A retry re-GETs the fresh sha and re-decides, so it heals
        // itself; without this the banner sat at "Sync failed: 409" until the
        // next unrelated trigger (Evren's screenshot).
        if (String(error?.message || "").includes("409")) scheduleSyncPush();
      } finally {
        syncBusy = false;
        if (syncQueued) {
          syncQueued = false;
          scheduleSyncPush();
        }
      }
    }
    // ---- end GitHub sync ---------------------------------------------------

    // ---- asset store ---------------------------------------------------------
    // Image bytes live OUTSIDE the board (grill Q21-Q23, 2026-07-19): immutable
    // records in IndexedDB locally, one file each under assets/ in the sync
    // repo, tiny {assetId} references in board state. Full eager parity: every
    // device fetches every asset it is missing, exactly once (immutable = no
    // conflicts). "assets", not "images": videos, files, STLs ride the same
    // rails later. Where IndexedDB is unavailable (the vm test harness), images
    // stay embedded in state exactly as before — nothing is ever lost.
    const ASSET_DB_NAME = "punchlist-assets-v1";
    const ASSET_MIME_EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/svg+xml": "svg" };
    const assetCache = new Map();
    let assetDbPromise = null;

