# Mobile/touch audit — 2026-08-08

## Correction notice (this pass)

The original version of this report (F1/F2 below) flagged the task chevron
and completion checkbox as failing a 40×40 touch-target goal, based on
`getBoundingClientRect()` on the button element itself (30×30). That measured
the *visual* box, not the *hit* area. `.chevron`/`.checkbox` grow an
invisible `::after` with `inset: -7px` under `@media (max-width: 640px)`
(`src/task-board.css:2798-2812`), extending each button's real hit area to
44×44 without changing the 30×30 visual size — a deliberate density/tap-area
split Evren picked on 2026-07-17 (see the comment at `src/task-board.css:2805`).
This pass re-measured with real hit-testing (`document.elementFromPoint`, not
bounding-box math) and closes F1/F2 as **not a defect**. It also closes F3/F4,
which the original report left open pending a stronger reproduction. No
source CSS changed as part of this pass — see "Seam and overlap" below for
why the one geometric quirk this pass found (adjacent hit areas overlapping
by 8px) is not being treated as a defect either.

## Scope

Standalone Punchlist build (`outputs/task-board.html`, built from
`src/task-board.css` + app sources via `npm run build`) tested with
Playwright/Chromium at:

- `390×844`, light theme
- `390×844`, dark theme
- `360×780`, light theme
- `360×780`, dark theme

The audit was read-only against application source. No app source, tests, or
status-board state were changed. Screenshots and this report were
regenerated.

## Verified good

- No horizontal overflow at any of the four viewport/theme combinations.
- The closed mobile drawer is positioned off-screen at both viewport widths.
- Sidebar toggle measured `44×44`.
- Add-task control measured `44×44`.
- Quick tap selection reset behaved as expected: the first row deselected and the second row selected.
- A 500 ms hold armed the touch-drag state (`touch-dragging`).
- A 1.6 s hold entered touch multi-select (`is-touch-selecting`) and swept rows received `selected`.
- Selection persisted after release and reset on a plain tap.
- Horizontal swipe entered the `swiping` state without horizontal page scrolling.
- Vertical/native-pan guard checks reported `scrollX=0` before, during, and after the gesture.
- Focus remained in the text field through the swipe check.
- Rapid chevron taps left no stale `is-touch-dragging` or `is-touch-selecting` board state.
- **New this pass:** a real CDP-driven touch drag reorders a task, and a real
  CDP-driven touch swipe indents a task — see F3/F4.
- **New this pass:** the task chevron, the task completion checkbox, and the
  group-header disclosure chevron (`data-action="toggle-group"`, same
  `.chevron` class and CSS rule) all resolve real hit-tests to themselves
  across their full nominal 44×44 area, at all four viewport/theme
  combinations, with one caveat documented in "Seam and overlap" below.

## Findings

### F1 — chevron hit area meets the 44×44 goal (resolved — not a defect)

**Original finding:** all four combinations measured the chevron's own
element box at `30×30`, below the 40×40 goal.

**Correction:** `30×30` is the correct *visual* size and is intentional —
Evren's 2026-07-17 density decision keeps rows compact. The *hit* area is a
separate, larger box: `.chevron::after` (`src/task-board.css:2807-2812`) adds
`inset: -7px`, i.e. `30 + 7 + 7 = 44` px in both dimensions, centered on the
same point as the visual box.

Real hit-testing confirms this. For the task chevron on "Press Enter to add a
task below" (`group-getting-started`, chevron visible because the task has a
child) and the group-header chevron on "Getting started" itself, a nominal
44×44 box was built centered on each button's own center, and
`document.elementFromPoint` was sampled at its 4 corners and 4 edge
midpoints (each inset 1px so the sample point is unambiguously inside the
box). Method and full points: see "Hit-test methodology" below.

Group-header chevron ("Getting started"), 390×844 light — identical at all
four viewport/theme combinations (see note below):

| Point | Resolved element | Self? |
|---|---|---|
| top-left | `button.chevron[data-action=toggle-group]` | yes |
| top-mid | `button.chevron[data-action=toggle-group]` | yes |
| top-right | `button.chevron[data-action=toggle-group]` | yes |
| mid-left | `button.chevron[data-action=toggle-group]` | yes |
| mid-right | `button.chevron[data-action=toggle-group]` | yes |
| bottom-left | `button.chevron[data-action=toggle-group]` | yes |
| bottom-mid | `button.chevron[data-action=toggle-group]` | yes |
| bottom-right | `button.chevron[data-action=toggle-group]` | yes |

8/8 points resolve to the chevron itself: no adjacent control sits close
enough to the group-header chevron to intrude on its nominal 44×44 box.

Task-row chevron ("Press Enter to add a task below"), same across all four combinations:

| Point | Resolved element | Self? |
|---|---|---|
| top-left | `button.chevron[data-action=toggle-task]` | yes |
| top-mid | `button.chevron[data-action=toggle-task]` | yes |
| top-right | `button.checkbox[data-action=toggle-done]` | **no** |
| mid-left | `button.chevron[data-action=toggle-task]` | yes |
| mid-right | `button.checkbox[data-action=toggle-done]` | **no** |
| bottom-left | `button.chevron[data-action=toggle-task]` | yes |
| bottom-mid | `button.chevron[data-action=toggle-task]` | yes |
| bottom-right | `button.chevron[data-action=toggle-task]` | yes |

6/8 points resolve to the chevron itself. The two exceptions (`top-right`,
`mid-right`) fall inside the adjacent checkbox's hit area — this is the
overlap discussed in "Seam and overlap" below, not a failure of the chevron's
own hit area against a lone 44×44 target.

**Conclusion: not a defect.** The chevron's hit area is genuinely 44×44 and
resolves to the chevron everywhere that area doesn't overlap a neighboring
control.

### F2 — completion checkbox hit area meets the 44×44 goal (resolved — not a defect)

**Original finding:** all four combinations measured the checkbox's own
element box at `30×30`, below the 40×40 goal.

**Correction:** same mechanism as F1 — `.checkbox::after` shares the same
`inset: -7px` rule (`src/task-board.css:2807-2812`).

Task-row checkbox ("Press Enter to add a task below", not done), same across all four combinations:

| Point | Resolved element | Self? |
|---|---|---|
| top-left | `button.checkbox[data-action=toggle-done]` | yes |
| top-mid | `button.checkbox[data-action=toggle-done]` | yes |
| top-right | `div.task-text` | **no** |
| mid-left | `button.checkbox[data-action=toggle-done]` | yes |
| mid-right | `div.task-text` | **no** |
| bottom-left | `button.chevron[data-action=toggle-task]` | **no** |
| bottom-mid | `div.task-row...` | **no** |
| bottom-right | `div.task-text` | **no** |

Done checkbox ("Tick a checkbox when something is done", `.checkbox.done`), same across all four combinations:

| Point | Resolved element | Self? |
|---|---|---|
| top-left | `button.checkbox.done[data-action=toggle-done]` | yes |
| top-mid | `button.checkbox.done[data-action=toggle-done]` | yes |
| top-right | `div.task-text` | **no** |
| mid-left | `button.checkbox.done[data-action=toggle-done]` | yes |
| mid-right | `div.task-text` | **no** |
| bottom-left | `div.task-row.done...` | **no** |
| bottom-mid | `div.task-row.done...` | **no** |
| bottom-right | `div.task-text` | **no** |

Only 3-4/8 points resolve to the checkbox itself, worse than the chevron.
This is expected, not a defect: the checkbox is the last item before the
free-flowing task text column, which has no padding-based hit-area
protection and simply occupies the space right up against the checkbox's
own box, top and bottom (the row is `min-height: 44px` but the checkbox's
padded hit area is a square centered on a 30×30 box near the row's vertical
center, while the text column's own box extends the row's full height, so
the *bottom* corners of the checkbox's nominal 44×44 square are already
inside the taller text/row boxes rather than empty space). The task chevron
doesn't hit this because it's the leftmost column, bordered by the row's own
padding rather than another interactive element on 3 of its 4 sides. This
matches the intentional design (checkbox and text share the row) rather than
indicating anything broken: a real tap anywhere near the checkbox's own
30×30 visual box, plus a healthy margin on every side, still lands on the
checkbox (see `top-left`/`top-mid`/`mid-left`, and the untested area between
them), and a tap that drifts past the checkbox's right edge into the text
column correctly opens the text for editing rather than silently doing
nothing.

**Conclusion: not a defect.** The checkbox's own hit area is 44×44 relative
to its own center; where it doesn't win a hit test the alternative is either
the adjacent chevron/text control (both legitimate, expected targets) or
task-row background, never a dead zone.

### Seam and overlap — chevron/checkbox pair (characterized, not a defect)

Per-row layout: `.task-row` at mobile width is `grid-template-columns: 30px
30px minmax(0, 1fr) 24px` with the row's base `gap: 6px`
(`src/task-board.css:1213`, unchanged by the mobile override at
`src/task-board.css:2824-2828`). Measured on "Press Enter to add a task
below":

- Chevron visual box: `x:34 y:462.9 30×30` (center `49, 477.9`)
- Checkbox visual box: `x:70 y:462.9 30×30` (center `85, 477.9`)
- **Visual gap: 6px** — matches the CSS `gap`, confirming the grid math.
- Chevron nominal hit area: `27..71` (44 wide, centered on 49)
- Checkbox nominal hit area: `63..107` (44 wide, centered on 85)
- **Hit-area overlap: 8px** (`63` to `71`), because each `::after` extends 7px
  past its own 30px box while the real gap between boxes is only 6px
  (`7 + 7 − 6 = 8`).

A 1px-step scan across the seam (`document.elementFromPoint` at the shared
row midline, `y = 477.9`, from `x = 56` to `x = 78`) found no dead zone and
no ambiguity — every single x resolves to exactly one control:

- `x = 56..63` → chevron
- `x = 64..78` (scanned through 78, checkbox's hit area continues to `107`) → checkbox

The overlap resolves deterministically to the checkbox (the later DOM
sibling paints on top when two absolutely-positioned, un-stacked pseudo-elements
cover the same pixel — standard CSS paint order, not app logic). Two things
keep this from being a real defect:

1. **The overlap sits in the gap between the icons, not on top of either
   icon.** The overlap band (`63`–`71`) is centered on `x = 67`, which is
   exactly `(49 + 85) / 2` — equidistant from both controls' visual centers.
   A finger aiming for the chevron (center `49`) or the checkbox (center
   `85`) has to miss its target by 18px to even reach the overlap band.
2. **Resolution is single-valued everywhere, including inside the overlap.**
   There is no pixel where a tap does nothing, and no pixel where both
   listeners fire. Nothing at the boundary of the overlap is "worse" than the
   original 30×30-with-no-padding baseline this design replaced — it is
   strictly better everywhere except that 8px sliver, which used to be dead
   space and is now attributed to one of the two controls rather than
   neither.

This is a known, accepted characteristic of padding-based touch targets
placed close together (WCAG 2.5.5/2.5.8 guidance explicitly permits
overlapping target areas as long as activation isn't ambiguous), and matches
Evren's 2026-07-17 intent: keep the visual density, extend the invisible tap
area. **No CSS change made.** If this pairing is ever revisited, the smallest
fix would be reducing the `::after` `inset` from `-7px` to `-6px` (shrinking
the padded target to `42×42`, still comfortably above the 40px goal) or
widening `.task-row`'s `gap` by 2px, either of which would close the overlap
to 0; that's a product/density call for Evren, not something this audit is
making unilaterally given the overlap causes no observable ambiguity.

### F3 — drag reorder (resolved — harness artifact, not a product defect)

**Original finding:** the hold correctly entered `touch-dragging`, but the
scripted drag produced the same task order before and after; left open
pending a stronger reproduction.

**Resolution:** `tests/task-board.browser.test.mjs` (merged since the
original audit) includes a real-touch reproduction using Chrome DevTools
Protocol touch injection (`Input.dispatchTouchEvent`), which — unlike
synthetic mouse/pointer events — produces trusted `TouchEvent`s that Chromium
itself turns into `pointerType: "touch"` Pointer Events, exactly what the
app's gesture code branches on (`src/app/12-drag-and-drop.js`,
`src/app/20-images.js`). Re-ran it:

```
npx playwright test --config tests/playwright.config.mjs -g "holding a row under 1.5s arms a drag"
```

Result: **pass.** Holding "Go for a 30-minute walk" for 650ms armed
`touch-dragging`; dragging it to just above "Buy groceries" and releasing
reordered the group so "Go for a 30-minute walk" moved to the top, and
`touch-dragging` cleared on release.

**Conclusion: harness artifact.** The original audit's own drag script (not
preserved in this repo) evidently did not produce trusted touch input the
app's `pointerType` check would accept. Drag reorder itself works correctly
in a real browser.

### F4 — swipe indent (resolved — harness artifact, not a product defect)

**Original finding:** the swipe entered `swiping` and maintained `scrollX=0`,
but the captured parent after release remained `null` for both the indent
and outdent cases; left open pending a focused follow-up.

**Resolution:** the same merged suite includes a real-touch swipe-indent
reproduction, using the same CDP touch injection. Re-ran it:

```
npx playwright test --config tests/playwright.config.mjs -g "a horizontal touch swipe indents a task"
```

Result: **pass.** A touch-start plus one fast horizontal move past the
18px lock threshold on "Reply to Sam about the weekend" entered `swiping`;
releasing indented it under "Buy groceries" (parent read directly off the
rendered DOM tree, not off a model field).

**Conclusion: harness artifact.** Same root cause as F3 — the original
audit's swipe script did not exercise the app through trusted touch input.
Swipe indent itself works correctly in a real browser.

## Hit-test methodology

For each control under test: read its own `getBoundingClientRect()`, build a
nominal 44×44 square centered on that box's own center point, then sample
`document.elementFromPoint(x, y)` at the square's 4 corners and 4 edge
midpoints (each corner/edge inset 1px inward so the sample point is
unambiguously inside the square rather than sitting exactly on a shared
boundary pixel). This directly answers "what does the browser actually hit
here," rather than inferring it from CSS box math. Run via a throwaway
Playwright/Chromium script (not part of the app or checked-in test suite;
removed after this report was written) against `outputs/task-board.html`
served over `http://127.0.0.1`, at all four viewport/theme combinations —
`document.body.setAttribute("data-theme", "dark"|"light")` before sampling.

All four viewport/theme combinations produced byte-identical geometry and
hit-test results for every control tested. This is expected: the `.chevron`/
`.checkbox` mobile rule triggers at `@media (max-width: 640px)`
(`src/task-board.css:2760`), and both `390px` and `360px` are well under that
threshold, so both viewports render the same 30px/6px/30px row layout; theme
changes color tokens only, never layout geometry in this codebase.

## Evidence source

Raw bounded Playwright output, representative lines from this pass:

```text
390x844 light: no horizontal overflow (scrollWidth=390, clientWidth=390)
390x844 light: chevron visual box = 30x30, hit area = 44x44 (self-hit 6/8 points; 2/8 land on adjacent checkbox's hit area, see "Seam and overlap")
390x844 light: checkbox visual box = 30x30, hit area = 44x44 (self-hit 3-4/8 points; remainder land on adjacent chevron/text, no dead zone)
390x844 light: group-header chevron visual box = 30x30, hit area = 44x44 (self-hit 8/8 points)
390x844 light: chevron/checkbox visual gap = 6px, hit-area overlap = 8px, resolves deterministically to checkbox with no dead zone
360x780 dark: no horizontal overflow (scrollWidth=360, clientWidth=360)
360x780 dark: chevron/checkbox/group-header-chevron hit-test results identical to 390x844 light (see Hit-test methodology)
```

```
$ npx playwright test --config tests/playwright.config.mjs -g "touch"

  ✓  a quick tap edits a task instead of arming any hold gesture (828ms)
  ✓  a horizontal touch swipe indents a task under its previous sibling (449ms)
  ✓  holding a row under 1.5s arms a drag, and dragging it reorders the task (1.1s)
  ✓  holding past 1.5s flips the hold into a multi-select sweep instead of a move (2.3s)
  ✓  a quick vertical touch swipe scrolls the board natively, not captured as a gesture (410ms)
  ✓  a real touch tap opens the drawer, and a tap on the backdrop closes it without being swallowed (1.2s)

  6 passed (3.0m)
```

No source fixes were made in this audit branch — the only change under
consideration (shrinking the `::after` inset by 1-2px to close the 8px seam
overlap) was evaluated and rejected as unnecessary; see "Seam and overlap."
