    function normalizeEditableText(value) {
      return String(value || "").replace(/\u00a0/g, " ").split(CARET_BOUNDARY).join("");
    }

    function getEditableText(valueOrElement) {
      const value = typeof valueOrElement === "string"
        ? valueOrElement
        : valueOrElement?.textContent || "";
      return normalizeEditableText(value).trim();
    }

    function isEditableTextEmpty(valueOrElement) {
      return getEditableText(valueOrElement).length === 0;
    }

    function deleteTaskIfEmpty(id, valueOrElement) {
      if (!isEditableTextEmpty(valueOrElement)) return false;
      return deleteTaskAndSelectNeighbor(id, { forcePermanent: true });
    }

    function updateTaskTextFromEditable(id, valueOrElement) {
      const found = findTask(id);
      if (!found) return false;
      const item = resolveTaskItem(found.item);
      item.text = getMarkdownTextFromEditable(valueOrElement);
      saveStateDebounced();
      return true;
    }

    // A <strong> can still turn up in an editable, from a rich paste out of a
    // browser or a document. It used to serialize back as **text**, which now
    // that nothing renders would mean pasting bold text SILENTLY ADDS asterisks
    // to what he typed. It comes in as plain text instead.
    function serializeEditableNode(node) {
      if (node.nodeType === 3) return node.nodeValue || "";
      const tagName = node.tagName?.toLowerCase();
      if (tagName === "br") return "\n";
      if (tagName === "a") {
        const href = node.getAttribute("href") || "";
        return node.dataset?.autoLink === "true"
          ? href
          : `[${node.textContent || href}](${href})`;
      }
      return [...(node.childNodes || [])].map(serializeEditableNode).join("");
    }

    function getMarkdownTextFromEditable(valueOrElement) {
      if (typeof valueOrElement === "string" || !valueOrElement?.childNodes) {
        return getEditableText(valueOrElement);
      }
      return normalizeEditableText([...valueOrElement.childNodes].map(serializeEditableNode).join("")).trim();
    }

    // Markdown offset of a DOM point inside a task editable. A rendered link
    // hides its [label](url) markers, so DOM-range character counts diverge
    // from markdown offsets (the known caret pinch point); this walks the same
    // rules as serializeEditableNode, counting an element's opening marker on
    // the way in and its closing marker only once the point is past it.
    // Evren, 2026-07-28: "two asterisks go to the line below when I press Enter
    // with a bolded word at the end of a line". A caret at the end of a rendered
    // span sits INSIDE it in the DOM, and this walk stopped the moment it found
    // the caret, so the span's closing marker was never counted. Enter then
    // split mid-marker: "hello **bold" stayed and "**" went to the new line.
    // Styling is gone now, but LINKS render the same way and had the identical
    // bug: "see [docs](url)" split into "see [docs" and "](url)". A caret at the
    // very end of an element's content is visually AFTER it, so its closing
    // marker belongs before the caret. Splitting mid-label is still a mid-marker
    // split, and deliberately left alone: cutting a link in half is a thing you
    // had to aim for.
    function getMarkdownCaretOffset(element, container, offsetInContainer) {
      let offset = 0;
      let found = false;
      let atEndOfNode = false;
      function walk(node) {
        if (found) return;
        if (node.nodeType === 3) {
          // caret boundaries are invisible to the markdown model, so they must
          // not shift the offsets we hand back
          const text = node.nodeValue || "";
          const upto = node === container ? Math.max(0, Math.min(text.length, offsetInContainer)) : text.length;
          offset += normalizeEditableText(text.slice(0, upto)).length;
          if (node === container) {
            found = true;
            atEndOfNode = upto === text.length;
          }
          return;
        }
        const tagName = node.tagName?.toLowerCase();
        if (tagName === "br") {
          offset += 1;
          return;
        }
        const wrap = tagName === "a" && node.dataset?.autoLink !== "true"
          ? ["[", `](${node.getAttribute("href") || ""})`]
          : ["", ""];
        offset += wrap[0].length;
        const kids = [...(node.childNodes || [])];
        const limit = node === container ? Math.max(0, Math.min(offsetInContainer, kids.length)) : kids.length;
        for (let index = 0; index < limit && !found; index += 1) walk(kids[index]);
        if (node === container) {
          found = true;
          atEndOfNode = limit === kids.length;
        }
        if (!found || atEndOfNode) {
          offset += wrap[1].length;
          // Only an element that actually CONTRIBUTED a closing marker may spend
          // the at-the-visual-end signal. Resetting unconditionally meant any
          // marker-less element in between swallowed it, and every ancestor
          // above silently skipped its own closing marker. <a> is still the only
          // wrap-bearing element: round two's marks put their markers in the DOM
          // as ordinary text rather than hiding them in a wrap, so ***both***
          // nests an <em> in a <strong> with nothing for this walk to skip. That
          // is why it can nest at all. The guard stays because it is what makes
          // the statement true rather than a coincidence.
          if (wrap[1]) atEndOfNode = false;
        }
      }
      walk(element);
      return offset;
    }

    // Toggle an inline style marker over [start, end) of markdown `text`.
    // Pure. Collapsed selections expand to the word under the caret (marker
    // chars excluded, so a caret inside **bold** grabs just "bold"). Returns
    // null when there is nothing to toggle, else { text, start, end, caret }
    // with markdown offsets; caret sits just past the toggled span.
    function toggleMarkdownStyle(text, start, end, marker) {
      const src = String(text || "");
      const len = marker.length;
      const ch = marker[0];
      let from = Math.max(0, Math.min(src.length, Number(start) || 0));
      let to = Math.max(from, Math.min(src.length, Number(end) || 0));
      if (from === to) {
        const isWordChar = (value) => Boolean(value) && !/[\s*~]/.test(value);
        while (isWordChar(src[from - 1])) from -= 1;
        while (isWordChar(src[to])) to += 1;
        if (from === to) return null;
      }
      while (from < to && /\s/.test(src[from])) from += 1;
      while (to > from && /\s/.test(src[to - 1])) to -= 1;
      if (from === to) return null;
      // marker-char runs hugging the selection decide presence: for * a run
      // is italic only when its count is odd (** is bold, *** is both); for
      // ** and ~~ any run of 2+ carries the style.
      let before = 0;
      while (src[from - before - 1] === ch) before += 1;
      let after = 0;
      while (src[to + after] === ch) after += 1;
      const wrapped = len === 2 ? before >= 2 && after >= 2 : before % 2 === 1 && after % 2 === 1;
      if (wrapped) {
        const next = src.slice(0, from - len) + src.slice(from, to) + src.slice(to + len);
        return { text: next, start: from - len, end: to - len, caret: to - len };
      }
      const sel = src.slice(from, to);
      const inner = sel.slice(len, -len);
      if (sel.length >= len * 2 + 1 && sel.startsWith(marker) && sel.endsWith(marker) && !inner.includes(marker)) {
        return { text: src.slice(0, from) + inner + src.slice(to), start: from, end: to - len * 2, caret: to - len * 2 };
      }
      // Wrapping a selection that ALREADY carries this style somewhere inside
      // just nests the markers: bolding all of "hello **test** world" produced
      // "**hello **test** world**", which renders literal stars (Evren,
      // 2026-07-26: "bolding things a second time makes things even bolder").
      // Take this style off the runs inside first, so bolding a part-bold
      // selection makes all of it bold. Runs are shared — *** is bold AND
      // italic — so lift only this marker's chars and leave the rest standing.
      const body = sel.replace(new RegExp(`\\${ch}+`, "g"), (run) => (len === 2
        ? (run.length >= 2 ? ch.repeat(run.length - 2) : run)
        : (run.length % 2 === 1 ? ch.repeat(run.length - 1) : run)));
      return {
        text: src.slice(0, from) + marker + body + marker + src.slice(to),
        start: from + len,
        end: from + len + body.length,
        caret: from + len * 2 + body.length,
      };
    }

    // Length of `markdown` as it reads in the DOM. Round two puts style markers
    // in as real text, so this only ever compensates for a link hiding its
    // [label](url) — which is exactly the one thing that still hides characters.
    function renderedTextLength(markdown) {
      const probe = document.createElement?.("div");
      if (!probe) return String(markdown || "").length;
      probe.innerHTML = renderInlineMarkdown(markdown);
      return (probe.textContent || "").length;
    }

    // Ctrl+B / Ctrl+I / Ctrl+Shift+S inside a task editable (board row or
    // focus overlay): toggle the marker on the markdown model, re-render just
    // this editable, and drop the caret after the toggled span.
    function toggleEditableStyle(editable, marker) {
      const selection = window.getSelection?.();
      if (!selection || !selection.rangeCount || !selectionContainsEditableContents(editable)) return false;
      const id = editable.dataset.taskText || editable.dataset.focusTaskText;
      const found = id ? findTask(id) : null;
      if (!found) return false;
      const range = selection.getRangeAt(0);
      // untrimmed serialization so the DOM-derived offsets line up
      const source = normalizeEditableText([...editable.childNodes].map(serializeEditableNode).join(""));
      const start = getMarkdownCaretOffset(editable, range.startContainer, range.startOffset);
      const end = getMarkdownCaretOffset(editable, range.endContainer, range.endOffset);
      const toggled = toggleMarkdownStyle(source, Math.min(start, end), Math.max(start, end), marker);
      if (!toggled) return false;
      pushUndoState("board", "Formatted task text");
      const lead = toggled.text.length - toggled.text.replace(/^\s+/, "").length;
      const item = resolveTaskItem(found.item);
      item.text = toggled.text.trim();
      saveStateDebounced();
      if (editable.dataset.focusTaskText) boardStaleBehindFocus = true;
      editable.innerHTML = renderInlineMarkdown(item.text);
      placeCaretAtTextOffset(editable, renderedTextLength(item.text.slice(0, Math.max(0, toggled.caret - lead))));
      return true;
    }

    // A rich paste (out of a browser, a document, a chat) arrives as HTML.
    // Dropping it to plain text was the right answer while nothing rendered:
    // turning a pasted <strong> into **text** would have written asterisks into
    // his task that he never typed. Round two renders those markers, so the
    // same conversion is now the right answer instead, and it was the first
    // thing he sent back: "if I paste in markdown. links disappear, formatting
    // disappears etc... should paste in without loosing formatting and the line
    // breaks etc."
    //
    // It happens at PASTE time and lands as plain text, rather than by teaching
    // the serializer to read foreign markup. That keeps the editable holding
    // nothing but text and our own render, which is the invariant the caret
    // walk depends on: no foreign element ever sits between the caret and a
    // marker. Pure, so it is tested without a DOM.
    const PASTE_MARKERS = { strong: "**", b: "**", em: "*", i: "*", del: "~~", s: "~~", strike: "~~", code: "`" };
    // A paragraph gets a blank line after it and a div gets one newline, which
    // is the difference between the two in the source he pasted: editors use a
    // div per line, documents use a p per paragraph.
    const PASTE_BLOCKS = {
      div: "\n", tr: "\n", li: "\n",
      p: "\n\n", blockquote: "\n\n", pre: "\n\n", section: "\n\n", article: "\n\n", figure: "\n\n",
      h1: "\n\n", h2: "\n\n", h3: "\n\n", h4: "\n\n", h5: "\n\n", h6: "\n\n",
    };

    function markdownFromNodes(nodes) {
      return [...(nodes || [])].map((node) => {
        if (node.nodeType === 3) return (node.nodeValue || "").replace(/\s+/g, " ");
        const tag = node.tagName?.toLowerCase();
        if (tag === "br") return "\n";
        if (tag === "script" || tag === "style") return "";
        if (tag === "a") {
          const href = node.getAttribute?.("href") || "";
          const label = markdownFromNodes(node.childNodes).trim();
          if (!/^https?:\/\//i.test(href)) return label;
          return label && label !== href ? `[${label}](${href})` : href;
        }
        const inner = markdownFromNodes(node.childNodes);
        // Our own markup pasted back in already carries its markers as text in
        // md-mark siblings. Wrapping it again would give ****bold****.
        if (/\bmd-f\b/.test(node.getAttribute?.("class") || "")) return inner;
        const marker = PASTE_MARKERS[tag];
        if (marker) {
          // markers hug the words: " bold " wrapped as "** bold **" would fail
          // his own spaces-outside rule and render as literal asterisks
          const [, lead, body, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
          return body ? lead + marker + body + marker + tail : inner;
        }
        if (tag === "li") return inner.trim() ? `- ${inner.trim()}\n` : "";
        const block = PASTE_BLOCKS[tag];
        if (block) return inner.trim() ? inner.trim() + block : "";
        return inner;
      }).join("");
    }

    // The whitespace BETWEEN two blocks is a text node of its own, so source
    // indentation arrives as a space sitting on the front of every line. A
    // space either side of a line break never means anything, here or in HTML.
    function tidyPastedMarkdown(text) {
      return String(text || "").replace(/[^\S\n]*\n[^\S\n]*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    function markdownFromPastedHtml(html) {
      if (!html || typeof DOMParser === "undefined") return "";
      const doc = new DOMParser().parseFromString(String(html), "text/html");
      return tidyPastedMarkdown(markdownFromNodes(doc.body?.childNodes));
    }

    // Shared by the board rows and the focus overlay: both are task text, and
    // pasting into one behaved differently from the other only by accident.
    function pasteRichTextIntoEditable(event, editable) {
      const markdown = markdownFromPastedHtml(event.clipboardData?.getData("text/html"));
      if (!markdown) return false;
      event.preventDefault();
      pushUndoState("board", "Pasted formatted text");
      insertTextAtSelection(markdown, editable);
      return true;
    }

    function applyUrlPasteToText(text, start, end, url) {
      const source = String(text || "");
      const safeStart = Math.max(0, Math.min(source.length, Number(start) || 0));
      const safeEnd = Math.max(safeStart, Math.min(source.length, Number(end) || 0));
      if (!/^https?:\/\/\S+$/i.test(url) || safeStart === safeEnd) return source;
      const label = source.slice(safeStart, safeEnd);
      return `${source.slice(0, safeStart)}[${label}](${url})${source.slice(safeEnd)}`;
    }

    // Evren's pick (2026-07-17, via card): Backspace at the very start of a
    // task's text merges it into the item above, like outliners. The merged
    // item's children follow it: into the parent at the same spot, or adopted
    // by the previous item.
    function mergeTaskIntoPrevious(id) {
      const found = findTask(id);
      if (!found || found.item.linkType) return false;
      const visible = getVisibleNodes();
      const index = visible.findIndex((node) => node.kind === "task" && node.id === id);
      if (index <= 0) return false;
      const prev = visible[index - 1];
      const prevId = prev.kind === "task" ? prev.id : prev.kind === "image" ? prev.taskId : null;
      if (!prevId) return false;
      const prevFound = findTask(prevId);
      if (!prevFound || prevFound.item.linkType) return false;
      const target = resolveTaskItem(prevFound.item);
      const item = resolveTaskItem(found.item);
      pushUndoState("board", `Merged "${shortText(item.text)}" into "${shortText(target.text)}"`);
      target.text = (target.text || "") + (item.text || "");
      found.list.splice(found.index, 1);
      const children = item.children || [];
      if (children.length) {
        if (prevFound.item === found.parent) found.list.splice(found.index, 0, ...children);
        else target.children = [...(target.children || []), ...children];
      }
      setSingleSelection({ kind: "task", id: target.id });
      saveState();
      // merged text fans out through any linked placement of either item
      if (taskIsLinkFree(prevFound.item) && !getLinkCount(item.id)) renderScoped(found.parent?.id ?? null, found.group.id, [prevFound.item.id, found.item.id]);
      else renderLinkedPlacements([prevFound.item, found.item], found.parent?.id ?? null, found.group.id);
      return true;
    }

    function handleEditingBackspaceDelete(event) {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return false;
      if (isEditableTextEmpty(textEl)) {
        event.preventDefault();
        deleteTaskAndSelectNeighbor(textEl.dataset.taskText, { forcePermanent: true });
        return true;
      }
      if (event.key === "Backspace" && window.getSelection?.()?.isCollapsed && getCaretOffset(textEl) === 0) {
        const id = textEl.dataset.taskText;
        event.preventDefault();
        const targetId = (() => {
          const visible = getVisibleNodes();
          const index = visible.findIndex((node) => node.kind === "task" && node.id === id);
          const prev = index > 0 ? visible[index - 1] : null;
          return prev?.kind === "task" ? prev.id : prev?.kind === "image" ? prev.taskId : null;
        })();
        const caretBase = targetId ? (document.querySelector(`[data-task-text="${targetId}"]`)?.textContent || "").length : 0;
        if (!mergeTaskIntoPrevious(id)) return true;
        const targetEl = document.querySelector(`[data-task-text="${targetId}"]`);
        if (targetEl) placeCaretAtTextOffset(targetEl, caretBase);
        return true;
      }
      return false;
    }



    function placeCaretAtTextOffset(element, offset) {
      element.focus();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let remaining = Math.max(0, offset);
      let node;
      while ((node = walker.nextNode())) {
        if (remaining <= node.textContent.length) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        remaining -= node.textContent.length;
      }
      focusEditableText(element, false);
    }

    function getEditableForNode(node) {
      if (!node) return null;
      const selector = node.kind === "group"
        ? `[data-group-title="${node.id}"]`
        : `[data-task-text="${node.id}"]`;
      return document.querySelector(selector);
    }

    function insertTextAtSelection(text, element) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        element.textContent += text;
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function selectionContainsEditableContents(element, range = null) {
      const selectedRange = range || (() => {
        const selection = window.getSelection();
        return selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      })();
      if (!selectedRange) return false;
      const container = selectedRange.commonAncestorContainer;
      return container === element || Boolean(element.contains && element.contains(container));
    }

    function replaceEditableContents(element, text) {
      element.textContent = text;
      if (typeof element.focus === "function") focusEditableText(element);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function startEditingSelectedNode(initialText = "") {
      const nodes = getVisibleNodes();
      const node = selectedNode || nodes[0];
      if (!node) return false;
      setSingleSelection(node);
      renderSelection();
      const editable = getEditableForNode(node);
      if (!editable) return false;
      focusEditableText(editable);
      if (initialText) insertTextAtSelection(initialText, editable);
      return true;
    }

    function insertEditingLineBreak(event) {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const lineBreak = document.createTextNode("\n");
      range.insertNode(lineBreak);
      let hasContentAfter = false;
      for (let node = lineBreak.nextSibling; node; node = node.nextSibling) {
        if ((node.textContent || "").length || node.tagName === "BR") {
          hasContentAfter = true;
          break;
        }
      }
      if (!hasContentAfter) {
        lineBreak.parentNode.insertBefore(document.createElement("br"), lineBreak.nextSibling);
      }
      range.setStartAfter(lineBreak);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      event.target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function getTaskSplitPlan(text, offset) {
      const source = String(text || "");
      const caret = Math.max(0, Math.min(source.length, Number(offset) || 0));
      // Enter at the start of a NON-empty item pushes a fresh empty line ABOVE,
      // at the same depth, and drops his caret into it — he wants to write
      // before an item (Evren 2026-07-19 PM, reversing the 2026-07-19 AM call).
      // A fully empty line is the one exception: Enter there creates BELOW.
      if (caret === 0 && source !== "") return { beforeText: source, afterText: "", position: "before" };
      return {
        beforeText: source.slice(0, caret),
        afterText: source.slice(caret),
        position: "after",
      };
    }

    function getCaretOffset(element) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return getMarkdownTextFromEditable(element).length;
      const range = selection.getRangeAt(0);
      if (!selectionContainsEditableContents(element, range)) return getMarkdownTextFromEditable(element).length;
      // markdown offset, not rendered-text offset: callers feed this into
      // splits over item.text, and the fallbacks above already return
      // markdown lengths (the old rendered-domain count drifted past links)
      return getMarkdownCaretOffset(element, range.endContainer, range.endOffset);
    }

    function caretOnBoundaryLine(editable, direction) {
      const selection = window.getSelection?.();
      if (!selection || !selection.rangeCount) return true;
      const caret = selection.getRangeAt(0);
      // ranges from the text edges to the caret; their edge rects give the
      // caret's visual line without touching the live selection
      const pre = document.createRange();
      pre.selectNodeContents(editable);
      const post = pre.cloneRange();
      try {
        pre.setEnd(caret.startContainer, caret.startOffset);
        post.setStart(caret.endContainer, caret.endOffset);
      } catch {
        return true;
      }
      if (direction < 0 && pre.toString().length === 0) return true;
      if (direction > 0 && post.toString().length === 0) return true;
      const box = editable.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(editable).lineHeight) || 20;
      if (direction < 0) {
        const rects = pre.getClientRects();
        const caretLineTop = rects.length ? rects[rects.length - 1].top : box.top;
        return caretLineTop - box.top < lineHeight * 0.6;
      }
      const rects = post.getClientRects();
      const caretLineBottom = rects.length ? rects[0].bottom : box.bottom;
      return box.bottom - caretLineBottom < lineHeight * 0.6;
    }

    function splitTaskAtOffset(id, offset) {
      const found = findTask(id);
      if (!found) return null;
      const plan = getTaskSplitPlan(found.item.text, offset);
      pushUndoState("split");

      // Evren's spec (2026-07-17): Enter at the END of an EXPANDED parent's
      // text creates the new item as its first child; collapsed parents and
      // childless items get a sibling below. Mid-text splits stay siblings.
      const resolvedSplit = resolveTaskItem(found.item) || found.item;
      const before = plan.position === "before";
      const intoChildren = !before && plan.afterText === ""
        && !resolvedSplit.collapsed && (resolvedSplit.children || []).length > 0;
      const newItem = task(before ? "" : plan.afterText, [], {
        createdInGroupId: found.group?.id || found.item.createdInGroupId,
        createdUnderTaskId: intoChildren ? resolvedSplit.id : (found.parent?.id || null),
      });
      if (intoChildren) {
        resolvedSplit.children.unshift(newItem);
      } else if (before) {
        // new empty sibling ABOVE; his original text is untouched
        found.list.splice(found.index, 0, newItem);
      } else {
        found.item.text = plan.beforeText;
        found.list.splice(found.index + 1, 0, newItem);
      }

      setSingleSelection({ kind: "task", id: newItem.id });
      saveState();
      // the rewritten text of the split task shows in every linked placement
      if (taskIsLinkFree(found.item)) renderScoped(intoChildren ? found.item.id : (found.parent?.id ?? null), found.group.id, [found.item.id, newItem.id]);
      else renderLinkedPlacements(found.item, intoChildren ? found.item.id : (found.parent?.id ?? null), found.group.id);
      focusTaskText(newItem.id, false);
      return { item: newItem, position: plan.position };
    }

    function splitEditingTask(event) {
      const textEl = event.target.closest("[data-task-text]");
      if (!textEl) return false;
      const id = textEl.dataset.taskText;
      const found = findTask(id);
      if (!found) return false;
      found.item.text = getMarkdownTextFromEditable(textEl);
      splitTaskAtOffset(id, getCaretOffset(textEl));
      return true;
    }

