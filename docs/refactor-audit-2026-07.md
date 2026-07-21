# Refactor audit, 2026-07-21

Answers the braindump question "Do we need to refactor? Do we need to improve codebase structure?" through the ponytail lens: laziest correct structure, deletion over addition, no speculative abstraction. Read-only pass; nothing was changed. The prior audit is the 2026-07-16 section of `docs/DIRECTIONS.md`; this one re-checks its findings and covers everything shipped since (scoped rendering, touch gestures, GitHub sync, asset store, signing, update check, focus folding, the dev-interface graph).

Method, same as last time but scripted: every named function in `src/task-board.js` checked for callers (299 names), every CSS class in `src/task-board.css` checked against the JS and HTML (148 classes), every `taskBoardTestApi` entry checked against the test suite and the docs (179 unique entries), plus a targeted read of the regions the question named: gestures, sync, render paths, settings, import/export, and `status/index.html`.

## Verdict

**No refactor. The single closure is still the right structure, and the sweep found zero dead functions and zero dead CSS. What remains is housekeeping worth about an hour, one drift risk in `status/index.html`, and one decision only Evren can make (which graph view survives).**

The 2026-07-16 audit called the codebase lean. Five feature waves later that is still true, and the reason is visible in the code: each new subsystem (sync at lines 613 to 872, assets at 874 to 1099, signing at 1101 to 1197 of `src/task-board.js`) shipped as a fenced region with a small pure core and heavy bug-history comments, not as a new layer.

## 1. Is the single closure still serving the project?

Yes. The file is 6,563 lines, but line count was never the test; the test is whether change is risky or slow anywhere specific. Region by region:

**Gesture layer (`src/task-board.js` ~4541 to 5031).** The one place with real coupling. Three touch gesture candidates (`touchDrag`, `touchSwipe`, `touchSelect`) each own their own `pointerdown`/`pointermove`/`pointerup` listeners on `boardEl`, and they arbitrate by pairwise mutual exclusion: `armTouchSelect` calls `clearTouchDrag()` and nulls `touchSwipe` (4965 to 4966), the swipe move handler checks `touchDrag?.armed` (4900), `clearTouchSelect` has to avoid stalling the drag's auto-scroll frame (4957). Adding a fourth gesture means touching all three. That is a real cost, but it is a cost nobody is about to pay: the deferred roadmap items (sharing, encryption, text formatting) add zero gestures. The arbitration rules also encode five shipped bug fixes in comments (keyboard hand-back at 4875, drift threshold at 4996, scroll-steal prevention at 5025). Rewriting this into a gesture arbiter would launder that history into an abstraction and re-open every one of those bugs. Leave it. If a fourth gesture is ever ordered, extract a claim/cancel helper then, in that commit.

**Sync (613 to 872).** The best-shaped region in the file. `syncDecision` (663) is a four-line pure function; `syncNow` (783) is the one orchestrator; busy/queued/dirty/lastSha state is five variables. Change here is neither risky nor slow.

**Render paths (4173 to 4300).** Layered, not split: `render()` is the always-correct full rebuild, `renderGroupInPlace` (4225) and `renderTaskSubtreeInPlace` (4248) are measured fast paths (75 ms and 150 ms full-render costs are cited in their own comments), and every fast path falls back to the layer above when it cannot prove safety at runtime (search active, board hidden, link fan-out via `taskIsLinkFree` at 4273). Callers must still pick the right scope, which is caller discipline, but the failure mode of getting it wrong is a redundant full render, not corruption; the 1-second lifecycle diff (4237) even catches stale scoping.

**Settings (5196 to 5330).** Adding a setting touches five places: `DEFAULT_SETTINGS`, the HTML control, the element binding, one line in `syncSettingsControls`, one listener line. Mechanical, one line each, scales linearly. Not a pain point.

The one cheap structural improvement the file would repay: only three of its regions have the `---- name ----` fence banners (sync, assets, signing). The gesture layer, render paths, focus mode, settings, and the test API do not. In a 6.5k-line file those banners are the navigation; six more comment lines would cover the rest.

## 2. Dead code sweep

**Result: nothing.** 0 of 299 named functions have zero callers. 0 of 148 CSS classes are unreferenced in the JS/HTML. Zero dependencies, still.

Status of the 2026-07-16 findings:

| Finding (2026-07-16) | Status now |
|---|---|
| `getTaskItem()`, 4 lines, zero callers | **Pruned.** No occurrence in the repo. |
| `tests/task-board.browser.smoke.mjs`, 75 never-run lines | **Pruned.** `tests/` holds only `task-board.static.test.mjs`. |
| `hasOwn` helper, hand-rolled | **Fixed differently.** It now wraps `Object.hasOwn` and adds a null guard (`src/task-board.js:1539`), which its 10 call sites like `hasOwn(item?.policyOverrides, key)` (1696) actually need, since `Object.hasOwn(undefined, k)` throws. Keep. Finding closed. |
| ~25 test-API entries unused by tests | **Not pruned, and grown.** Now 29 of 179 unique entries are unreferenced by the suite; 6 of those appear in docs as browser-driving or contract surface (`renderScoped`, `renderTaskSubtreeInPlace`, `saveStateDebounced`, `saveStateToLocalStorage`, `signText`, `embedImagesInExport`), leaving 23 untested and undocumented: `getMarkdownTextFromEditable`, `armTouchDrag`, `finishTouchDrag`, `pasteExternalMarkdown`, `setPolicyOverride`, `syncSettingsControls`, `storeAsset`, `assetFileName`, `verifySignedText`, `publicKeyFingerprint`, `importVerdictToast`, `checkDueReminders`, `localDateString`, `purgeTrashRecord`, `runLifecycleMaintenance`, `toggleGroup`, `ensureResearchTask`, `DEFAULT_SETTINGS`, `moveSelectedNode`, `discardUndoState`, `getBoardExportPayload`, `renderFocusTimer`, `focusSelectedTextField`. Recommendation unchanged from last time, stated more bluntly: do not prune. Each entry is one line, the object is the MCP browser-driving surface, and an over-prune costs a future session a missing hook. Add one comment above `window.taskBoardTestApi` (6367) naming that dual role so the next audit stops re-flagging it. |

New dead-weight findings, all small:

- `delete:` duplicate keys in the test API object. `saveSyncConfig` appears at `src/task-board.js:6401` and again at 6418; `toggleFocusMode` at 6449 and again at 6538. Last one wins silently today; the day the two references diverge, the first becomes an invisible lie. Remove the first of each pair. 2 lines.
- `delete:` `bash.exe.stackdump` at the repo root, Git Bash crash debris dated 07-18. (Matches the standing repo-hygiene note about tooling debris.)
- Candidate, gated on Evren: `status/focus-grill.html`, `status/update-overview.html`, `status/graph-options.html` plus their three routes in `status/serve.mjs` (50 to 52). They are consumed one-shot review pages, regenerable from `status/review-harness.template.html` + `status/review-specs.json` and revivable from git. Delete when he confirms the reviews are closed.

## 3. Duplication that has drifted

**The known twin: two `nodeEl` functions in `status/index.html`** (top-level at 806, inside `renderGraph` at 1432). Both build the same graph node: same class string, same author coloring, same done tick, new-dot, lane tag, and jump button, 43 lines each. The top-level one was written as a deliberate twin "to avoid refactoring the working staircase renderer mid-change" (comment at 801) and already parameterizes the three real differences through `nodeCtx` (`NODE_W`, `clampLines`, `isNew`). They have already drifted stylistically (the twin is ES5 `var`/ternary chains, the original uses optional chaining), which is exactly how behavioral drift starts. Merge cost: have `renderGraph` set `nodeCtx = { NODE_W, clampLines, isNew }` before its layout loop and delete its inner copy. About 5 lines changed, 43 deleted, one encoder to maintain. Worth doing, unless item 1 of the shortlist deletes the whole question first (see below).

**Checked and clean, no other drifted twins found:**

- Toasts: one system. `showToast`/`flashToast`/`hideToast` share one `toastEl`, and the update toast (`showUpdateToast`, 4110) explicitly reuses it rather than growing its own. The status layer has no toast code at all.
- Base64: one set of helpers (`bytesToBase64`, `base64ToBytes`, `encodeBase64Utf8`, `decodeBase64Utf8` at 640 to 658), shared by sync, signing, and assets. No `atob`/`btoa` anywhere else; the node scripts use `Buffer`.
- Quiet-write: exactly one implementation, `status/board-write.mjs` (the 8-second mtime gate at line 22). `serve.mjs` and the other status scripts do not re-roll it.
- Build: `scripts/build-task-board.mjs` writes `outputs/` and the `website/` copy from one output buffer; the version stamp exists once.

## 4. Structural risks against the next likely features

Where would sharing, encryption, or text formatting force a rewrite? Checked seam by seam:

**Text formatting is the real pinch point.** The editing machinery assumes a task's markdown source and its DOM text content agree on character offsets: `getCaretOffset` (3356) counts DOM text, `getTaskSplitPlan` (3341) splits the markdown string at that number, `placeCaretAtTextOffset` (3242) walks DOM text nodes, `applyUrlPasteToText` (3174) splices the markdown by the same offsets. Links already bend that assumption (an `[label](url)` renders as just the label), and the code handles it by keeping the interaction surface narrow: `serializeNode` (3158) knows exactly two node types, text and `<a>`. Bold/italic adds a third and fourth and multiplies every offset divergence. The right move is NOT to build an offset-mapping layer now; it is to know in advance that the first commit of a formatting feature must centralize markdown-to-DOM offset mapping into one function pair, and route the four functions above through it. Pre-building it today would be speculation against a feature with no go-ahead.

**Sharing: the seams exist, the merge does not.** Identity groundwork is done and clean: exports strip the private key, contacts, and settings in one place (`getExportState`, 475 to 492), the signature covers the exact serialized state (462), imports verify and trust-on-first-use through `describeImportSender` and the contacts book (525 to 550). What sharing would actually need is partial-board exchange, and today every entry path is whole-board replacement: `importBoardStateFromJson` (509), `applySyncedState` (679), `applyExternalState` (727) all swap `state` wholesale. Section-level sharing means merge semantics, which is a feature to design (the roadmap already names the CRDT-vs-LWW tension), not a refactor the current structure is blocking. No pre-work earns its keep here.

**Encryption: no rewrite required.** The sync payload passes through exactly one encode point (`encodeBase64Utf8(getSyncPayload())` at 846) and one decode point (829), and WebCrypto is already resident in the signing region. An encrypt/decrypt wrap at those two lines is the whole integration.

**Sync under either feature:** `syncDecision` stays a pure core regardless; multi-file or per-section sync grows `syncNow`, not the architecture.

**Export trust boundary:** already correct in the direction that matters. The one-way rule (private key and contacts never leave; foreign identity never adopted while one exists, 538 to 540) is enforced at the two chokepoints rather than scattered. Sharing builds on this; nothing needs to move first.

## 5. Ranked shortlist

Ranked by payoff per unit effort. S is under an hour, M is a session.

| # | What | Effort | Payoff |
|---|---|---|---|
| 1 | **Ask Evren which graph view survives, then delete the losers.** `status/index.html` carries four engines: `layoutForce` (1002), `layoutTree` (1168), `layoutLanes` (1287) plus the staircase `renderGraph` (1405). `docs/AGENT_INTERFACE.md` (line 30) records the F+ staircase as his pick from 2026-07-19, yet the view switcher defaults to `"force"` (line 770), so either the pick moved on (then fix the doc) or roughly 550 lines (the 800 to 1425 region: top-level `nodeEl`, `buildGraphModel`, `renderGraphLayout`, three layout functions, `setGraphView`, the switcher) are rejected design options kept alive. Biggest cut available anywhere in the repo, and it deletes the twin-`nodeEl` question with it. Gated on his call. | S (the delete) | up to −550 lines, one graph renderer |
| 2 | **If the layout views stay: merge the twin `nodeEl`s** (806 and 1432). `renderGraph` sets `nodeCtx` and uses the top-level one. | S | −43 lines, ends an active drift |
| 3 | **Delete the duplicate test-API keys** (`saveSyncConfig` 6401, `toggleFocusMode` 6449; keep the later ones). | S | −2 lines, removes a silent-shadow trap |
| 4 | **Fence the unfenced regions of `src/task-board.js`** with the same `---- name ----` banners sync/assets/signing already have: gestures, render paths, focus mode, settings, test API. | S | navigation in a 6.5k-line file; comments, not structure |
| 5 | **One comment above `taskBoardTestApi`** (6367) stating it is also the MCP browser-driving surface and is deliberately wider than the test suite. | S | stops every future audit from re-litigating the 29 "unused" entries |
| 6 | **Delete `bash.exe.stackdump`** from the repo root. | S | hygiene |
| 7 | **When Evren closes the reviews: delete the three consumed review pages** and their `serve.mjs` routes (regenerable from the harness template, revivable from git). | S | −3 files |

Items 1 and 7 wait on Evren; 2 through 6 are a single housekeeping batch, well under the bar that would justify a dedicated pass, same reading as 2026-07-16.

### Do-NOT-do list

Refactors that look tempting from the braindump question and fail the ponytail test:

- **Do not split `src/task-board.js` into modules.** The hard rule forbids it, the build inlines everything anyway, and no region above showed a pain that splitting would cure. "6,500 lines" is a description, not a problem.
- **Do not build a gesture arbiter/state machine.** Three gestures with pairwise exclusion work today, the bug history lives in comments at the exact lines it applies to, and no fourth gesture is on any roadmap.
- **Do not build a declarative settings registry.** Five one-line touch points per setting, linear forever.
- **Do not unify the render paths or add diffing.** The scoped renderers exist because of measured numbers (75 ms and 150 ms) and fall back to the safe path on their own; a generic layer would trade proven fallbacks for new failure modes.
- **Do not formalize the sync state machine.** The pure core is four lines (`syncDecision`, 663). It cannot get simpler by getting bigger.
- **Do not prune the test-API surface** beyond the two duplicate keys (see item 5 instead).
- **Do not pre-build the markdown/DOM offset mapper** for text formatting. Build it as the first commit of that feature, if the feature is ever ordered.
- **Do not add abstraction seams "for sharing/encryption readiness".** Encryption needs two lines at an existing chokepoint; sharing needs a merge design session with Evren, not scaffolding.
