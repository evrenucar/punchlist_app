    function assetsAvailable() {
      return !IS_DEMO && typeof indexedDB !== "undefined";
    }

    function openAssetDb() {
      if (!assetDbPromise) {
        assetDbPromise = new Promise((resolve) => {
          try {
            const request = indexedDB.open(ASSET_DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore("assets", { keyPath: "id" });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      }
      return assetDbPromise;
    }

    async function idbPutAsset(record) {
      const db = await openAssetDb();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction("assets", "readwrite");
          tx.objectStore("assets").put(record);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }

    async function idbGetAllAssets() {
      const db = await openAssetDb();
      if (!db) return [];
      return new Promise((resolve) => {
        try {
          const request = db.transaction("assets").objectStore("assets").getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    function storeAsset(id, src) {
      assetCache.set(id, src);
      if (assetsAvailable()) idbPutAsset({ id, src, createdAt: new Date().toISOString() });
    }

    // Resolves an image record to displayable bytes: embedded src (legacy or
    // IndexedDB-less), else the cache. null = known asset, bytes not here yet.
    function getAssetSrc(image) {
      if (!image) return null;
      if (typeof image.src === "string") return image.src;
      return assetCache.get(image.assetId) || null;
    }

    function assetMime(src) {
      const semicolon = String(src).indexOf(";");
      return semicolon > 5 ? String(src).slice(5, semicolon) : "application/octet-stream";
    }

    function assetFileName(id, src) {
      return `${id}.${ASSET_MIME_EXT[assetMime(src)] || "bin"}`;
    }

    function assetMimeFromName(name) {
      const ext = String(name).split(".").pop();
      const entry = Object.entries(ASSET_MIME_EXT).find(([, value]) => value === ext);
      return entry ? entry[0] : "application/octet-stream";
    }

    function eachStateImage(visit) {
      const visitTask = (item) => {
        (item.images || []).forEach((image) => visit(image));
        (item.children || []).forEach(visitTask);
      };
      state.groups.forEach((group) => group.tasks.forEach(visitTask));
      (state.trash || []).forEach((record) => {
        if (record?.item) visitTask(record.item);
      });
    }

    function assetIdsReferenced() {
      const ids = new Set();
      eachStateImage((image) => {
        if (typeof image.assetId === "string") ids.add(image.assetId);
      });
      return ids;
    }

    // Moves embedded data-URL images out of board state into the asset store.
    // Runs at boot and after imports; the caller gates on assetsAvailable() so
    // memory-only caches can never strand bytes across a reload.
    function offloadEmbeddedImages() {
      let moved = 0;
      eachStateImage((image) => {
        if (typeof image.src === "string" && image.src.startsWith("data:image/")) {
          const assetId = createId("asset");
          storeAsset(assetId, image.src);
          image.assetId = assetId;
          delete image.src;
          moved += 1;
        }
      });
      return moved;
    }

    // Exports must stay lossless and readable by older builds: re-embed every
    // resolvable asset as src. An asset whose bytes have not arrived yet keeps
    // its reference (sync delivers the bytes later) instead of vanishing.
    function embedImagesInExport(exportState) {
      const visitTask = (item) => {
        (item.images || []).forEach((image) => {
          if (typeof image.assetId !== "string") return;
          const src = assetCache.get(image.assetId);
          if (src) {
            image.src = src;
            delete image.assetId;
          }
        });
        (item.children || []).forEach(visitTask);
      };
      (exportState.groups || []).forEach((group) => (group.tasks || []).forEach(visitTask));
      (exportState.trash || []).forEach((record) => {
        if (record?.item) visitTask(record.item);
      });
      return exportState;
    }

    async function initAssetStore() {
      if (!assetsAvailable()) return;
      const records = await idbGetAllAssets();
      records.forEach((record) => assetCache.set(record.id, record.src));
      const moved = offloadEmbeddedImages();
      // persist WITHOUT marking sync dirty: flagging dirty here would make
      // load-sync's local-wins shove this stale-content board over a newer
      // remote. The slim board rides out with the next real edit's push.
      if (moved) {
        saveStateToLocalStorage();
        render();
      } else if (records.length) {
        render();
      }
    }

    // Push side of parity: every referenced asset the remote has never seen
    // gets its own immutable file. uploadedAssets in the sync config remembers
    // what is already up, so steady state costs zero extra API calls.
    async function pushMissingAssets(branch) {
      const uploaded = new Set(Array.isArray(syncConfig.uploadedAssets) ? syncConfig.uploadedAssets : []);
      const missing = [...assetIdsReferenced()].filter((id) => !uploaded.has(id) && assetCache.has(id));
      for (const id of missing) {
        const src = assetCache.get(id);
        const name = assetFileName(id, src);
        const comma = src.indexOf(",");
        const response = await fetch(`${syncAssetUrl(name)}`, {
          method: "PUT",
          headers: syncAuthHeaders(),
          body: JSON.stringify({
            message: `punchlist asset (${deviceDisplayName(deviceIdentity.id)})`,
            content: src.slice(comma + 1),
            branch,
          }),
        });
        // 422 = the file already exists (another device beat us to it); the
        // asset is immutable, so existing means converged
        if (!response.ok && response.status !== 422) throw new Error(`GitHub answered ${response.status} uploading an image.`);
        uploaded.add(id);
        saveSyncConfig({ uploadedAssets: [...uploaded] });
      }
    }

    // Pull side of parity: the pulled board may reference assets this device
    // has never seen; fetch each one, biggest files via the blobs API.
    async function pullMissingAssets(branch) {
      // no assetsAvailable() gate: even without IndexedDB a cache-only pull is
      // safe, the repo stays the source and bytes simply re-fetch next session
      const missing = [...assetIdsReferenced()].filter((id) => !assetCache.has(id));
      if (!missing.length) return;
      const listing = await fetch(`${syncAssetUrl("")}?ref=${branch}`, { headers: syncAuthHeaders(), cache: "no-store" });
      if (!listing.ok) return; // no assets folder yet; references resolve on a later pull
      const entries = await listing.json();
      const byId = new Map((Array.isArray(entries) ? entries : []).map((entry) => [String(entry.name).replace(/\.[^.]+$/, ""), entry]));
      const uploaded = new Set(Array.isArray(syncConfig.uploadedAssets) ? syncConfig.uploadedAssets : []);
      let fetched = 0;
      for (const id of missing) {
        const entry = byId.get(id);
        if (!entry) continue;
        let content = null;
        if (Number(entry.size) <= 900000) {
          const file = await fetch(`${syncAssetUrl(entry.name)}?ref=${branch}`, { headers: syncAuthHeaders(), cache: "no-store" });
          if (file.ok) content = (await file.json()).content;
        }
        if (!content) {
          const blob = await fetch(syncBlobUrl(entry.sha), { headers: syncAuthHeaders(), cache: "no-store" });
          if (!blob.ok) continue;
          content = (await blob.json()).content;
        }
        if (!content) continue;
        storeAsset(id, `data:${assetMimeFromName(entry.name)};base64,${String(content).replace(/\s+/g, "")}`);
        uploaded.add(id);
        fetched += 1;
      }
      saveSyncConfig({ uploadedAssets: [...uploaded] });
      if (fetched) render();
    }
    // ---- end asset store -----------------------------------------------------

    // ---- signing identity ----------------------------------------------------
    // One ECDSA keypair per user, not per device: it lives in board state, so
    // the user's own devices all receive it through sync (the private repo is
    // the trusted channel) and sign exports as the same sender. Exports strip
    // the private half; recipients verify with the embedded public half and
    // recognize repeat senders by key fingerprint (trust on first use).
    // ponytail: extractable JWK in state; non-extractable IndexedDB keys are
    // the upgrade if device theft ever enters the threat model.
    const SIGNING_KEY_PARAMS = { name: "ECDSA", namedCurve: "P-256" };
    const SIGNING_ALGORITHM = { name: "ECDSA", hash: "SHA-256" };
    let signingIdentityPromise = null;

