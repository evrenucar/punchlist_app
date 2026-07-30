# Codebase orientation

## What this is

Punchlist is a local-first personal task planner. The product is a directly-openable HTML file, with no runtime dependencies or server requirement. Browser storage is canonical, JSON export is lossless, and GitHub sync is optional.

## Architecture

- `src/task-board.html` is the shell and `src/task-board.css` owns presentation.
- `src/app/01-constants.js` through `25-app.js` are concatenated in numeric order into one shared script scope.
- `scripts/build-task-board.mjs` produces `outputs/task-board.html`, refreshes `website/task-board.html`, pins `status/board.html`, and stamps the version plus byte size on the landing page.
- The test suite reads the built output. Build before running the static tests.

## Current state

The most recent commits split the former 8,151-line app into 25 ordered parts and corrected the build version anchor. The static suite contains 157 declared tests. CI now rebuilds, tests, and runs a Playwright browser suite before deploys and on pull requests.

## Constraints that matter

Keep it dependency-free and static. Do not hand-edit generated files. Preserve the localStorage key and user data. Feature flags default off. Any behavior change needs a regression test, build, full test run, and isolated desktop plus phone browser check.

## Highest-priority context

Formatting round two, paste preservation, focus-mode folding, and the source split have shipped. The major strategic risk is the hosted app sharing a GitHub Pages origin and therefore localStorage with sibling sites; the direction is a dedicated origin, ideally a custom domain. Mobile/touch polish and sync safety remain core quality work.
