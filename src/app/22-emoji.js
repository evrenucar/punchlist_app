    // A query matches when any word in the entry STARTS with it, so ":fi"
    // finds fire and finish but not "specific". Prefix beats mid-word here
    // because he is typing forwards; substring matching made ":ch" return
    // things whose only claim was the middle of a word.
    function searchEmoji(query, limit = 8) {
      const q = String(query || "").toLowerCase();
      if (!q) return EMOJI_LIST.slice(0, limit);
      const hits = [];
      for (const entry of EMOJI_LIST) {
        const words = entry[1].split(" ");
        if (words.some((word) => word.startsWith(q))) hits.push(entry);
        if (hits.length >= limit) break;
      }
      return hits;
    }

    // The trigger: a colon that STARTS a word, then letters. Anchored to the
    // caret. "10:30" and "note: something" never match, because the colon in
    // both has a non-space before it or a space after it.
    const EMOJI_TRIGGER = /(?:^|\s)(:([a-z0-9_+-]*))$/i;

    function emojiTriggerAt(textBeforeCaret) {
      const match = EMOJI_TRIGGER.exec(String(textBeforeCaret || ""));
      return match ? { token: match[1], query: match[2] } : null;
    }

    const emojiMenuEl = document.querySelector("[data-emoji-menu]");
    let emojiState = null; // { editable, token, matches, index }
    // Escape has to mean something, and what it means here is "I am typing a
    // real word that happens to start with a colon". So it stays shut while he
    // keeps typing that word, and only forgets once the token stops growing
    // from the one he dismissed.
    let emojiDismissed = null;

    function closeEmojiMenu() {
      emojiState = null;
      if (emojiMenuEl) emojiMenuEl.hidden = true;
    }

    function paintEmojiMenu() {
      if (!emojiMenuEl || !emojiState) return;
      emojiMenuEl.replaceChildren();
      emojiState.matches.forEach(([glyph, words], index) => {
        const row = document.createElement("button");
        row.type = "button";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", index === emojiState.index ? "true" : "false");
        const g = document.createElement("span");
        g.className = "glyph";
        g.textContent = glyph;
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = words.split(" ")[0];
        row.append(g, name);
        // mousedown, not click: click lands after the editable has already lost
        // the caret, and the caret is what we are inserting at.
        row.addEventListener("mousedown", (event) => {
          event.preventDefault();
          insertEmoji(glyph);
        });
        emojiMenuEl.appendChild(row);
      });
      const selected = emojiMenuEl.children[emojiState.index];
      selected?.scrollIntoView?.({ block: "nearest" });
    }

    function placeEmojiMenu() {
      if (!emojiMenuEl) return;
      const selection = window.getSelection?.();
      let rect = null;
      if (selection && selection.rangeCount) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
        // a collapsed range in an empty text node reports all zeroes
        if (!rect.width && !rect.height) rect = emojiState?.editable?.getBoundingClientRect?.() || rect;
      }
      if (!rect) return;
      const width = 264;
      const height = Math.min(232, emojiMenuEl.scrollHeight || 232);
      const room = window.innerHeight - rect.bottom;
      const top = room < height + 12 ? Math.max(8, rect.top - height - 6) : rect.bottom + 6;
      emojiMenuEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
      emojiMenuEl.style.top = `${top}px`;
    }

    function openEmojiMenu(editable) {
      if (!emojiMenuEl || !editable) return;
      const text = getMarkdownTextFromEditable(editable);
      const caret = getCaretOffset(editable);
      const trigger = emojiTriggerAt(text.slice(0, caret));
      if (!trigger) {
        emojiDismissed = null;
        return closeEmojiMenu();
      }
      if (emojiDismissed && trigger.token.startsWith(emojiDismissed)) return closeEmojiMenu();
      emojiDismissed = null;
      const matches = searchEmoji(trigger.query);
      if (!matches.length) return closeEmojiMenu();
      emojiState = { editable, token: trigger.token, matches, index: 0 };
      emojiMenuEl.hidden = false;
      paintEmojiMenu();
      placeEmojiMenu();
    }

    // Replaces the typed ":word" with the glyph in the DOM, at the caret,
    // rather than rewriting the whole task and re-rendering it. Re-rendering
    // would move his caret, which is the one thing an inline picker must never
    // do. The input event afterwards is what saves it, through the same path
    // as any other typing.
    function insertEmoji(glyph) {
      if (!emojiState) return false;
      const { editable, token } = emojiState;
      const selection = window.getSelection?.();
      if (!selection || !selection.rangeCount) return false;
      const range = selection.getRangeAt(0);
      const node = range.endContainer;
      if (node.nodeType !== 3 || range.endOffset < token.length) {
        closeEmojiMenu();
        return false;
      }
      const before = node.nodeValue.slice(0, range.endOffset - token.length);
      const after = node.nodeValue.slice(range.endOffset);
      node.nodeValue = `${before}${glyph}${after}`;
      const next = document.createRange();
      next.setStart(node, before.length + glyph.length);
      next.collapse(true);
      selection.removeAllRanges();
      selection.addRange(next);
      closeEmojiMenu();
      editable.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    // Capture, so the menu answers the arrows and Enter before the board does.
    // Without it Enter would split the task under the open menu.
    document.addEventListener("keydown", (event) => {
      if (!emojiState) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        emojiDismissed = emojiState.token;
        closeEmojiMenu();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === "ArrowDown" ? 1 : -1;
        emojiState.index = (emojiState.index + step + emojiState.matches.length) % emojiState.matches.length;
        paintEmojiMenu();
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        insertEmoji(emojiState.matches[emojiState.index][0]);
      }
    }, true);

    document.addEventListener("selectionchange", () => {
      if (!emojiState) return;
      // the caret left the field the menu belongs to
      if (!emojiState.editable.contains(window.getSelection?.()?.anchorNode || null)) closeEmojiMenu();
    });

    // Every editable that holds text he might want an emoji in: task rows,
    // group titles, image captions, and their focus-mode twins.
    const EMOJI_FIELDS = "[data-task-text], [data-focus-task-text], [data-group-title], [data-focus-group-title], [data-image-caption]";

    document.addEventListener("input", (event) => {
      const editable = event.target?.closest?.(EMOJI_FIELDS);
      if (editable) openEmojiMenu(editable);
      else closeEmojiMenu();
    });

    const FEEDBACK_EMAIL = "evrenucar1999@gmail.com";
    const BUG_ISSUE_BASE = "https://github.com/evrenucar/punchlist_app/issues/new";

