# Pre-production gate

This is the short, repeatable way to test Punchlist before production.

## 1. Run the local gate

From the repository root:

```bash
npm ci                    # first run only, or after package-lock changes
npm run preflight
```

The command:

1. Builds the app.
2. Runs the complete static and Chromium browser suite.
3. Checks that generated app copies and version metadata agree.
4. Prints a copyable candidate/version report.
5. Never pushes, deploys, opens a PR, or reads credentials.

For a machine-readable report:

```bash
npm run --silent preflight -- --json > /tmp/punchlist-preflight.json
```

A `PRE-FLIGHT PASS` means the **local** gate passed. It does not mean production is ready yet.

## 2. Do the two manual gates

### Preview and rollback

Serve the exact `website/` directory locally or on a disposable preview URL. A local preview is enough to check the rendered pages; a disposable hosted URL is better because it also checks routing, caching, headers, and the real origin.

Local fallback:

```bash
python3 -m http.server 4173 --directory website
```

Open and check:

- `/`
- `/task-board.html`
- `/notes.html`
- `/latest.json`
- desktop and 390px-wide rendering
- console errors and failed requests
- shared-origin warning behavior on a project-like path

Before replacing a preview artifact, keep the previous known-good app. Switch old → candidate → old without clearing browser storage. The board must remain readable and editable in both versions. If rollback is not predictable, stop.

Do not enter a real sync token or use the real private board in a disposable preview.

### Physical phone

Use the preview URL and a disposable board on the real phone. Check only the high-value flows:

- edit and complete a task;
- swipe-indent a task;
- long-press and reorder a task;
- scroll without arming a gesture;
- open and close the drawer;
- edit with the keyboard open;
- reload and reopen offline;
- tap near the chevron/checkbox seam without the wrong control firing.

The painted mobile controls are intentionally 30px with a 44px effective hit area. Do not enlarge them unless a real seam test reproduces an overlap defect.

## 3. Production remains a separate decision

The agent must report:

```text
Local preflight: PASS/FAIL
Preview: PASS/FAIL/not run
Rollback: PASS/FAIL/not run
Physical phone: PASS/FAIL/not run
Production authorization: waiting/explicitly granted
```

Future agents must stop and ask you before any push, deployment, release creation, or other outward-facing action. A green local preflight is not permission to publish.

After you explicitly authorize production:

1. record the candidate commit and previous rollback artifact;
2. push/deploy once;
3. open the landing page, app, notes, and `latest.json`;
4. verify the served version;
5. create one disposable task, reload it, complete it, and clean it up;
6. if anything fails, use the rehearsed rollback instead of debugging on production.

## Stop-ship rules

Stop if any of these occur:

- local tests fail or browser coverage is skipped;
- generated copies or versions disagree;
- a hostile fixture executes or breaks an attribute;
- a token appears in an export or generated artifact;
- offline/file use loses data;
- preview does not serve the exact candidate;
- rollback has not been rehearsed;
- the physical phone loses data or has a critical gesture/keyboard failure;
- production authorization is missing.

This gate deliberately leaves preview hosting, physical-device testing, and deployment authorization visible. They cannot be honestly automated from the repository alone.
