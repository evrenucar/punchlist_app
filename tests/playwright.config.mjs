import { defineConfig } from "@playwright/test";

// testMatch is deliberately narrow. tests/ also holds task-board.static.test.mjs,
// which is a node:test file; without this filter Playwright picks it up as one
// of its own, imports it, and reports a confusing failure that has nothing to
// do with the app.
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.browser.test.mjs",
  reporter: [["list"]],
  // Real browser, real layout. The point of this suite is everything the
  // vm+mock-DOM suite structurally cannot see: contenteditable carets,
  // <details> disclosure, media queries, transforms, pointer interception.
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
  },
});
