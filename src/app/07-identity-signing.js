    function signingAvailable() {
      return !IS_DEMO && typeof crypto !== "undefined" && Boolean(crypto.subtle);
    }

    function ensureSigningIdentity() {
      if (!signingIdentityPromise) signingIdentityPromise = createSigningIdentity();
      return signingIdentityPromise;
    }

    async function createSigningIdentity() {
      if (!signingAvailable() || state.identity) return state.identity || null;
      const pair = await crypto.subtle.generateKey(SIGNING_KEY_PARAMS, true, ["sign", "verify"]);
      const [privateKeyJwk, publicKeyJwk] = await Promise.all([
        crypto.subtle.exportKey("jwk", pair.privateKey),
        crypto.subtle.exportKey("jwk", pair.publicKey),
      ]);
      const fingerprint = await publicKeyFingerprint(publicKeyJwk);
      if (state.identity) return state.identity; // a sync pull won the race; keep the shared key
      state.identity = { privateKeyJwk, publicKeyJwk, fingerprint, createdAt: new Date().toISOString() };
      // Persist without marking the board dirty: the key rides along with the
      // next natural push instead of racing the first pull on a new device.
      saveStateToLocalStorage();
      syncSettingsControls();
      return state.identity;
    }

    async function publicKeyFingerprint(publicKeyJwk) {
      const key = await crypto.subtle.importKey("jwk", publicKeyJwk, SIGNING_KEY_PARAMS, true, ["verify"]);
      const spki = await crypto.subtle.exportKey("spki", key);
      const digest = await crypto.subtle.digest("SHA-256", spki);
      return [...new Uint8Array(digest).slice(0, 4)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    async function signText(text) {
      await ensureSigningIdentity();
      if (!state.identity || !signingAvailable()) return null;
      const key = await crypto.subtle.importKey("jwk", state.identity.privateKeyJwk, SIGNING_KEY_PARAMS, false, ["sign"]);
      const signature = await crypto.subtle.sign(SIGNING_ALGORITHM, key, new TextEncoder().encode(text));
      return bytesToBase64(new Uint8Array(signature));
    }

    async function verifySignedText(publicKeyJwk, signatureBase64, text) {
      try {
        const key = await crypto.subtle.importKey("jwk", publicKeyJwk, SIGNING_KEY_PARAMS, false, ["verify"]);
        return await crypto.subtle.verify(SIGNING_ALGORITHM, key, base64ToBytes(signatureBase64), new TextEncoder().encode(text));
      } catch {
        return false;
      }
    }

    // Pure decision core, mirror of syncDecision: signature facts in, verdict out.
    function importTrustVerdict({ signed, valid, fingerprint, ownFingerprint, knownContact }) {
      if (!signed) return "unsigned";
      if (!valid) return "invalid";
      if (ownFingerprint && fingerprint === ownFingerprint) return "self";
      return knownContact ? "known" : "first-contact";
    }

    async function describeImportSender(payload) {
      const sender = payload?.sender;
      const signed = Boolean(sender?.publicKeyJwk && payload?.signature);
      if (!signed || typeof crypto === "undefined" || !crypto.subtle) {
        return { verdict: "unsigned", name: String(sender?.name || ""), fingerprint: null };
      }
      let fingerprint = null;
      let valid = false;
      try {
        // The fingerprint is recomputed from the embedded key; the sender's
        // claimed fingerprint is display-only and never trusted.
        fingerprint = await publicKeyFingerprint(sender.publicKeyJwk);
        valid = await verifySignedText(sender.publicKeyJwk, payload.signature, JSON.stringify(payload.state));
      } catch {}
      return {
        verdict: importTrustVerdict({
          signed: true,
          valid,
          fingerprint,
          ownFingerprint: state.identity?.fingerprint || null,
          knownContact: Boolean(fingerprint && state.contacts?.[fingerprint]),
        }),
        name: String(sender?.name || ""),
        fingerprint,
      };
    }
    // ---- end signing identity ------------------------------------------------

    const HISTORY_LABELS = {
      board: "Changed the board",
      delete: "Deleted items",
      complete: "Toggled a task",
      move: "Moved items",
      split: "Edited the outline",
      restore: "Restored items",
      link: "Pasted linked items",
      color: "Changed a group color",
      paste: "Pasted tasks",
      collapse: "",
    };

