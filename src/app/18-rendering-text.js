    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    // Inline formatting, round two. Round one was pulled on 2026-07-28 ("get
    // rid of all formatting inside text", too many bugs), grilled on the 29th,
    // and this is built to his answers.
    //
    // THE WHOLE DESIGN IS ONE DECISION: the markers stay REAL TEXT in the DOM,
    // inside a span that CSS hides. Round one's bug class was a caret sitting
    // inside a rendered span, invisible characters either side of it, and every
    // offset drifting from the text model. Here nothing is ever hidden FROM the
    // model: the serializer reads a marker span back as the characters it
    // holds, the caret walk counts them like any other text, and showing them
    // is a CSS rule rather than a re-render. <a> remains the only element in a
    // task that hides characters, exactly as it was before formatting existed.
    //
    // His mode E, the default, then costs nothing: the row he is editing shows
    // its markers, so what he sees IS the stored text, and Enter beside a bold
    // word splits where he can see it splitting.
    //
    // LINKS ARE NOT FORMATTING: they render in every mode. They are how you
    // leave the app, and he said so directly ("links stay rendered").
    function renderInlineMarkdown(value) {
      const source = String(value || "");
      // His literals rule: "the test is spaces OUTSIDE the asterisks, not
      // inside", so 2*3*4 and some_file_name.txt stay literal while a whole
      // sentence still bolds. Brackets and quotes count as outside too, and a
      // closing marker may be followed by punctuation, otherwise **bold**. at
      // the end of a sentence would not render. Off (a settings toggle) is the
      // v1.5.24 behaviour: stars anywhere, underscores still intraword-guarded.
      const guarded = state?.settings?.markdownWholeWords !== false;
      const open = guarded ? `(?<![^\\s([{"'])` : "";
      const close = guarded ? `(?![^\\s.,;:!?)\\]}"'])` : "";
      // Code first: its content is literal, markers and links included.
      // Links before the style marks, since a URL may hold * or ~.
      const pattern = new RegExp([
        `${open}\`([^\`\\n]+)\`${close}`,
        `\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)`,
        `(https?:\\/\\/[^\\s<]+)`,
        `${open}\\*\\*\\*(?!\\s)(.+?)(?<!\\s)\\*\\*\\*(?!\\*)${close}`,
        `${open}\\*\\*(?!\\s)(.+?)(?<!\\s)\\*\\*(?!\\*)${close}`,
        `${open}\\*(?!\\s)(.+?)(?<!\\s)\\*(?!\\*)${close}`,
        `${open}~~(?!\\s)(.+?)(?<!\\s)~~(?!~)${close}`,
        `${open}(?<![\\w_])___(?!\\s)(.+?)(?<!\\s)___(?![\\w_])${close}`,
        `${open}(?<![\\w_])__(?!\\s)(.+?)(?<!\\s)__(?![\\w_])${close}`,
        `${open}(?<![\\w_])_(?!\\s)(.+?)(?<!\\s)_(?![\\w_])${close}`,
      ].join("|"), "gi");
      const mark = (chars) => `<span class="md-mark">${chars}</span>`;
      const styled = (chars, openTag, closeTag, inner) =>
        mark(chars) + openTag + renderInlineMarkdown(inner) + closeTag + mark(chars);
      // every plain run breaks its newlines, not just the tail: with styles
      // rendering there is far more text sitting BETWEEN matches than there was
      // when links were the only match, and a line break in there used to vanish
      const plain = (text) => escapeHtml(text).replace(/\n/g, "<br>");
      let html = "";
      let cursor = 0;
      let match;
      while ((match = pattern.exec(source))) {
        html += plain(source.slice(cursor, match.index));
        const [, code, label, href, bare, bothStar, boldStar, italicStar, strike, bothUnder, boldUnder, italicUnder] = match;
        const both = bothStar || bothUnder;
        const bold = boldStar || boldUnder;
        const italic = italicStar || italicUnder;
        if (code) {
          html += mark("`") + `<code class="md-f md-c">${escapeHtml(code)}</code>` + mark("`");
        } else if (both) {
          html += styled(bothStar ? "***" : "___", '<strong class="md-f"><em class="md-f">', "</em></strong>", both);
        } else if (bold) {
          html += styled(boldStar ? "**" : "__", '<strong class="md-f">', "</strong>", bold);
        } else if (italic) {
          html += styled(italicStar ? "*" : "_", '<em class="md-f">', "</em>", italic);
        } else if (strike) {
          html += styled("~~", '<del class="md-f">', "</del>", strike);
        } else {
          const text = label || bare;
          const url = href || bare;
          const autoLink = bare ? ' data-auto-link="true"' : "";
          html += `<a class="task-link" data-task-link href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Opens in a new tab"${autoLink}>${escapeHtml(text)}</a>`;
        }
        cursor = pattern.lastIndex;
      }
      return html + plain(source.slice(cursor));
    }

    // Focus mode never rendered a task's photos (Evren: photos don't show).
    // Reuse the board's asset resolution; a pending asset just renders nothing
    // here rather than a resize placeholder, since focus is read-only.
    function renderFocusImages(item, cls) {
      const imgs = item?.images || [];
      if (!imgs.length || item.linkType) return "";
      return imgs.map((img) => {
        const src = getAssetSrc(img);
        return src
          ? `<img class="${cls}" src="${src}" alt="${escapeHtml(img.caption || "Image")}" draggable="false" decoding="sync">`
          : "";
      }).join("");
    }

    function renderFocusChildren(tasks, depth = 0, group = null) {
      const visible = (tasks || []).filter((item) => !(group && isTaskHiddenFromActive(item, group)));
      if (!visible.length) return "";
      const items = visible.map((item) => {
        const resolved = resolveTaskItem(item);
        const done = Boolean(resolved?.done);
        // chevron + collapse mirror the main board: base it on VISIBLE children
        // (the same skip rules), respect item.collapsed (so focus inherits the
        // board's fold state), and only recurse when expanded.
        const kids = item.linkType === "reference" ? [] : (item.children || []);
        const visibleKids = kids.filter((k) => !(group && isTaskHiddenFromActive(k, group)));
        const hasKids = visibleKids.length > 0;
        const expanded = hasKids && !item.collapsed;
        const id = resolved?.id || item.id;
        return `
        <li style="margin-left: ${depth * 18}px" class="${done ? "focus-child-done" : ""}">
          <button class="focus-child-chevron ${hasKids ? "" : "hidden"}" type="button" data-focus-chevron="${item.id}" aria-label="${expanded ? "Collapse" : "Expand"}" aria-expanded="${expanded ? "true" : "false"}" title="${expanded ? "Collapse" : "Expand"} (Ctrl+${expanded ? "Up" : "Down"})">${renderIcon("chevron")}</button>
          <button class="focus-child-check ${done ? "done" : ""}" type="button" data-focus-toggle="${id}" aria-label="${done ? "Mark not done" : "Mark done"}">${done ? renderIcon("check") : ""}</button>
          <span class="focus-child-text" contenteditable="true" spellcheck="true" data-focus-task-text="${id}">${renderInlineMarkdown(resolved?.text || item.text)}</span>
          ${renderFocusImages(resolved || item, "focus-child-image")}
          ${expanded ? renderFocusChildren(item.children || [], depth + 1, group) : ""}
        </li>
      `;
      }).join("");
      return `<ul class="focus-outline">${items}</ul>`;
    }

