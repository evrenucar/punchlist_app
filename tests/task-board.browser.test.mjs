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

// Read the visible order of a group's top-level rows straight off the DOM,
// the same way parentTextOf reads nesting off the DOM rather than the model.
function topLevelTaskTexts(page, groupId) {
  return page.locator(`[data-group-list="${groupId}"] > li.task > .task-row [data-task-text]`).allTextContents();
}

// Chromium's CDP touch injection is used for anything beyond a plain tap
// (page.touchscreen only offers tap()). It produces real, trusted
// TouchEvents that the browser itself turns into pointerType:"touch" Pointer
// Events with isPrimary:true — the same signal a finger on glass produces,
// and exactly what the app's gesture code branches on (the pointerType
// checks throughout src/app/20-images.js and src/app/12-drag-and-drop.js).
async function touchAt(client, type, x, y) {
  await client.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
}

// A 1x1 transparent PNG, inlined so the IndexedDB tests never depend on a
// file on disk or a network fetch — the app itself makes zero external
// requests, and the test suite should not add one either.
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

// Headless Chromium has no real clipboard to paste an image from. This
// builds the same shape a real image paste delivers — a File on
// clipboardData — and dispatches it as a real paste event on the focused
// task text, which is exactly what the paste listener in
// src/app/20-images.js reads (event.clipboardData.files).
async function pasteImageIntoTask(page, taskId, dataUrl = TINY_PNG_DATA_URL) {
  await page.evaluate(async ({ id, src }) => {
    const el = document.querySelector(`[data-task-text="${id}"]`);
    el.focus();
    const blob = await (await fetch(src)).blob();
    const file = new File([blob], "pixel.png", { type: "image/png" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    el.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dataTransfer }));
  }, { id: taskId, src: dataUrl });
}

// Read every record straight out of the real IndexedDB store the app writes
// to (src/app/06-assets.js's ASSET_DB_NAME), not through the app's own
// closured helpers — the point is to prove the bytes are actually on disk in
// the browser's own database, not just sitting in the in-memory assetCache.
function readAssetRecords(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open("punchlist-assets-v1");
    request.onsuccess = () => {
      const getAll = request.result.transaction("assets").objectStore("assets").getAll();
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => resolve([]);
    };
    request.onerror = () => resolve([]);
  }));
}

// Empties the asset store while leaving the board's own reference (assetId)
// alone — the shape a device sees when a synced board mentions an image
// whose bytes have not arrived yet.
function clearAssetRecords(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open("punchlist-assets-v1");
    request.onsuccess = () => {
      const tx = request.result.transaction("assets", "readwrite");
      tx.objectStore("assets").clear();
      tx.oncomplete = () => resolve();
    };
  }));
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

// Touch coverage. The contract these test against is docs/touch-test-plan.html
// (Evren's own on-glass checklist), cross-read against the real gesture code
// in src/app/20-images.js (the pointerdown/pointermove/pointerup listeners)
// and src/app/12-drag-and-drop.js (arm/clear/finish helpers, the swipe and
// auto-scroll math). Two constants drive the whole state machine
// (src/app/01-constants.js): LONG_PRESS_MS = 420 arms a move-drag, and
// SELECT_HOLD_MS = 1500 — held on the SAME press — later flips that armed
// drag into a multi-select instead. Every timed test below leaves a wide
// margin either side of those numbers rather than timing them exactly, since
// a real setTimeout in a real browser is never sub-millisecond precise.
test.describe("touch", () => {
  // Taller than the suite default so every row these tests touch (down to
  // "Go for a 30-minute walk", group-today's last item) sits on screen
  // without a scroll first — boundingBox() does not auto-scroll, and a touch
  // dispatched below the fold hits nothing.
  test.use({ hasTouch: true, viewport: { width: 1280, height: 1100 } });

  test("a quick tap edits a task instead of arming any hold gesture", async ({ page }) => {
    await openBoard(page);
    const groceriesId = await taskIdByText(page, "Buy groceries");
    const row = page.locator(`[data-task-row="${groceriesId}"]`);

    // locator.tap() is a real touchstart+touchend, not a mouse click dressed
    // up as one — it requires hasTouch on the context, which this describe
    // block sets.
    await taskText(page, groceriesId).tap();
    await expect(taskText(page, groceriesId)).toBeFocused();
    // a tap resolves in a few milliseconds, nowhere near LONG_PRESS_MS: it
    // must not be mistaken for the hold-to-drag gesture (docs/touch-test-plan
    // "chevron-ok": taps fire cleanly, no accidental moves or selections)
    await expect(row).not.toHaveClass(/touch-dragging/);
    await expect(page.locator("[data-board]")).not.toHaveClass(/is-touch-selecting/);

    await placeCaret(page, groceriesId, "all");
    await page.keyboard.type("Buy oat milk, tapped in");
    await expect(taskText(page, groceriesId)).toHaveText("Buy oat milk, tapped in");
  });

  test("a horizontal touch swipe indents a task under its previous sibling", async ({ page }) => {
    await openBoard(page);
    const replyId = await taskIdByText(page, "Reply to Sam about the weekend");
    expect(await parentTextOf(page, replyId)).toBeNull();

    const box = await page.locator(`[data-task-row="${replyId}"]`).boundingBox();
    const client = await page.context().newCDPSession(page);
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await touchAt(client, "touchStart", startX, startY);
    // one fast move well past the 18px lock threshold (docs/touch-test-plan
    // "swipe-in": the row slides in 32px detents, release indents one level).
    // This all happens inside a few milliseconds, long before LONG_PRESS_MS,
    // so the hold-to-drag candidate on the same press never gets a chance to
    // arm and steal the gesture.
    await touchAt(client, "touchMove", startX + 50, startY);
    await expect(page.locator(`[data-task-row="${replyId}"]`)).toHaveClass(/swiping/);
    await touchAt(client, "touchEnd", startX + 50, startY);

    expect(await parentTextOf(page, replyId)).toBe("Buy groceries");
  });

  test("holding a row under 1.5s arms a drag, and dragging it reorders the task", async ({ page }) => {
    await openBoard(page);
    const groceriesId = await taskIdByText(page, "Buy groceries");
    const walkId = await taskIdByText(page, "Go for a 30-minute walk");
    const before = await topLevelTaskTexts(page, "group-today");
    expect(before[0]).toBe("Buy groceries");
    expect(before[before.length - 1]).toBe("Go for a 30-minute walk");

    const walkBox = await page.locator(`[data-task-row="${walkId}"]`).boundingBox();
    const groceriesBox = await page.locator(`[data-task-row="${groceriesId}"]`).boundingBox();
    const client = await page.context().newCDPSession(page);
    const startX = walkBox.x + walkBox.width / 2;
    const startY = walkBox.y + walkBox.height / 2;

    await touchAt(client, "touchStart", startX, startY);
    // 650ms: comfortably past LONG_PRESS_MS (420) so the drag has armed, and
    // comfortably short of SELECT_HOLD_MS (1500) so it has not yet flipped
    // into multi-select — the "under 1.5s" side of the boundary
    // (docs/touch-test-plan section 2, "hold to move").
    await page.waitForTimeout(650);
    await expect(page.locator(`[data-task-row="${walkId}"]`)).toHaveClass(/touch-dragging/);
    await expect(page.locator("[data-board]")).not.toHaveClass(/is-touch-selecting/);

    // drag to just under the top edge of "Buy groceries" -> a "before" drop
    const endX = groceriesBox.x + groceriesBox.width / 2;
    const endY = groceriesBox.y + 4;
    await touchAt(client, "touchMove", endX, endY);
    await touchAt(client, "touchEnd", endX, endY);

    const after = await topLevelTaskTexts(page, "group-today");
    expect(after[0]).toBe("Go for a 30-minute walk");
    expect(after).not.toEqual(before);
    await expect(page.locator(`[data-task-row="${walkId}"]`)).not.toHaveClass(/touch-dragging/);
  });

  test("holding past 1.5s flips the hold into a multi-select sweep instead of a move", async ({ page }) => {
    await openBoard(page);
    const groceriesId = await taskIdByText(page, "Buy groceries");
    const replyId = await taskIdByText(page, "Reply to Sam about the weekend");
    const before = await topLevelTaskTexts(page, "group-today");

    const groceriesBox = await page.locator(`[data-task-row="${groceriesId}"]`).boundingBox();
    const replyBox = await page.locator(`[data-task-row="${replyId}"]`).boundingBox();
    const client = await page.context().newCDPSession(page);
    const startX = groceriesBox.x + groceriesBox.width / 2;
    const startY = groceriesBox.y + groceriesBox.height / 2;

    await touchAt(client, "touchStart", startX, startY);
    // 1900ms: past SELECT_HOLD_MS (1500) with real margin — the "past 1.5s"
    // side of the boundary (docs/touch-test-plan section 3, "hold longer to
    // select"). armTouchSelect (src/app/12-drag-and-drop.js) clears whatever
    // drag had armed at 420ms and takes over the same press.
    await page.waitForTimeout(1900);
    await expect(page.locator("[data-board]")).toHaveClass(/is-touch-selecting/);
    await expect(page.locator(`[data-task-row="${groceriesId}"]`)).not.toHaveClass(/touch-dragging/);
    await expect(page.locator(`[data-task-row="${groceriesId}"]`)).toHaveClass(/selected/);

    // sweep onto the adjacent row without releasing (docs/touch-test-plan
    // "sel-sweep": every crossed row joins the selection)
    const endX = replyBox.x + replyBox.width / 2;
    const endY = replyBox.y + replyBox.height / 2;
    await touchAt(client, "touchMove", endX, endY);
    await touchAt(client, "touchEnd", endX, endY);

    await expect(page.locator(`[data-task-row="${groceriesId}"]`)).toHaveClass(/selected/);
    await expect(page.locator(`[data-task-row="${replyId}"]`)).toHaveClass(/selected/);
    // a select never reorders — this is what tells it apart from the drag
    // gesture above, holding the exact same shape of press
    expect(await topLevelTaskTexts(page, "group-today")).toEqual(before);
  });

  test("a quick vertical touch swipe scrolls the board natively, not captured as a gesture", async ({ page }) => {
    await openBoard(page);
    const scrollInfo = await page.evaluate(() => {
      const main = document.querySelector("main");
      return { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };
    });
    expect(scrollInfo.scrollHeight, "the demo board must overflow for this test to mean anything").toBeGreaterThan(scrollInfo.clientHeight + 100);

    const client = await page.context().newCDPSession(page);
    const x = 640;
    const startY = 600;
    // one fast upward drag (finger moves up = content scrolls down), all
    // dispatched immediately with no hold — the touchmove listener only
    // calls preventDefault once a drag or select has armed
    // (src/app/20-images.js), so an un-armed swipe must reach the browser's
    // own native scroll instead of being eaten by the gesture code
    // (docs/touch-test-plan section 4, "nothing else interferes").
    await touchAt(client, "touchStart", x, startY);
    await touchAt(client, "touchMove", x, startY - 300);
    await touchAt(client, "touchEnd", x, startY - 300);

    await expect.poll(() => page.evaluate(() => document.querySelector("main").scrollTop)).toBeGreaterThan(0);
    await expect(page.locator("[data-board]")).not.toHaveClass(/is-touch-dragging|is-touch-selecting/);
  });
});

test.describe("mobile drawer via touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("a real touch tap opens the drawer, and a tap on the backdrop closes it without being swallowed", async ({ page }) => {
    await openBoard(page);
    const sidebar = page.locator(".sidebar");
    const backdrop = page.locator("[data-sidebar-backdrop]");

    const closed = await sidebar.boundingBox();
    expect(closed.x + closed.width).toBeLessThanOrEqual(0);
    await expect(backdrop).toBeHidden();

    await page.locator("[data-sidebar-toggle]").tap();
    await expect.poll(async () => (await sidebar.boundingBox()).x).toBe(0);
    await expect(backdrop).toBeVisible();

    // the backdrop exists to catch exactly this tap; if it silently ate the
    // gesture instead of running its click handler, the drawer would stay
    // open. Tap near the right edge, off the 280px-wide drawer itself (the
    // sidebar sits above the backdrop in z-order — see 24-sidebar.js — so a
    // tap over the drawer's own width would hit the drawer, not the backdrop
    // meant to close it).
    await backdrop.tap({ position: { x: 370, y: 400 } });
    await expect
      .poll(async () => { const box = await sidebar.boundingBox(); return box.x + box.width; })
      .toBeLessThanOrEqual(0);
    await expect(backdrop).toBeHidden();
  });
});

// IndexedDB coverage: the asset store in src/app/06-assets.js. Images leave
// board state entirely (see storeAsset / getAssetSrc) and live in the
// browser's own IndexedDB, keyed by an assetId reference in the board JSON.
// The static VM suite has no real indexedDB, so this is the only place a
// regression here (bytes never actually written, or never read back after a
// reload) would show up.
test.describe("IndexedDB image assets", () => {
  test("a pasted image is written to IndexedDB, survives a reload, and renders", async ({ page }) => {
    await openBoard(page);
    const groceriesId = await taskIdByText(page, "Buy groceries");
    await taskText(page, groceriesId).click();
    await pasteImageIntoTask(page, groceriesId);

    const image = page.locator(`[data-image-task="${groceriesId}"][data-node-kind="image"] img`);
    await expect(image).toBeVisible();
    const srcBefore = await image.getAttribute("src");
    expect(srcBefore).toMatch(/^data:image\//);

    // the bytes actually landed in the real database, not only the
    // in-memory assetCache that storeAsset also populates synchronously
    await expect.poll(async () => (await readAssetRecords(page)).length).toBe(1);
    const [record] = await readAssetRecords(page);
    expect(record.src).toBe(srcBefore);

    await page.reload();
    // and it came back from indexedDB, not embedded again in localStorage —
    // the whole point of moving image bytes out of board state
    const boardAfterReload = await page.evaluate((key) => localStorage.getItem(key) || "", STORAGE_KEY);
    expect(boardAfterReload).toContain('"assetId"');
    expect(boardAfterReload).not.toContain(srcBefore);

    const imageAfterReload = page.locator(`[data-image-task="${groceriesId}"][data-node-kind="image"] img`);
    await expect(imageAfterReload).toBeVisible();
    expect(await imageAfterReload.getAttribute("src")).toBe(srcBefore);
  });

  test("an image whose bytes never arrived renders a pending placeholder, not a broken image", async ({ page }) => {
    await openBoard(page);
    const groceriesId = await taskIdByText(page, "Buy groceries");
    await taskText(page, groceriesId).click();
    await pasteImageIntoTask(page, groceriesId);
    await expect(page.locator(`[data-image-task="${groceriesId}"] img`)).toBeVisible();
    await expect.poll(async () => (await readAssetRecords(page)).length).toBe(1);

    // simulate the shape a fresh device sees mid-sync: the board still
    // references the assetId, but the bytes have not arrived in this
    // browser's IndexedDB yet (src/app/06-assets.js getAssetSrc returns null
    // for that case, and src/app/16-rendering-parts.js's own comment names
    // the placeholder this renders instead: "bytes not local yet")
    await clearAssetRecords(page);
    await page.reload();

    const pending = page.locator(`[data-image-task="${groceriesId}"] .image-pending`);
    await expect(pending).toBeVisible();
    await expect(pending).toHaveAttribute("title", "Image is syncing in");
    await expect(page.locator(`[data-image-task="${groceriesId}"][data-node-kind="image"] img`)).toHaveCount(0);
  });
});
