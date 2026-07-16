# Directions: what to refine next

Written 2026-07-16, right after v1.3.0 shipped. Evren declared the funnel done-for-now (grill Q9) and asked the next question himself: what direction gets refined next? His own report: "a lot of small UI/UX issues, especially for touch and mobile devices." This file ranks the candidate directions, holds the to-do lists for each, and ends with a ponytail audit of the codebase and the skills that fit the recommended work.

## The recommendation

**Direction A: mobile and touch refinement, driven by Evren's own issue list.** Three reasons, each checkable:

1. The success metric is "Punchlist is Evren's daily driver" (grill Q1), and the #1 gap has been phone capture since Q2. Small touch frictions are exactly what kills a daily habit on a phone.
2. He already has the backlog in his head. A direction where the work items come from the user's lived friction beats one where the agent invents them.
3. The infrastructure phase just ended. Funnel: done-for-now (Q5, Q9). Sync: shipped (Q8). Identity: shipped (Q10 to Q12). Nothing structural blocks polish work anymore.

Direction B (live with the phone loop) runs concurrently for free: using the board on the phone every day is both the test bed for A and the data source for it.

## Direction A: mobile and touch refinement (recommended)

The work splits into collect, audit, fix.

- [ ] **Collect Evren's list.** He dictates the small UI/UX issues as a voice batch; the agent triages each into: bug, friction, or preference. Transcription noise is expected; anything ambiguous gets confirmed before it becomes a work item, per the standing rule in `CLAUDE.md`.
- [ ] **Run a structured mobile audit before fixing.** One pass through every control, panel, and flow at 390x844 (and one narrower width, 360x780) in both themes, using the `design-review` skill's phase list plus real-device checks on Evren's actual iPhone. Output: a findings list in this file, ranked by daily-use frequency.
- [ ] **Fix in small batches.** Each batch: regression test, full suite, rebuild, real-browser check at phone width (the repo rules already require this). Touch behavior gets tested with DevTools touch emulation AND at least once on the physical phone per batch, because long-press, scroll interference, and keyboard-overlap bugs do not reproduce reliably in emulation.
- [ ] Known rough edges from `AGENT_HANDOFF.md` that belong to this direction: task action buttons only appear on the selected row on phones (deliberate, revisit), long-press drag vs. page scroll tension, group top-edge drop targeting.

Done-condition, same shape as the funnel's: done when Evren stops hitting friction daily, and he judges that.

## Direction B: live with the phone loop (runs alongside A)

Shipped machinery, zero usage data so far.

- [ ] Set up the phone: open the hosted board, Add to Home Screen, enter the sync repo + token, set Device name to "phone".
- [ ] Capture on the phone for a week as the default inbox; note every friction point into the board itself (they feed Direction A).
- [ ] Check the sync commit list once during the week: device names should show which device pushed what (v1.3.0).

## Direction C: research backlog (parked until A produces a lull)

The task-management workflow research task defined in `ROADMAP.md` stays queued. It informs later releases; it does not block polish work.

## Direction D: sharing and collaboration (stays parked)

Q12's signing work laid the identity groundwork, and that is where it stops. Per the standing decision recorded in `ROADMAP.md`: no sharing features without a fresh go-ahead from Evren.

## Ponytail audit (2026-07-16)

Requested alongside this file: a whole-repo over-engineering scan. Method: every function declaration checked for references (241 total), every CSS class checked against markup and code (132 total), every test-API entry checked against the suite, dependency count checked against package files (there are none). Findings, biggest cut first:

- `delete:` `tests/task-board.browser.smoke.mjs`, 75 lines. It skips unless a Playwright runtime is installed, and none ever has been on this machine, so it has never executed. Real-browser acceptance already happens every session through the Chrome DevTools MCP. Replacement: nothing. Keep only if a CI runner with Playwright is ever added.
- `yagni:` about 25 of 152 test-API entries are referenced by no test (examples: `splitTaskAtOffset`, `armTouchDrag`, `renderFocusTimer`, `importVerdictToast`). Caveat before pruning: this API is also the browser-driving surface for MCP verification sessions, which used several "untested" entries this very session. Prune only entries unused by both tests and the documented browser workflows. Replacement: nothing, roughly 25 lines.
- `delete:` `getTaskItem()` in `src/task-board.js`, 4 lines, zero callers. Replacement: nothing.
- `stdlib:` `hasOwn(object, key)` helper, 3 lines with 5 call sites. Replacement: `Object.hasOwn()`, ES2022, in every browser this app already requires.

net: about -107 lines, -0 deps possible.

Reading of the result: the codebase is lean. Zero dependencies, a 30-line build script, no dead CSS, one dead function out of 241, no single-implementation abstractions found. The audit found housekeeping, not disease. The four items above are worth folding into the first Direction A fix batch and not worth a dedicated pass.

## Skills that fit Direction A

Installed and matched to this work, in the order they'd be used:

| Skill | What it's for here |
|---|---|
| `design-review` | The audit pass: 7 phases including WCAG 2.1 AA and responsive testing. Run once at the start of Direction A to produce the findings list. |
| `mobile-first-design` | Layout-level fixes: responsive patterns starting from the phone width up, progressive enhancement for the desktop. |
| `interaction-design` | Behavior-level fixes: touch interactions, feedback patterns, microinteractions, loading and error states. The long-press-drag versus scroll tension lives here. |
| `mattpocock-skills:prototype` | Throwaway prototypes when an interaction has two plausible designs and arguing is slower than building both. |
| `ponytail` | Already governs all code here per `CLAUDE.md`; keeps each fix the minimal one. |
| `verify` / `run` | Driving the real app after each batch instead of trusting tests alone. |

Considered and set aside: `web-performance-audit` and `web-performance-optimization`. The app is one 267 KB file with zero network requests; there is no bundle to split and no waterfall to fix. Revisit only if board render time on the phone becomes a reported friction.
