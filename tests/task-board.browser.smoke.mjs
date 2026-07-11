import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// Optional real-browser smoke workflow. It runs when a Playwright runtime is
// installed (for example via `npm i -D playwright && npx playwright install
// chromium`) and skips cleanly otherwise, keeping the repository free of
// required dependencies.

const root = path.resolve(import.meta.dirname, "..");
const boardUrl = pathToFileURL(path.join(root, "outputs", "task-board.html")).href;

let chromium = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  chromium = null;
}

const skip = chromium ? false : "Playwright runtime is not installed";

test("browser smoke: board renders, edits, themes, and plans in a real page", { skip }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(boardUrl);
    await page.waitForSelector(".group-header");
    assert.ok(await page.locator(".group").count() >= 5, "seed groups render");

    // Outline editing: a new group appears and accepts a title.
    await page.click('[data-action="add-group"]');
    await page.waitForSelector(".group:last-of-type .group-title");

    // Theme: dark mode applies group tint tokens.
    await page.click("[data-settings-menu] summary");
    await page.click("[data-dark-mode]");
    assert.equal(await page.getAttribute("body", "data-theme"), "dark");

    // Planning: enable the timeline flag and switch views.
    await page.evaluate(() => {
      window.taskBoardTestApi.updateSettings({ timelineView: true, metadata: true });
      const api = window.taskBoardTestApi;
      const group = api.state.groups[0];
      api.setTaskSchedule(group.tasks[0].id, {
        date: api.localDateString(),
        startTime: "09:00",
        plannedMinutes: 30,
      });
    });
    await page.click("[data-view-timeline]");
    await page.waitForSelector("[data-timeline-block]");

    // Phone layout: the sidebar becomes a drawer behind the toggle.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click("[data-sidebar-toggle]");
    assert.ok(await page.evaluate(() => document.body.classList.contains("sidebar-open")));
    await page.click("[data-sidebar-backdrop]");

    // Persistence: a reload keeps the board non-blank.
    await page.reload();
    await page.waitForSelector(".group-header");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, "no horizontal overflow on the phone viewport");
    assert.deepEqual(pageErrors, [], "no uncaught page errors");
  } finally {
    await browser.close();
  }
});
