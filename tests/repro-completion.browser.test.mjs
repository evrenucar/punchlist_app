import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const APP_FILE = fileURLToPath(new URL("../outputs/task-board.html", import.meta.url));
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

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

async function taskId(page, text) {
  return page.evaluate((wanted) => [...document.querySelectorAll("[data-task-text]")].find((node) => node.textContent.trim() === wanted)?.dataset.taskText, text);
}

async function tapCheckbox(page, id) {
  const checkbox = page.locator(`[data-action="toggle-done"][data-task-id="${id}"]`);
  await checkbox.scrollIntoViewIfNeeded();
  const box = await checkbox.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test("completion target stays reliable across the full mobile hit area", async ({ page }) => {
  await page.goto(baseURL);
  const id = await taskId(page, "Go for a 30-minute walk");
  const checkbox = page.locator(`[data-action="toggle-done"][data-task-id="${id}"]`);
  const box = await checkbox.boundingBox();
  expect(box).not.toBeNull();
  const points = ["center", "left-edge", "right-edge"];
  for (const point of points) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const freshId = await taskId(page, "Go for a 30-minute walk");
    const freshCheckbox = page.locator(`[data-action="toggle-done"][data-task-id="${freshId}"]`);
    await freshCheckbox.scrollIntoViewIfNeeded();
    const freshBox = await freshCheckbox.boundingBox();
    const targetX = point === "left-edge" ? freshBox.x + 6 : point === "right-edge" ? freshBox.x + freshBox.width - 6 : freshBox.x + freshBox.width / 2;
    const targetY = freshBox.y + freshBox.height / 2;
    await page.touchscreen.tap(targetX, targetY);
    await expect(page.locator(`[data-task-row="${freshId}"]`), `point=${point}`).toHaveClass(/done/);
  }
});

test("a completion tap after touch selection is not swallowed by the selection guard", async ({ page }) => {
  await page.goto(baseURL);
  const heldId = await taskId(page, "Buy groceries");
  const targetId = await taskId(page, "Book a dentist appointment");
  const heldRow = page.locator(`[data-task-row="${heldId}"]`);
  await heldRow.scrollIntoViewIfNeeded();
  const heldBox = await heldRow.boundingBox();
  await page.touchscreen.tap(heldBox.x + heldBox.width / 2, heldBox.y + heldBox.height / 2, { delay: 1600 });
  await tapCheckbox(page, targetId);
  await expect(page.locator(`[data-task-row="${targetId}"]`)).toHaveClass(/done/);
});

test("every corner of the advertised mobile completion hit area completes the task", async ({ page }) => {
  await page.goto(baseURL);
  for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const id = await taskId(page, "Book a dentist appointment");
    const checkbox = page.locator(`[data-action="toggle-done"][data-task-id="${id}"]`);
    await checkbox.scrollIntoViewIfNeeded();
    const box = await checkbox.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box.width)).toBe(44);
    const x = corner.includes("left") ? box.x + 1 : box.x + box.width - 1;
    const y = corner.includes("top") ? box.y + 1 : box.y + box.height - 1;
    await page.touchscreen.tap(x, y);
    await expect(page.locator(`[data-task-row="${id}"]`), corner).toHaveClass(/done/);
  }
});

test("a completion tap does not select the task row as a side effect", async ({ page }) => {
  await page.goto(baseURL);
  const id = await taskId(page, "Go for a 30-minute walk");
  await tapCheckbox(page, id);
  const row = page.locator(`[data-task-row="${id}"]`);
  await expect(row).toHaveClass(/done/);
  await expect(row).not.toHaveClass(/selected/);
});

test("completion preserves the mobile board scroll position and subsequent hit target", async ({ page }) => {
  await page.goto(baseURL);
  const id = await taskId(page, "Go for a 30-minute walk");
  const checkbox = page.locator(`[data-action="toggle-done"][data-task-id="${id}"]`);
  await checkbox.scrollIntoViewIfNeeded();
  const box = await checkbox.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const before = await page.evaluate(({ id, point }) => ({
    scrollTop: document.querySelector("main").scrollTop,
    hitTask: document.elementFromPoint(point.x, point.y)?.closest("[data-task-row]")?.dataset.taskRow,
  }), { id, point });
  expect(before.scrollTop).toBeGreaterThan(0);
  expect(before.hitTask).toBe(id);

  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator(`[data-task-row="${id}"]`)).toHaveClass(/done/);

  const after = await page.evaluate(({ point }) => ({
    scrollTop: document.querySelector("main").scrollTop,
    hitTask: document.elementFromPoint(point.x, point.y)?.closest("[data-task-row]")?.dataset.taskRow,
  }), { point });
  expect(after.scrollTop).toBe(before.scrollTop);
  expect(after.hitTask).toBe(id);
});

test("selecting a mobile row moves lower controls only with their visible row", async ({ page }) => {
  await page.goto(baseURL);
  const selectedId = await taskId(page, "Buy groceries");
  const belowId = await taskId(page, "Book a dentist appointment");
  const selectedRow = page.locator(`[data-task-row="${selectedId}"]`);
  const belowCheckbox = page.locator(`[data-action="toggle-done"][data-task-id="${belowId}"]`);
  await selectedRow.scrollIntoViewIfNeeded();

  const before = await page.evaluate(({ selectedId, belowId }) => {
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box && { x: box.x, y: box.y, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      row: rect(document.querySelector(`[data-task-row="${selectedId}"]`)),
      checkbox: rect(document.querySelector(`[data-action="toggle-done"][data-task-id="${belowId}"]`)),
    };
  }, { selectedId, belowId });

  await page.touchscreen.tap(before.row.x + before.row.width * 0.6, before.row.y + before.row.height / 2);
  await expect(selectedRow).toHaveClass(/selected/);

  const after = await page.evaluate(({ selectedId, belowId }) => {
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box && { x: box.x, y: box.y, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const row = document.querySelector(`[data-task-row="${selectedId}"]`);
    const checkbox = document.querySelector(`[data-action="toggle-done"][data-task-id="${belowId}"]`);
    const actions = row?.querySelector(".task-actions");
    return {
      row: rect(row),
      checkbox: rect(checkbox),
      actions: rect(actions),
      actionButtons: [...(actions?.querySelectorAll("button") || [])].map(rect),
    };
  }, { selectedId, belowId });
  expect(after.row.height).toBeGreaterThan(before.row.height);
  expect(after.checkbox.y).toBeGreaterThan(before.checkbox.y);
  expect(after.actions.top).toBeGreaterThanOrEqual(after.row.top);
  expect(after.actions.bottom).toBeLessThanOrEqual(after.row.bottom);
  expect(after.actionButtons.every((button) => button.width >= 40 && button.height >= 40)).toBe(true);

  const currentPoint = { x: after.checkbox.x + after.checkbox.width / 2, y: after.checkbox.y + after.checkbox.height / 2 };
  const hit = await page.evaluate((point) => {
    const node = document.elementFromPoint(point.x, point.y);
    return { task: node?.closest("[data-task-row]")?.dataset.taskRow, action: node?.closest("button")?.dataset.action };
  }, currentPoint);
  expect(hit.task).toBe(belowId);
  expect(hit.action).toBe("toggle-done");

  await page.touchscreen.tap(currentPoint.x, currentPoint.y);
  await expect(page.locator(`[data-task-row="${belowId}"]`)).toHaveClass(/done/);
  await expect(belowCheckbox).toBeVisible();
});

test("selected mobile-row actions form a visible second row without covering task text", async ({ page }) => {
  await page.goto(baseURL);
  const id = await taskId(page, "Reply to Sam about the weekend");
  const row = page.locator(`[data-task-row="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  const before = await row.boundingBox();
  await page.touchscreen.tap(before.x + before.width * 0.55, before.y + before.height / 2);
  await expect(row).toHaveClass(/selected/);

  const layout = await page.evaluate((id) => {
    const box = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const row = document.querySelector(`[data-task-row="${id}"]`);
    const text = row?.querySelector("[data-task-text]");
    const actions = row?.querySelector(".task-actions");
    const controls = [...(actions?.querySelectorAll("button") || [])].map(box);
    return { row: box(row), text: box(text), actions: box(actions), controls };
  }, id);

  expect(layout.row.height).toBeGreaterThan(before.height);
  expect(layout.actions.top).toBeGreaterThanOrEqual(layout.text.bottom);
  expect(layout.actions.bottom).toBeLessThanOrEqual(layout.row.bottom);
  expect(layout.actions.left).toBeGreaterThanOrEqual(layout.row.left);
  expect(layout.actions.right).toBeLessThanOrEqual(layout.row.right);
  expect(layout.controls.every((control) => control.width >= 40 && control.height >= 40)).toBe(true);
});
