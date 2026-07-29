    function loadDeviceIdentity() {
      try {
        const parsed = JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY) || "null");
        if (parsed && typeof parsed.id === "string" && parsed.id) {
          return { id: parsed.id, name: typeof parsed.name === "string" ? parsed.name : "" };
        }
      } catch {}
      const created = { id: createId("device"), name: "" };
      if (!IS_DEMO) localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(created));
      return created;
    }

    function saveDeviceIdentity(patch) {
      Object.assign(deviceIdentity, patch);
      if (!IS_DEMO) localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(deviceIdentity));
    }

    function deviceDisplayName(id) {
      if (!id) return "";
      const name = String((id === deviceIdentity.id ? deviceIdentity.name : state.devices?.[id]?.name) || "").trim();
      return name || `device ${id.slice(-4)}`;
    }

    // Each device records itself in the synced roster so the others can
    // resolve its name in history entries and the sync overview.
    function touchDeviceRoster() {
      if (IS_DEMO) return;
      if (!state.devices || typeof state.devices !== "object" || Array.isArray(state.devices)) state.devices = {};
      state.devices[deviceIdentity.id] = { name: deviceIdentity.name, lastSeenAt: new Date().toISOString() };
    }

    function renderDeviceRoster() {
      return Object.entries(state.devices || {})
        .sort(([, a], [, b]) => String(b?.lastSeenAt || "").localeCompare(String(a?.lastSeenAt || "")))
        .map(([id, info]) => {
          const seen = describeRelativeDateTime(info?.lastSeenAt);
          const isSelf = id === deviceIdentity.id;
          const name = deviceDisplayName(id);
          // This device is not removable: it would re-add itself on the next
          // save, so the button would look broken rather than principled.
          const drop = isSelf ? "" : `<button class="icon-button device-forget" type="button" data-forget-device="${escapeHtml(id)}" title="Forget ${escapeHtml(name)}. It rejoins by itself if that device syncs again." aria-label="Forget ${escapeHtml(name)}">×</button>`;
          return `<p class="sync-status device-row">${escapeHtml(name)}${isSelf ? " (this device)" : ""}${seen ? escapeHtml(` · ${seen}`) : ""}${drop}</p>`;
        })
        .join("");
    }

    // Evren, 2026-07-28: "would it be possible to easily make it possible to
    // remove some devices?" The roster is a synced map, so forgetting one is a
    // board edit like any other and travels to his other devices. Honest about
    // what it is NOT: a device still holding the token rejoins the moment it
    // syncs, because the roster is a record of who showed up, not a permission
    // list. Revoking access is a GitHub token job, and the guide says so.
    function forgetDevice(id) {
      if (!id || !state.devices?.[id] || id === deviceIdentity.id) return false;
      pushUndoState("board", `Forgot device "${deviceDisplayName(id)}"`);
      delete state.devices[id];
      saveState();
      syncSettingsControls();
      return true;
    }

