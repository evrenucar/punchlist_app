# Agent Handoff

The product is branded **Punchlist** (renamed 2026-07-11; file and repo names predate the branding). User-facing copy says "linked copy" for alias placements and "shortcut" for references; the internal schema keeps `alias`/`reference`.

## Purpose

This project is a personal task organizer optimized for fast capture, nested outlining, daily selection, scheduling, and focus. It is not a team project manager, cloud service, or general knowledge database.

The user routinely dumps unstructured work, then needs to:

1. Organize it into project groups and arbitrary subtask depth.
2. Select what matters now without removing project context.
3. Schedule work by date and optionally arrange a day timeline.
4. Compare planned active effort with actual focused time.
5. Export clean Markdown to Notion, Obsidian, or another editor.

## Non-negotiable constraints

- Keep the distributable app as one directly-openable static HTML file.
- Do not add a database or required server.
- Do not add a framework or package dependency without explicit evidence that native HTML/CSS/JavaScript cannot cover the behavior.
- Persist locally and provide lossless JSON import/export.
- Preserve existing browser data through schema migration.
- Keep the default UI minimal. Disabled features must have no visible controls, panels, badges, or prompts.
- Support laptop keyboard/mouse and phone touch interaction.
- Maintain undo for destructive board actions.

## Current state

### Session delta 2026-07-21 (Opus 4.8 — READ THIS FIRST; sync data-loss found, fixed, shipped v1.5.20)

Triggered by Evren: "my main personal board went to a 2 day old backup, I lost my board data." Root-caused, fixed, shipped, documented, then a sync setup guide. Ended by his "prepare a handoff and stop."

**THE DATA LOSS (root cause, confirmed by adversarial agents).** GitHub sync's `syncDecision` resolved a divergence by the `dirty` flag alone (local-wins), with NO recency check, and the push PUTs with `sha: remote.sha` so it always lands. Device hkth, dirty from an edit ~5 days ago whose push never completed, reopened, ran boot `syncNow("load")`, saw the remote had moved, and PUSHED its 5-day-old board over the newer remote; asus + a07y then pulled it. His Settings > Sync roster screenshot (asus/a07y "today", hkth "5 days ago") matched exactly. A worse latent variant exists (`purgeExpiredTrash` ~:1883 calls `saveState()` unguarded, re-dirtying a stale device on reopen) but was NOT this incident (it would have stamped hkth "today"). Same guard fixes both.

**THE FIX (SHIPPED v1.5.20, commit 1677f59, pushed to main).** A monotonic per-board `state.rev`: bumped per real edit in `saveState` (only when `syncIsActive() && !syncApplying`), backfilled to 0 in `normalizeState`, adopted with `Math.max` on pull in `applySyncedState`, persisted as `syncConfig.lastRev`. `syncDecision` now takes `{base, localRev, remoteRev}` and decides a divergence by rev, not dirty: stale device (low rev) pulls (never clobbers); more edits push (loser kept in git); a remote that regressed below base pushes (heals old-build clobbers); an exact tie WITH local edits returns `"conflict"`. No wall clock (skew-immune). `syncNow` decodes the remote payload once, passes rev in, and on `"conflict"` uses a native `window.confirm` ONLY on a user-initiated sync (manual/edit/config/enable); background triggers defer with a status line (no dialog ambush). This is EVREN'S BLEND (his pick): most-edits-wins auto, ask only on a true tie. Regression test "sync recency guard..." plus updated decision-table/flush/409 tests; all 129 pass; verified live in an isolated browser (stale case returns "pull"). Adversarial agents caught two holes in the first draft (fail-open on a wiped device, an edit-propagation stall) and both are closed.

**CROSS-VERSION (Evren asked).** `normalizeState` mutates in place and PRESERVES unknown fields, so `rev` survives even an old build's round-trip. New devices refuse to adopt an older remote and re-push the good board, so they self-heal an old device's clobber. Full fleet safety only once every device runs v1.5.20; a one-time re-pull to seed rev everywhere is worth suggesting. An old build has no guard and can still clobber until updated.

**RECOVERY (STILL PENDING ON EVREN).** His good board is retained as the parent commit of the bad push (the contents-API PUT never rewrites history). Walkthrough shipped at `status/recovery.html` (plus a `/recovery` route in `serve.mjs`, live only after a server restart, which I could not do, see the environment note). Steps: repo, History of `punchlist-board.json`, the commit just before the bad hkth "load" push, Raw, Import JSON on his main device, it pushes back and others pull. Keep hkth updated or offline until it has pulled. He has NOT recovered yet.

**Also shipped this session:** the group-toggle mobile fix (`renderGroupCollapse`, no longer re-serializes a whole group on toggle; it was left UNCOMMITTED in the tree by the prior crashed session and rode along in 1677f59). Sync setup guide `website/sync-guide.html` for users with no GitHub account (account, private repo, fine-grained token with Contents read/write, paste; CSS-drawn mockups so zero external requests, direct links to each GitHub page), linked from README, the landing-page demo line, and a "Set up sync" hero button (commits ae54069, cc08276). Build note in `website/notes.html` (8eb6bf1). Build is v1.5.20.

**Diagnosed by a parallel workflow, NOT acted on (details kept here so they survive):**
- Mobile bugs (task-tpr-parent): (1) toggles go dead after an edit on touch: the pressed row is replaced mid-gesture, implicit pointer capture dies, no click fires; the pointerdown sweep near :5167 is gated behind `event.isPrimary` and iOS may mark the recovery tap non-primary. Fix: drop the isPrimary gate, reset `squelchTapUntil`, null the three gesture candidates after `replaceWith` when `boardPressActive`, and activate toggles on pointerup too. NEEDS his phone. (2) horizontal float on phone: likely the cumulative `.child-list` indent or a pasted img without `max-width`; use the ?probe overlay on his phone. (3) left-edge line on `.group`: the article lacks `overflow:hidden` so the header's square-cornered 6px accent bar pokes past the rounded corner; add `overflow:hidden`. QUICK, no device. (4) drag copies text instead of moving: rows are `draggable=true` + contenteditable; add `-webkit-user-drag:none` under `@media(pointer:coarse)` or preventDefault all dragstart on coarse pointers. NEEDS phone.
- Graph (status/index.html): the F+ staircase is fully built but `graphView` defaults to "force" (:807) while the docs call the staircase canonical. ONE decision from Evren. Staircase: flip :807 + reorder buttons, ~15 min. Force is canonical: port +N pill capping and the arrow-key walk into renderGraphLayout/buildGraphModel, delete the duplicated nodeEl, ~half a day, then update the docs.
- Mobile audit (app): task-image delete/resize controls are hover-only (unreachable on touch) HIGH; pinch-zoom disabled (`maximum-scale=1`, WCAG 1.4.4); chevron vs checkbox 44px hit zones overlap ~8px; toast/home-screen-hint sit in the iPhone bottom-bar zone (no safe-area insets); timeline cramped at 360px; placement-badge 24px with no hit expansion; an undefined `--ink` var in `.brand-version`/`.toast-action` hover; muted `#65716b` ~4.6:1 borderline.

**Environment gotcha:** process-kill (taskkill, node `process.kill`) is BLOCKED by the auto-mode classifier here, so I could not clear a leftover "claude" heartbeat from the prior crashed session, nor restart `serve.mjs` to pick up the `/recovery` route. Deregister beats via `POST /agents {taskId:null}` (that works). If you need a process killed or the server restarted, ask Evren to run it via the `!` prefix.

**Open queue:** recover his board (offer to walk it); the 4 remaining mobile bugs; the mobile-audit fixes; the graph decision; bigger bets (sharing / repo-less sync, easier update flow, laggy multi-tab, search, competitor research, he nearly started competitor research then chose handoff+stop). Fastest wins needing no device: the left-edge group line and the drag-copy fix.

### Session delta 2026-07-20/21 (Fable — read this first; massive session, ended by STOP at 04:10)

All pushed to main (~35 commits, v1.5.1 → v1.5.18). Shipped, verified, and closed on the board: dead-chevron fix; focus overhaul (folding, scroll, smaller header, image-column fix, sticky breadcrumb, group time total, visible Ctrl+Alt+F); sync P1 (flush-before-decision so unsaved edits survive pulls, pulls keep selection+scroll and defer mid-edit, 409 self-retries); checkbox-on-unselected fix (renderSelection skips scrollIntoView mid-press); collapse-all nowrap; the phone margin bug (grid-track blowout, probe-measured on his iPhone, ?probe overlay now in the app and the loop documented in AGENT_INTERFACE.md); in-app update check + /priorities + review pages (status/review-harness.template.html is the reusable clickable-answers harness); bug-report dialog; image-resolution UX; text formatting (Ctrl+B/I, Ctrl+Shift+S on the markdown model — also fixed caret drift past links); graph rounds 1-3 in status/ (force default with basis-cache zoom, tree/lanes/stairs toggles, bundles, dotted loose edges, dot grid, agent chips with status); chat focus-theft fix + real usage-limits chip (the statusline hook sends five_hour/seven_day rate_limits; no model-specific bucket exists — never fake one).

**THE FLASH (task-mrred11c): root-caused AND the full surgery shipped (v1.5.19, morning after STOP).** The mid-flight worktree agent died on the usage limit with nothing committed; the surgery was redone in the main loop. On main now: the getLinkCount memo (one walk per render — see linkCountCache and the wrapper pattern on render/renderGroupInPlace/renderTaskSubtreeInPlace), renderLinkedPlacements (linked edits repaint the edited scope + each placement li; complete-an-alias 650ms→31ms), renderTopLevelInPlace (depth-0 split/insert/indent/outdent reconcile named lis against [data-group-list]; Enter on a top row 146-328ms→25ms), the delete-confirm shows/cancels via one group swap, and retireHiddenRows (slide-away + the 1s lifecycle tick remove exactly the hidden rows, repaint placements whose own retention keeps them visible, full-render fallback when the selection vanishes). renderTaskSubtreeInPlaceInner now removes the li when a re-rendered task became hidden (replaceWith(null) threw). Remaining, awaiting HIS fingers: the on-glass flash verdict on his real board, and the iOS-only mechanisms (image decode blank, keyboard flicker) which desktop cannot show. Known deliberate leftovers: moveTask/Alt+visual-move and multi-select depth shifts still group-swap or full-render (drag/rare paths); search-active always full-renders.

His standing rules added this session (in AGENT_INTERFACE.md): node authoring convention (active immediately, decompose visibly, close promptly, position=priority, closing is part of shipping — rule 8), the ?probe mobile-debug loop, background tabs for testing, prioritize spawning agents with models matched to scope. Open questions awaiting him: underline in formatting (markdown has none), the multi-agent workflow grill (boarded, wants a live page). Priority map: his 52-item ranking lives in the 2026-07-21 chat (Tops all shipped except flash surgery; Soons queued: mobile batch, update-guide images/easier flow, laggy-multi-tab, sharing designs; Laters: search, browsing grill, enter-at-start REVERT — he says that call was wrong).

### Session delta 2026-07-19 afternoon (Opus — read this first; braindump #7 intaken, 4 shipped fixes, STOPPED mid-landing-page)

Evren pressed STOP while I was mid-survey of the landing-page batch (no edits made to `website/index.html` yet — safe). Everything below is committed and pushed.

**Braindump intake #7 done.** 13 items viewed (3 had images — pulled from IndexedDB `punchlist-assets-v1` via the browser, since the assets build moved image bytes out of the JSON and `status/extract-images.mjs` is now stale for asset-ref shapes). Placed into: To-do — development interface (6), product & site (3), Direction A/app (3), Notes (1). Braindump group is empty. Dedup flags raised: the mobile "toggles stall after edits" + "drag copies contents" items overlap today's shipped fixes (task-tpr-toggles, task-tpr-natdrag) and need his on-glass re-verify after reload; the Enter-at-start item reverses the AM call.

**Shipped this session (app, pushed — commits 9d8a909, e834c45):**
- **Enter-at-start reversed** (his "important for app"): caret at the start of a NON-empty item now inserts a fresh empty sibling ABOVE at the same depth and focuses it; a fully empty line is the exception and still creates below. `getTaskSplitPlan` returns `position: "before"`; `splitTaskAtOffset` splices at `found.index`. Test + real-browser verified both ways.
- **Delete-confirm readability**: `.delete-confirm` prompt text was `--danger` (red on surface, unreadable on dark); now `--text` (white on dark, dark on light). Border + Delete button keep the danger signal.

**Shipped this session (dev interface `status/index.html`, live on reload — commits 9d8a909, e834c45's sibling):**
- **Chat timestamps drop seconds** (`toLocaleTimeString([], {hour,minute})`); **seen button gained a tooltip** with the double-click shortcut.
- **Graph timestamp overlap fixed** (his screenshot): `.gwhen` was `position:absolute` top-right, colliding with the first text line; now a right-aligned in-flow block under the text. Verified 0px overlap on 11 done nodes.

**His two card answers this session (both BUILT INTO THE QUEUE, not yet coded):**
- **Mobile-behavior guide** = a LIVE LOCAL PAGE like `/codebase` + `/testplan` with a per-item comment box (NOT a claude.ai artifact — the local-only rule holds). Reuse the testplan per-item-feedback + send-to-chat pattern.
- **Blue agent checkmarks** = everywhere (board checkboxes + graph) BUT keep it in the status board, DO NOT change the app. Plan: agent completions tag the task (`completedBy:"agent"`) in `status-board.json`; the graph colors those `.gnode.done` blue; the wrapper injects per-task-ID `<style>` into the board iframe (same origin) so the app's green checkboxes render blue for agent-completed IDs only. His personal board never runs an agent, so it stays all-green automatically. NOTE: `by` field is who RAISED an item, not who completed it — don't color by `by`.

**Open queue after STOP (all on the board):** landing-page batch (version v1.2.0→v1.4.0 in ~6 spots + byte size 266,809→344,492; mobile side margins; "what the file does" card polish per his image; What's-planned rewrite; release-notes link; a real GitHub release of the HTML; repo link), README refresh, build-notes rules revamp (this session's notes entry already follows it: concise, build number, no em-dashes), blue checkmarks, mobile guide, agents-identify-by-model + launch-test-chrome-in-background (adopt as rules). Still waiting on his fingers: tap-hitbox, drag-select re-grade, flash verdict, and whether today's mobile toggle/drag fixes landed.



App (`src/`), all deployed:
- **Dead toggles CRACKED (task-tpr-toggles)**: a render replacing the pressed row mid-press kills that touch stream (implicit capture dies with the node) — no pointerup ever arrives, the 1.5s select timer arms with no finger down, and the ghost either eats the next tap's click via `squelchTapUntil` (iOS reuses pointerIds) or eats every touchmove forever (ids not reused). Reproduced BOTH flavors in-browser before fixing. Fix: every new primary touch press sweeps all three gesture candidates (`pointerdown` sweep listener before the candidate creators). The gesture test harness in the suite (`loadGestureHarness`) records boardEl listeners and drives synthetic pointer sequences with manual timers — use it for any future gesture work.
- **Native drag hijack killed (task-tpr-natdrag)**: iOS starts an OS drag on long-press of anything `draggable="true"` (the "copy-paste ghost" he described); `dragstart` born from a touch press is now suppressed (`lastPressWasTouch`), mouse keeps native HTML5 drag. Group headers move on touch now too.
- **Auto-scroll smoothed (task-tpr-scroll)**: squared ramp, fractional-carry whole-pixel steps, clamp at scroller ends (no rubber-band fighting), and gesture cleanups no longer kill the other gesture's scroll frame. Real bug found riding along: drops during still-finger auto-scroll landed on a stale target; `refreshTouchDragTarget` now re-resolves per frame.
- **ASSETS BUILD SHIPPED, v1.4.0** (grill Q21-Q23): image bytes leave board state for IndexedDB (`punchlist-assets-v1`, cache-first `assetCache` Map) + one immutable file each under `assets/` in the sync repo. References are `{id, assetId, width, caption}`; `normalizeTask` accepts both shapes forever. Push uploads missing assets BEFORE the board (crash never strands broken refs; `uploadedAssets` in sync config = zero steady-state API calls); pull fetches missing after apply (dir listing → contents API → blobs fallback). Boot `initAssetStore()` migrates embedded images WITHOUT marking sync dirty (dirty would make load-sync local-wins clobber a newer remote — trap!); the pull branch re-offloads not-yet-migrated remote boards. Exports re-embed via `embedImagesInExport` (lossless, old builds can read them); sync payloads and localStorage stay slim. No IndexedDB (vm) = everything stays embedded, suite unchanged. Orphaned IDB records (undone attaches, remigrations) are harmless and unsynced; GC = YAGNI.

Development interface (`status/`):
- **The wrapper no longer reloads its iframe on board changes**: it calls the app's new `applyExternalState` (test API; keeps selection/scroll/identity/asset cache, no history noise, reload stays as fallback). The layer-contract test now also pins `applyExternalState` + `selectNode`. Board writes are cheap now — the old "avoid wrapper reloads" caution applies only to full wrapper-page reloads.
- **Graph zoom anchored**: semantic zoom re-lays-out, so pan-scaling could never hold steady (his two reports); the node nearest the cursor now gets pinned back to its exact viewport spot after each re-render. Measured drift: 0px over 12 steps.
- **`/codebase`** serves `status/codebase.html`, a summary page for Evren — refresh it whenever the repo's shape changes (route additions need a real server restart: kill serve.mjs PID, then `ensure-server.mjs --quiet`).
- Heartbeat processes run forever (setInterval): start them `run_in_background`, kill via TaskStop, and verify with `wmic ... like '%agent-heartbeat%'` — multiple live beats flip the displayed status every 30s.

Late-afternoon additions (he answered both cards within minutes — he reads cards fast when present):
- **Agent ghosts shipped** (his pick + note): a stopped agent leaves a dimmed dashed chip, name + sign-off time, on its last node; persisted in localStorage, cleared on agent return or the next session's system chat line.
- **Answer editing shipped** (his pick): an edit button on answered cards reopens the form; corrections post as fresh `answerTo` messages (latest wins in the display, "(edited)" marker). A correction reaching you through the watcher on an OLD question = adapt to it.
- **Chat linkifier** sheds trailing sentence punctuation from URLs — a trailing period in a chat message 404'd him once. Watch message endings anyway.

**Waiting on Evren (all boarded)**: tap-hitbox on-glass verdict, flash re-check, test-plan steps 8-11 re-grade, values doc + direction grill (daytime ask). Actionable backlog is otherwise EMPTY — next agent: check chat/cards first, then `docs/DIRECTIONS.md`.

### Session delta 2026-07-18/19 (previous session — ~45 commits, ended by Evren's STOP button)

App (`src/`), all deployed to the hosted board:
- **Scoped rendering, two rounds.** `renderTaskSubtreeInPlace`/`renderScoped` swap one task `<li>` (drop zones ride inside it); `renderGroupInPlace` swaps one group article; full `render()` only for multi-group ops. Create/indent/delete went 75-150ms → 8-21ms with ZERO viewport jump. His boards are a few HUGE groups, so group-level scoping alone was still a full repaint — subtree scoping is what killed his "flash". Link-safety guards (`taskIsLinkFree`, `subtreeIsLinkFree`) force full renders when placements fan out; deletes also call `refreshLifecycleSections()`. The vm harness's null `querySelector` makes every scoped call fall back to `render()`, so the suite pins behavior, not scoping — scoping proof lives in browser measurements.
- **Typing perf**: per-keystroke full-state saves debounced (`saveStateDebounced`, flushes on focusout/beforeunload/focus-exit); 13ms → 0.2ms per key. Focus mode marks the hidden board stale (`boardStaleBehindFocus`) instead of rendering it per keystroke.
- **Sync past 1MB**: pulls fall back to the Git blobs API when the contents API returns empty content (his devices split-brained on this). Whole board must stay <100MB; real ceiling is localStorage 5-10MB — the ASSETS BUILD (below) retires both.
- **Touch batch 2 + test-plan fixes**: 1.5s hold = drag-select (28px drift tolerance), swipe indent caps at achievable levels, swipe-during-edit returns the keyboard, presses inside focused text spawn NO gestures (magnifier restored), touch text hitbox = content width (tap beside text selects; UNVERIFIED on glass — shipped under the STOP). Enter at text start creates BELOW now ("before" split position retired). Ctrl+Shift+V pastes an unlinked copy. Alt+Left/Right outdent/indent. Group-header drops land FIRST.
- Enter on group/task specs, favicon, delete confirmations etc. from 07-17 all still stand.

Development interface (`status/`):
- **Chat wake-up watcher is MANDATORY** — see "Chat wake-up" in `docs/AGENT_INTERFACE.md`; the filter must include `Braindump intake requested`. Two missed-message incidents drove this.
- **`status/board-write.mjs` is the only sanctioned board-write path** (quiet window + History entries attributed to a Claude device — his explicit spec: agent edits behave like a sharing user's).
- **F+ staircase graph** (his pick after 3 sketch rounds in `docs/graph-design-options.html`): trunk timeline + one staircase path, arrow-key walk, +N pills, blue new-dots, click selects (↗ or J jumps). Zoom-anchor instability still open.
- Chat: question cards take pick+comment/own answer, answers fold under questions, auto-seen, seen/reply buttons, drafts persist, pause(⏸/▶ toggle)/stop buttons, ctx chip with REAL numbers via `status/statusline.mjs` (statusLine hook in `.claude/settings.json`; never fake token numbers — stale shows LAST KNOWN dashed). Board toggle button for graph-only view. Test plan served at `/testplan` with per-step feedback + send-to-chat (first submission processed 2026-07-19; its results drove the touch fixes).
- `prefs.json`: `fullAuto` (do NOT stop to ask "which next" — he corrected this twice), `preferParallel` (spawn NAMED subagents, visible via one-shot POSTs to /agents — `claude-sub1` pattern).

**Open queue (top first), all tracked on the status board** (`group-inbox` actives + `group-dev-todo`):
1. **Intermittent dead toggles on touch** (task-tpr-toggles, P1): chevrons stop responding "after a while"; suspect stuck gesture-candidate state from mismatched pointerIds. Needs a pointer-fuzzing repro.
2. **Native text-drag hijacks hold-move on UNSELECTED rows** (task-tpr-natdrag) + groups don't touch-move well.
3. **Tap-hitbox change needs his on-glass verdict** (task-tpr-tapedit half-closed).
4. **Assets build** (grilled, specced Q21-Q23 in the grill memory + pinned on task-mrr4ug8y): images/videos/STLs out of board JSON → IndexedDB + `assets/` in the sync repo, FULL EAGER parity (lazy rejected), immutable files, migrate on first run. Per-file git ceiling 100MB.
5. Graph zoom anchoring; agent ghost outline; drag auto-scroll smoothing near top; multi-agent name collisions (low); codebase-summary pages for Evren (wants clickable local links in chat); values doc + direction grill (daytime ask).
6. "Flash still there" (task-mrred11c) stays open until HIS fingers confirm the subtree fix; same for drag-select re-grade (test plan steps 8-11).

### State as of 2026-07-16 (previous baseline, still accurate below)

`outputs/task-board.html` is generated from `src/` by `scripts/build-task-board.mjs` (which also refreshes `website/task-board.html`). Everything in the original scope shipped, plus several iteration rounds driven by the user's live usage:

- Outline editing with 40-step undo, mouse and long-press touch drag, caret-aware Enter, Shift+Enter line breaks (with an end-of-content `<br>` sentinel because `pre-wrap` swallows a trailing newline), Ctrl+Enter completes, Alt+A adds a group, Ctrl+Shift+Down/Up expands/collapses all. Alt+arrows move a task one VISUAL slot (into expanded subtrees, out of them, and across group boundaries — `moveTaskVisually`), and Tab/Shift+Tab indent or outdent an entire multi-selection in one undo step (`shiftSelectedDepth`).
- Markdown clipboard (groups copy as `## Heading` with full contents even when collapsed), linked copies (`alias`) and shortcuts (`reference`), external Markdown paste.
- Lifecycle: Completed/Trash as expandable rows (newest first) showing origin group/parent and time; `task > group > global` policy overrides whose "Use global (…)" options name the current global value; slide-away animation when completion hides a task.
- Planning (all behind flags, off by default): task details panel (also shows group info; date/reminder auto-fill with relative-date hints), day timeline docked as a right-hand pane (List and Timeline independently toggleable, one always on), reminders with toasts/notifications.
- Task images: paste attaches (canvas-compressed to max 800px WebP/JPEG), drag side-bars to resize, editable caption line under each image (typing/pasting text on a selected image goes to the caption; pasting an image anywhere in the block attaches separately), double-click opens a zoom/pan lightbox, images are arrow-selectable nodes and Delete removes one at a time.
- Focus mode: full editor (Enter on title creates a first child, Enter splits children, Tab/Shift+Tab indent, Backspace-on-empty deletes, square checkboxes toggle done); works for groups (editable title, adds tasks); hides retention-hidden tasks like the main view; shows the clock; empty-text rows render (they must — new tasks start empty).
- Shell: resizable sidebar (drag divider, 200–420px, persisted), collapsible Views/Settings/Help/History sections with rotating triangles, History panel with per-entry expansion and Restore buttons for deletions (exact via `entry.trashId`, fuzzy name-match fallback for older entries), search that expands everything non-destructively while typing, one-keyboard-zone-at-a-time navigation reaching sidebar, hamburger, topbar toggles, search, and the Completed/Trash sections.
- Settings sharing: username field + "Export settings" (`punchlist-settings-{user}-{date}.json`, kind `punchlist-settings`); the regular Import JSON button recognizes settings files and applies only settings. Board exports exclude settings; importing a board backup keeps local settings.

- Settings also holds a "Give feedback" button that copies `evrenucar1999@gmail.com` to the clipboard with a toast asking for a kind email.

- GitHub sync (v1.2.0, built for Evren's own use per the 2026-07-15 grill): Settings → Sync holds a toggle, repo (`owner/name`, pasted URLs normalized), and token field. The board syncs as one JSON file (`punchlist-board.json`) in a private repo through the GitHub contents API — pull on load/focus/visibility, debounced push 2.5 s after edits, `sha`-guarded writes. Divergence resolves local-wins with a toast; the overwritten version survives as the previous commit. Sync payloads are lossless (they ignore the export filters) and strip `settings`. Config lives in its own key `scheduling-task-management-board-v1-sync` so the token can never land in a board or settings export. Demo mode hides the section and `syncIsActive()` is hard-false there.
- Data durability: `navigator.storage.persist()` is requested on boot (non-demo). iOS Safari (not standalone, not framed) gets a one-time dismissible bottom banner explaining the 7-day storage deletion and pointing at Add to Home Screen; `apple-mobile-web-app-*` meta tags are set. Dismissal is remembered under `…-home-screen-hint`.
- Landing page (2026-07-15): hero has three CTAs — Open the board (hosted app in a new tab), Download the board, email updates — plus one line explaining hosted vs downloaded. The demo iframe auto-sizes: in demo mode the app posts `{punchlistDemoHeight}` to its parent from a ResizeObserver, and `index.html` sets the frame height (the old 640px fixed height plus `body{overflow:hidden}` was cropping the board; demo now sets `body{height:auto;overflow:visible}`). Demo theme always follows the `&dark` flag in the embed URL, never the remembered theme key. Two anti-jitter rules Evren asked for: the framed demo document forces `documentElement.style.overflow = "hidden"` (no transient scrollbar while the frame catches up) and the frame height RATCHETS — first report sizes it, later reports only grow it, so the driver's collapse/expand steps never shift the page below.
- **Build notes page** (`website/notes.html`, hosted at https://evrenucar.github.io/punchlist_app/notes.html): Evren's standing request (2026-07-15). One entry per working session, NEWEST FIRST, inserted under the `NEW ENTRIES GO DIRECTLY BELOW THIS LINE` comment. It's the communication channel: what changed, why, and how-to steps with styled visual examples (no screenshots needed; the `.mock-settings` pattern draws UI in CSS). Zero JS, zero external requests, same design tokens as `index.html`, prose follows the same voice skills. End every reply to Evren with a link to this page. **Entry rules (his revamp, 2026-07-19): every entry's `.entry-date` MUST carry the build number (`July 19, 2026 · build v1.4.0`); keep it TIGHT — a two-or-three short-paragraph delta, not a changelog dump; NO em-dashes anywhere (commas, periods, or parentheses instead), same as the chat-style rule. Lead with the one thing that matters, cut ceremony.**
- Identity and signed exports (v1.3.0, 2026-07-16, design record in `docs/IDENTITY.md`): each device keeps `{id, name}` in `…-device` localStorage (never syncs); devices upsert themselves into the synced `state.devices` roster on every save; history entries carry `deviceId` and the history detail row plus sync commit messages (`punchlist sync (edit, laptop)`) show the device name; Settings gained Device name, a read-only "Signing identity: name · fingerprint" line, and a device list under Sync. One ECDSA P-256 keypair per user lives in `state.identity` (syncs through the private repo so all of the user's devices sign identically; generated lazily on boot via `ensureSigningIdentity`); board exports strip `identity`/`contacts` and attach `sender {name, fingerprint, publicKeyJwk}` + a signature over `JSON.stringify(payload.state)`; imports verify and answer with one of five verdicts (`importTrustVerdict`: unsigned/invalid/self/known/first-contact), record senders in the synced `state.contacts` book keyed by recomputed fingerprint, and log a provenance history entry after the state swap (the pre-swap entry would vanish with the replaced history).

Verification as of 2026-07-16: 83 tests in `tests/task-board.static.test.mjs` pass; the Playwright smoke test skips (no runtime installed); browser acceptance ran through the Chrome DevTools MCP against the built file at desktop and phone widths in both themes, including a two-context signed export/import round trip (first-contact, known, tampered-refused) and the earlier mocked-GitHub run of every sync path in isolated browser contexts.

Current priority (2026-07-16): the funnel is done-for-now and the active direction is mobile/touch refinement from Evren's own friction list — the ranked directions, to-do lists, whole-repo ponytail audit, and matched skills are in `docs/DIRECTIONS.md`. Read that file before proposing new work.

One historical note: a "rename to cosmo_vid" request (branding, folder, README) was executed and then FULLY rolled back — it was meant for a different project. The name stays Punchlist; do not resurrect cosmo_vid from git history or transcripts. `CLAUDE.md` at the repo root is the entry point for new agents.

Do not encode mutable placement into task IDs; aliases/references, lifecycle history, and scheduling all rely on stable task identity.

## Hard-won working notes (read before touching code)

- **(2026-07-19 PM) Browser-verification traps that cost real time**: background tabs throttle `setInterval`, so wrapper polling tests in an unfocused tab report phantom failures — `select_page` with `bringToFront` before timing-sensitive checks. A scripted `graph-toggle` click TOGGLES: if the isolated context persisted `graph-open=1` from a previous run, your "open the graph" click CLOSES it and the graph DOM freezes stale (renderGraph early-returns on hidden). And `TaskStop` on a background heartbeat can leave the node child beating — verify with `wmic ... like '%agent-heartbeat%'` AND `GET /agents`; multiple live beats flip the displayed status every 30s.
- **(2026-07-19 PM) The vm gesture harness** (`loadGestureHarness` in the test file) records boardEl listeners and drives synthetic pointer sequences with manual timers — use it for gesture work instead of inventing per-test stubs. Fire hold timers selectively: flushing ALL pending timers runs the 1.5s select arm, which kills an armed drag (that handover is by design).
- **(2026-07-19 PM) Chat messages: never end a URL with sentence punctuation** — fixed in the linkifier now, but older wrappers and other renderers may still swallow it. A trailing period 404'd Evren.


- **(2026-07-19) Scoped rendering traps**: every scoped path must refresh `lifecycleSignature` or the 1s maintenance loop full-renders a second later and MASKS scoping bugs. Covering ancestors must be computed BEFORE mutation (lookups die after splices). The Delete key routes through `deleteSelectedNodes`, NOT `deleteTaskAndSelectNeighbor` — a fix that misses it looks done and isn't. Never trust status-board perf numbers for his personal board: his groups are 10x bigger, seed a realistic board (80 parents × 3 deep + images) and measure scroll-jump too, the JUMP was the visible "flash".
- **(2026-07-19) Touch-gesture layering**: three candidates ride every touch press (drag, swipe, select). Presses inside the FOCUSED editable must spawn none of them (`pressInsideFocusedText`) or iOS text editing breaks. Swipe lock must clear the select candidate. Finger drift during a 1.5s hold is ~15-25px — thresholds under that make gestures "collide". His board tab may hold a DRAFT in the chat input — check `chat-input.value` before ANY `location.reload()` of his tab, and never reload while he is mid-board-edit (the quiet-guard bounces are the signal).
- **(2026-07-19) The wrapper reloads its iframe on agent board-writes** — that whole-page flash is NOT fixed by app-side scoped rendering; the queued fix is applying state in place. Don't re-diagnose it as an app bug.
- **(2026-07-19) `board-write.mjs` throws on a <8s-old file** — he edits in bursts; retry loops with 10-20s waits, and NEVER let a failed board write silently swallow a chat announcement (sequence them independently).
- **(2026-07-19) Intake protocol scar**: `take()`-style splices DELETE items if you drop the reference — two of his items were briefly lost and restored from the read. Move objects, verify counts, admit slips.

- **Never write `src/` files with PowerShell 5.1 `-Encoding utf8`** — it prepends a BOM, the build inlines it mid-document, the browser drops the `:root` rule, and every font falls back to serif. Use `[System.IO.File]::WriteAllText` (BOM-free) or the Write tool. This actually happened; the fix was stripping the BOM.
- **The user's live board is in this machine's browser localStorage under the `file://` origin** (key `scheduling-task-management-board-v1`). Any browser-based testing mutates their real data: revert every test mutation (tasks, images, history entries, trash records, settings) before ending a session.
- **The vm test harness** (`loadBoardApi` in the static test file) stubs a minimal DOM: no `document.body`, no `documentElement`, `document.querySelectorAll` returns `[]`. All new element access must be null-guarded; `window.setTimeout` may be absent. Objects returned across the vm boundary fail `assert.deepEqual` (realm prototypes) — compare via `JSON.stringify`.
- **Synthetic keyboard events targeted at `document` throw** in handlers that call `event.target.matches` — they are now `?.`-guarded, but when testing, dispatch on the focused element like real events do.
- **`renderSelection(forceFocus)`**: without `true` it will not steal focus from inputs/sidebar (that guard fixed search typing being hijacked); the deliberate "return to board" keyboard flows must pass `true`.
- **Keyboard zones**: the global keydown handler early-returns for events originating in `.sidebar` and for interactive elements outside the board — that is what keeps Enter working on the hamburger and stops dual-zone selection. Don't add global key handling above those guards without checking both.
- **`getVisibleNodes()` is the single source of keyboard order** and now yields four node kinds: `group`, `task`, `image` (with `taskId`), `section` (`completed`/`trash`). Every consumer must tolerate all kinds.
- **History**: `pushUndoState(action, detail)` logs to `state.history` (capped 50, persisted). Deletion entries carry `trashId` for precise restore. The `collapse` action logs nothing on purpose. History survives undo (log first, then snapshot).
- **Images** live on tasks as `{id, src(dataURL), width, caption}`. localStorage caps around 5 MB per origin — compressed screenshots run 50–200 KB, so warn the user before they hoard. `normalizeTask` drops non-`data:image/` sources.
- **Artifact hosting**: the built file is republished (same URL) by stripping the outer `doctype/html/head/body` wrapper and calling the Artifact tool with the same scratchpad path: https://claude.ai/code/artifact/df565bd3-dabf-4e57-af42-a2eef8e3a27f — its board data is a separate localStorage origin from the local file.
- **Website** (`website/index.html`): static landing page, zero external requests by design (claims so in its footer — keep it true). Copy follows the `no-ai-slop` + `rossmann-voice` skills in `.claude/skills/` (also `ponytail`). Email capture posts to `FORM_ENDPOINT` (empty → mailto fallback). Live at https://evrenucar.github.io/punchlist_app/ via `.github/workflows/pages.yml`; pushing main deploys.
- **Sync traps**: never move sync config into `state.settings` — the separate `-sync` localStorage key is what keeps the token out of exports. Pulls must set `syncApplying` around `saveState()` or the pull re-marks the board dirty and echoes a push. The contents API GET returns empty `content` past ~1 MB (guarded with an explicit error). Chrome caches API GETs, hence `cache: "no-store"`. `syncNow` is serialized by `syncBusy`/`syncQueued`; don't add a second caller path that bypasses it.
- **Testing sync in a browser**: the Chrome DevTools MCP `new_page` accepts `isolatedContext`, which gives fresh storage — use it so file:// testing can't touch the real board. Mock `window.fetch` and drive the Settings inputs with `change` events; the 401 path is reachable with any fake token.
- **Export trust boundary**: `getExportState()` strips by exception (`{...state, settings/identity/contacts: undefined}`), so ANY new secret-bearing state field leaks into board exports until it's added there. The regression test "exports carry a signature but never the private key or contact book" is the tripwire — extend it when you add such a field. Sync payloads (`getSyncPayload`) deliberately keep `identity` and `contacts`; the private repo is the same user.
- **Signing identity races**: `createSigningIdentity()` re-checks `state.identity` after keygen (a pull may land one mid-generation; the pulled key must win) and persists via `saveStateToLocalStorage()` directly, NOT `saveState()` — marking the board dirty there would race a fresh device's first pull and push a seed board over the remote. `signText` reads `state.identity` after `ensureSigningIdentity()` instead of trusting the cached promise, because a pull can adopt a key after the promise resolved null.
- **Import provenance ordering**: the imported board's history replaces local history, so the "Imported a board…" entry is logged AFTER the state swap. The vm suite needs `crypto: globalThis.crypto` passed into `loadBoardApi` overrides for any signing test; without it `signingAvailable()` is false and exports fall back to unsigned.

## Known rough edges

- Chrome DevTools flags two benign a11y issues: interactive buttons inside `<summary>` (lifecycle/history rows; activation is preventDefault-handled) and form fields without ids.
- Enter on a selected image is a no-op by choice; the user may later want it to create a sibling task.
- History restore fallback matches by displayed name; duplicate-named trash records may restore the wrong instance (fresh deletions always link precisely by `trashId`).
- On phones, task action buttons appear only on the selected row (deliberate de-clutter).
- Group focus mode has no timer (focus time stays a per-task concept).

## Agreed behavior

### Default experience

- Single-column outline with collapsible groups and tasks.
- Day Plan behaves like another normal group.
- Sidebar is collapsible and provides navigation to views and groups.
- Focus timing remains enabled.
- Timeline, reminders, browser notifications, task metadata UI, and per-group/per-task policy overrides begin disabled.

### Optional experience

Settings can enable each capability independently. Enabling advanced policy overrides exposes group and task controls with precedence `task > group > global`.

### Linking and clipboard

- An original task remains in its project group when scheduled or linked elsewhere.
- Alias is the default linked placement: edits and completion affect the one underlying task.
- Reference is a compact link that jumps to the original.
- `Ctrl+C` writes indented Markdown to the system clipboard and remembers stable task IDs internally.
- Internal paste uses the configured default: alias, reference, duplicate, or ask.
- `Ctrl+X` followed by paste moves placements.
- External Markdown paste creates new task trees.

### Lifecycle

- Completion visibility can be forever, immediate, or any custom duration.
- Hidden completed tasks appear in a Completed view and remain restorable.
- Delete policy can be permanent, Trash forever, or Trash for a custom duration.
- Trash records whether a task was complete before deletion and preserves original placement metadata.
- JSON/Markdown export can include or exclude completed and deleted records.

### Scheduling and timing

- Tasks may have an optional date, start time, planned active minutes, reminder time, and accumulated actual focus seconds.
- List view remains the minimal outline.
- Optional Timeline shows the whole day, a current-time marker, duration-sized blocks, nested headings, drag rescheduling, and unscheduled tasks at the bottom.
- Planned-versus-actual variance is derived, not separately edited.

## Data guidance

Every task needs an immutable ID and separate metadata such as:

```json
{
  "id": "task-immutable-id",
  "text": "Task text with [portable links](https://example.com)",
  "createdAt": "2026-07-11T12:00:00.000Z",
  "createdInGroupId": "group-id",
  "createdUnderTaskId": null,
  "completedAt": null,
  "plannedMinutes": null,
  "actualSeconds": 0,
  "schedule": null,
  "reminderAt": null
}
```

Current placement and original creation context are different facts. Moving a task must not rewrite its creation metadata. Alias/reference placements need their own placement IDs while pointing at one task ID.

## Verification expectations

Before staging or committing behavior changes:

1. Run the complete Node suite.
2. Build the static output when source files exist.
3. Run `git diff --check`.
4. Exercise file-URL workflows in Playwright at desktop and phone viewports.
5. Verify both light and dark themes, keyboard navigation, touch/drag behavior, focus mode, import/export, and data migration.
6. Inspect browser console errors and screenshots.

## Deferred work

- Sync for people without a GitHub account or token (v1 sync deliberately serves Evren only; see the grill decisions and `docs/ROADMAP.md` deferred vision for the rest: sharing sections, accountless identity, encryption).
- Reliable reminders while the board is closed; this requires a PWA/server-capable mode.
- External calendar integration.
- Research task: compare Obsidian, ClickUp, Todoist, Things, Notion, and Reddit discussions to identify recurring task-management pain points and valuable workflows before expanding scope.
