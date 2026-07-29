// Real-browser acceptance suite for outputs/task-board.html.
//
// Why this exists, and why it is not more of task-board.static.test.mjs:
// the static suite runs the app's inline script in a Node VM against a
// hand-written mock DOM. That mock has no layout, no selection, no caret, no
// media queries, no z-index and no pointer routing. It models "is this
// visible?" as a boolean somebody set, which is how a sidebar test in that
// suite once PASSED while the sidebar was BROKEN. Everything below is chosen
// for the same reason: it is a behavior only a real engine can answer.
//
// The app is served over http on a throwaway port because Playwright refuses
// file:// origins. The app itself still makes zero external requests; nothing
// in here is bundled into the shipped HTML.
//
// This CANNOT touch Evren's live board, which is the standing trap in this
// repo. His board lives under the file:// origin in his own browser; these run
// in a throwaway Playwright profile, on http://127.0.0.1 with an OS-assigned
// port, so the origin is different every run and starts empty every time.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const APP_FILE = fileURLToPath(new URL("../outputs/task-board.html", import.meta.url));
const STORAGE_KEY = "scheduling-task-management-board-v1";

let server;
let baseURL;

test.beforeAll(async () => {
  const html = await readFile(APP_FILE);
  server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Every test gets its own browser context, so localStorage starts empty. That
// is asserted rather than assumed: the init script snapshots the board key
// BEFORE the app's script runs, so a board leaked in from another test shows
// up as a failure here instead of quietly seeding the next one.
async function openBoard(page) {
  await page.addInitScript((key) => {
    window.__storageAtLoad = window.localStorage.getItem(key);
  }, STORAGE_KEY);
  await page.goto(baseURL);
  expect(await page.evaluate(() => window.__storageAtLoad), "localStorage leaked in from another test").toBeNull();
  await expect(page.locator('[data-group-card="group-getting-started"]')).toBeVisible();
}

function taskText(page, id) {
  return page.locator(`[data-task-text="${id}"]`);
}

async function taskIdByText(page, needle) {
  return page.evaluate((text) => {
    const el = [...document.querySelectorAll("[data-task-text]")].find((node) => node.textContent.trim() === text);
    return el ? el.dataset.taskText : null;
  }, needle);
}

// A real caret in a real contenteditable. The mock DOM has no Selection at
// all, which is why split-at-offset was untestable until now. `offset` may be
// a number, "end", or "all" to select the whole field so typing replaces it.
async function placeCaret(page, id, offset) {
  await page.evaluate(({ id: taskId, offset: where }) => {
    const el = document.querySelector(`[data-task-text="${taskId}"]`);
    el.focus();
    const range = document.createRange();
    if (where === "all") {
      range.selectNodeContents(el);
    } else {
      const node = el.firstChild || el.appendChild(document.createTextNode(""));
      const at = where === "end" ? node.textContent.length : where;
      range.setStart(node, at);
      range.collapse(true);
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, { id, offset });
}

async function lastTaskIdIn(page, groupId) {
  return page
    .locator(`[data-group-list="${groupId}"] > li.task`)
    .last()
    .locator("[data-task-text]")
    .getAttribute("data-task-text");
}

// Nesting read off the rendered tree, not off a depth field in the model: the
// child <li class="task"> genuinely lives inside its parent's <li>.
async function parentTextOf(page, id) {
  return page.evaluate((taskId) => {
    const li = document.querySelector(`[data-task-text="${taskId}"]`)?.closest("li.task");
    const parent = li?.parentElement?.closest("li.task");
    return parent ? parent.querySelector("[data-task-text]").textContent.trim() : null;
  }, id);
}

test("creates a task and edits an existing one", async ({ page }) => {
  await openBoard(page);

  await page.click('[data-group-card="group-today"] [data-action="add-task"]');
  const createdId = await lastTaskIdIn(page, "group-today");
  // addTask focuses the new row's contenteditable; typing must land there with
  // no extra click. That focus hand-off is not observable in the mock.
  await expect(taskText(page, createdId)).toBeFocused();
  await page.keyboard.type("Write the browser suite");
  await expect(taskText(page, createdId)).toHaveText("Write the browser suite");

  const groceriesId = await taskIdByText(page, "Buy groceries");
  expect(groceriesId).not.toBeNull();
  await page.click(`[data-task-text="${groceriesId}"]`);
  await placeCaret(page, groceriesId, "all");
  await page.keyboard.type("Buy oat milk");
  await expect(taskText(page, groceriesId)).toHaveText("Buy oat milk");

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key) || "", STORAGE_KEY))
    .toContain("Write the browser suite");
});

test("Tab nests a task under the one above it", async ({ page }) => {
  await openBoard(page);

  const replyId = await taskIdByText(page, "Reply to Sam about the weekend");
  expect(await parentTextOf(page, replyId)).toBeNull();

  await page.click(`[data-task-text="${replyId}"]`);
  await page.keyboard.press("Tab");

  expect(await parentTextOf(page, replyId)).toBe("Buy groceries");
  // the parent grew a disclosure chevron, which only appears once it has children
  const parentRow = page.locator('[data-task-text]', { hasText: "Buy groceries" }).first();
  await expect(parentRow.locator("xpath=..").locator("button.chevron").first()).not.toHaveClass(/hidden/);

  await page.keyboard.press("Shift+Tab");
  expect(await parentTextOf(page, replyId)).toBeNull();
});

test("completing a task marks it done and strikes the text through", async ({ page }) => {
  await openBoard(page);

  const walkId = await taskIdByText(page, "Go for a 30-minute walk");
  const row = page.locator(`[data-task-row="${walkId}"]`);
  await expect(row).not.toHaveClass(/done/);

  await page.click(`[data-action="toggle-done"][data-task-id="${walkId}"]`);

  await expect(row).toHaveClass(/done/);
  // the computed style, not the class: the strike-through is the whole point
  // of the class and the mock cannot cascade a stylesheet
  const decoration = await taskText(page, walkId).evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(decoration).toContain("line-through");
});

test("a new task survives a reload", async ({ page }) => {
  await openBoard(page);

  await page.click('[data-group-card="group-priorities"] [data-action="add-task"]');
  await page.keyboard.type("Survive a reload");

  // the model save is debounced; wait for the write rather than for a clock
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key) || "", STORAGE_KEY))
    .toContain("Survive a reload");

  await page.reload();

  await expect(page.locator("[data-task-text]", { hasText: "Survive a reload" })).toBeVisible();
  // and it came back from storage, not from the example seed
  const reloaded = await page.evaluate(() => window.__storageAtLoad || "");
  expect(reloaded).toContain("Survive a reload");
});

test("exports the board as JSON and reimports it", async ({ page }) => {
  const dialogs = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss().catch(() => {});
  });

  await openBoard(page);

  await page.click('[data-group-card="group-today"] [data-action="add-task"]');
  const markerId = await lastTaskIdIn(page, "group-today");
  await page.keyboard.type("EXPORT MARKER 7391");
  await expect(taskText(page, markerId)).toHaveText("EXPORT MARKER 7391");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("[data-export-board]"),
  ]);
  const exportPath = await download.path();
  const exported = await readFile(exportPath, "utf8");
  const payload = JSON.parse(exported);
  expect(Array.isArray(payload.state.groups)).toBe(true);
  expect(exported).toContain("EXPORT MARKER 7391");

  // wipe the marker through the editable, the way a user would
  await page.click(`[data-task-text="${markerId}"]`);
  await placeCaret(page, markerId, "all");
  await page.keyboard.type("WIPED");
  await expect(taskText(page, markerId)).toHaveText("WIPED");

  await page.setInputFiles("[data-import-file]", exportPath);

  await expect(page.locator("[data-task-text]", { hasText: "EXPORT MARKER 7391" })).toBeVisible();
  await expect(page.locator("[data-task-text]", { hasText: /^WIPED$/ })).toHaveCount(0);
  expect(dialogs, "import raised an unexpected dialog").toEqual([]);
});

test("sidebar sits on screen at 1280 and the toggle collapses it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openBoard(page);

  const sidebar = page.locator(".sidebar");
  await expect(sidebar).toBeVisible();
  const box = await sidebar.boundingBox();
  // on screen, with real width: a mock that stores visibility as a flag says
  // "visible" for a sidebar parked at x = -336 too
  expect(box.x).toBe(0);
  expect(box.width).toBeGreaterThan(200);
  await expect(page.locator("[data-sidebar-backdrop]")).toBeHidden();

  await page.click("[data-sidebar-toggle]");
  await expect(sidebar).toBeHidden();
  // no drawer backdrop on desktop, ever
  await expect(page.locator("[data-sidebar-backdrop]")).toBeHidden();

  await page.click("[data-sidebar-toggle]");
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox()).x).toBe(0);
});

test("sidebar is a closed drawer at 390 and the toggle slides it in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);

  const sidebar = page.locator(".sidebar");
  const backdrop = page.locator("[data-sidebar-backdrop]");

  // translateX(-105%) — still in the layout, still "visible" to anything that
  // only checks display, and completely off the screen to a human
  const closed = await sidebar.boundingBox();
  expect(closed.x + closed.width).toBeLessThanOrEqual(0);
  await expect(backdrop).toBeHidden();

  await page.click("[data-sidebar-toggle]");

  await expect.poll(async () => (await sidebar.boundingBox()).x).toBe(0);
  await expect(backdrop).toBeVisible();
});

test("a drawer opened at 390 leaves no backdrop after widening past 980", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);

  const backdrop = page.locator("[data-sidebar-backdrop]");
  await page.click("[data-sidebar-toggle]");
  await expect(backdrop).toBeVisible();
  const cover = await backdrop.boundingBox();
  expect(cover.width).toBeGreaterThanOrEqual(390);

  await page.setViewportSize({ width: 1280, height: 800 });

  await expect(backdrop).toBeHidden();
  // Evren, 2026-07-28: "scrolling is dead while the cursor is over the help
  // text". A backdrop left behind at z-index 55 eats every click and wheel on
  // a page that has no z-index of its own. Hit-test the middle of the screen,
  // then actually click a row: Playwright's own actionability check fails if
  // anything intercepts the pointer.
  const onTop = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return el ? el.className.toString() : "";
  });
  expect(onTop).not.toContain("sidebar-backdrop");

  const walkId = await taskIdByText(page, "Go for a 30-minute walk");
  await page.click(`[data-task-row="${walkId}"]`);
  await expect(page.locator(`[data-task-row="${walkId}"]`)).toHaveClass(/selected/);
});

test("Enter mid-text splits a task at the caret", async ({ page }) => {
  await openBoard(page);

  const groceriesId = await taskIdByText(page, "Buy groceries");
  const before = await page.locator('[data-group-list="group-today"] li.task').count();

  await page.click(`[data-task-text="${groceriesId}"]`);
  await placeCaret(page, groceriesId, 2); // "Bu|y groceries"
  await page.keyboard.press("Enter");

  await expect(taskText(page, groceriesId)).toHaveText("Bu");
  const after = await page.locator('[data-group-list="group-today"] li.task').count();
  expect(after).toBe(before + 1);

  // the tail became the next sibling, and the caret went with it
  const tail = page.locator('[data-group-list="group-today"] > li.task').nth(1).locator("[data-task-text]").first();
  await expect(tail).toHaveText("y groceries");
  await expect(tail).toBeFocused();
});

test('typing ":fi" opens the emoji menu and Enter inserts without splitting', async ({ page }) => {
  await openBoard(page);

  await page.click('[data-group-card="group-today"] [data-action="add-task"]');
  const id = await lastTaskIdIn(page, "group-today");
  const taskCount = await page.locator('[data-group-list="group-today"] > li.task').count();

  const menu = page.locator("[data-emoji-menu]");
  await expect(menu).toBeHidden();

  await page.keyboard.type(":fi");

  await expect(menu).toBeVisible();
  const options = menu.locator('[role="option"]');
  expect(await options.count()).toBeGreaterThan(0);
  const glyph = (await options.first().locator(".glyph").textContent()).trim();
  expect(glyph).not.toBe("");

  await page.keyboard.press("Enter");

  await expect(menu).toBeHidden();
  // the glyph replaced ":fi" in place, and Enter did NOT reach the board's
  // split handler underneath the open menu
  await expect(taskText(page, id)).toHaveText(glyph);
  expect(await page.locator('[data-group-list="group-today"] > li.task').count()).toBe(taskCount);
  await expect(taskText(page, id)).toBeFocused();
});
