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

test("selecting a mobile row keeps lower checkbox coordinates and targets stable", async ({ page }) => {
  await page.goto(baseURL);
  const selectedId = await taskId(page, "Buy groceries");
  const belowId = await taskId(page, "Book a dentist appointment");
  const selectedRow = page.locator(`[data-task-row="${selectedId}"]`);
  const belowCheckbox = page.locator(`[data-action="toggle-done"][data-task-id="${belowId}"]`);
  await selectedRow.scrollIntoViewIfNeeded();

  const before = await page.evaluate(({ selectedId, belowId }) => {
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box && { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      row: rect(document.querySelector(`[data-task-row="${selectedId}"]`)),
      checkbox: rect(document.querySelector(`[data-action="toggle-done"][data-task-id="${belowId}"]`)),
    };
  }, { selectedId, belowId });
  const originalPoint = { x: before.checkbox.x + before.checkbox.width / 2, y: before.checkbox.y + before.checkbox.height / 2 };

  await page.touchscreen.tap(before.row.x + before.row.width * 0.6, before.row.y + before.row.height / 2);
  await expect(selectedRow).toHaveClass(/selected/);

  const after = await page.evaluate(({ point, selectedId, belowId }) => {
    const row = document.querySelector(`[data-task-row="${selectedId}"]`);
    const below = document.querySelector(`[data-action="toggle-done"][data-task-id="${belowId}"]`);
    const hit = document.elementFromPoint(point.x, point.y);
    return {
      rowHeight: row?.getBoundingClientRect().height,
      checkboxY: below?.getBoundingClientRect().y,
      originalPointTask: hit?.closest("[data-task-row]")?.dataset.taskRow,
      originalPointAction: hit?.closest("button")?.dataset.action,
    };
  }, { point: originalPoint, selectedId, belowId });
  expect(after.rowHeight).toBe(before.row.height);
  expect(after.checkboxY).toBe(before.checkbox.y);
  expect(after.originalPointTask).toBe(belowId);
  expect(after.originalPointAction).toBe("toggle-done");

  await page.touchscreen.tap(originalPoint.x, originalPoint.y);
  await expect(page.locator(`[data-task-row="${belowId}"]`)).toHaveClass(/done/);
  await expect(belowCheckbox).toBeVisible();
});

test("group deletion confirmation overlays the selected group and its Delete button confirms on touch", async ({ page }) => {
  await page.goto(baseURL);
  const group = page.locator("[data-group-row]").first();
  await group.scrollIntoViewIfNeeded();
  const groupId = await group.getAttribute("data-group-row");
  const before = await group.boundingBox();

  await page.touchscreen.tap(before.x + before.width * 0.55, before.y + before.height / 2);
  await expect(group).toHaveClass(/selected/);
  await page.keyboard.press("Delete");

  const confirmation = page.locator(`[data-group-delete-confirm="${groupId}"]`);
  await expect(confirmation).toBeVisible();
  const after = await page.evaluate((groupId) => {
    const box = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const header = document.querySelector(`[data-group-row="${groupId}"]`);
    const title = header?.querySelector("[data-group-title]");
    const confirm = document.querySelector(`[data-group-delete-confirm="${groupId}"]`);
    const remove = confirm?.querySelector('[data-action="confirm-delete"]');
    return { header: box(header), title: box(title), confirm: box(confirm), remove: box(remove), hit: remove && document.elementFromPoint(remove.getBoundingClientRect().x + remove.getBoundingClientRect().width / 2, remove.getBoundingClientRect().y + remove.getBoundingClientRect().height / 2)?.dataset.action };
  }, groupId);
  expect(Math.round(after.header.height)).toBe(Math.round(before.height));
  expect(after.title.width).toBeGreaterThan(100);
  expect(after.confirm.y).toBeGreaterThanOrEqual(after.header.y);
  expect(after.confirm.y).toBeLessThanOrEqual(after.header.bottom);
  expect(after.confirm.bottom).toBeLessThanOrEqual(after.header.bottom + 28);
  expect(after.confirm.width).toBeLessThanOrEqual(after.header.width);
  expect(after.remove.width).toBeGreaterThanOrEqual(40);
  expect(after.remove.height).toBeGreaterThanOrEqual(40);
  expect(after.hit).toBe("confirm-delete");

  const deleteBox = await confirmation.locator('[data-action="confirm-delete"]').boundingBox();
  await page.touchscreen.tap(deleteBox.x + deleteBox.width / 2, deleteBox.y + deleteBox.height / 2);
  await expect(page.locator(`[data-group-card="${groupId}"]`)).toHaveCount(0);
});

test("nested subtree confirmation anchors immediately above the exact task at two depths", async ({ page }) => {
  for (const targetText of ["Press Enter to add a task below", "Tab and Shift+Tab change how deeply it nests"]) {
    await page.goto(baseURL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const ids = await page.evaluate(() => {
      const api = window.taskBoardTestApi;
      const walk = (tasks, text) => {
        for (const task of tasks || []) {
          if (task.text === text) return task;
          const nested = walk(task.children, text);
          if (nested) return nested;
        }
        return null;
      };
      const parent = api.state.groups.flatMap((group) => group.tasks).map((task) => walk([task], "Press Enter to add a task below")).find(Boolean);
      const child = api.state.groups.flatMap((group) => group.tasks).map((task) => walk([task], "Tab and Shift+Tab change how deeply it nests")).find(Boolean);
      child.children.push({ id: "test-deep-leaf", text: "Deep leaf", done: false, collapsed: false, children: [], images: [] });
      const group = api.state.groups.find((candidate) => candidate.tasks.some((task) => walk([task], parent.text)));
      api.renderGroupInPlace(group.id);
      return { parentId: parent.id, childId: child.id };
    });

    const targetId = targetText.startsWith("Press Enter") ? ids.parentId : ids.childId;
    const target = page.locator(`[data-task-row="${targetId}"]`);
    await target.scrollIntoViewIfNeeded();
    const before = await target.boundingBox();
    await page.touchscreen.tap(before.x + before.width * 0.55, before.y + before.height / 2);
    await expect(target).toHaveClass(/selected/);
    const trash = target.locator('[data-mobile-delete-task]');
    const trashBox = await trash.boundingBox();
    await page.touchscreen.tap(trashBox.x + trashBox.width / 2, trashBox.y + trashBox.height / 2);

    const confirmation = page.locator(`[data-task-delete-confirm="${targetId}"]`);
    await expect(confirmation).toBeVisible();
    const geometry = await page.evaluate((targetId) => {
      const rect = (node) => {
        const box = node?.getBoundingClientRect();
        return box && { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
      };
      const row = document.querySelector(`[data-task-row="${targetId}"]`);
      const confirm = document.querySelector(`[data-task-delete-confirm="${targetId}"]`);
      const remove = confirm?.querySelector('[data-action="confirm-delete"]');
      const removeBox = remove?.getBoundingClientRect();
      return {
        row: rect(row),
        confirm: rect(confirm),
        remove: rect(remove),
        hit: removeBox && document.elementFromPoint(removeBox.x + removeBox.width / 2, removeBox.y + removeBox.height / 2)?.dataset.action,
      };
    }, targetId);
    expect(geometry.confirm.top).toBeGreaterThanOrEqual(geometry.row.top - 8);
    expect(geometry.confirm.top).toBeLessThanOrEqual(geometry.row.bottom);
    expect(geometry.confirm.left).toBeGreaterThanOrEqual(geometry.row.left - 1);
    expect(geometry.confirm.right).toBeLessThanOrEqual(geometry.row.right + 1);
    expect(geometry.remove.width).toBeGreaterThanOrEqual(40);
    expect(geometry.remove.height).toBeGreaterThanOrEqual(40);
    expect(geometry.hit).toBe("confirm-delete");

    const deleteBox = await confirmation.locator('[data-action="confirm-delete"]').boundingBox();
    await page.touchscreen.tap(deleteBox.x + deleteBox.width / 2, deleteBox.y + deleteBox.height / 2);
    await expect(page.locator(`[data-task-row="${targetId}"]`)).toHaveCount(0);
  }
});

test("mobile rows keep direct add visible and reveal a small selected-only delete without shifting text", async ({ page }) => {
  await page.goto(baseURL);
  const id = await taskId(page, "Pick a color palette");
  const row = page.locator(`[data-task-row="${id}"]`);
  await row.scrollIntoViewIfNeeded();

  const before = await page.evaluate((id) => {
    const box = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const row = document.querySelector(`[data-task-row="${id}"]`);
    return { row: box(row), text: box(row?.querySelector("[data-task-text]")), add: box(row?.querySelector("[data-mobile-add-child]")), remove: box(row?.querySelector("[data-mobile-delete-task]")) };
  }, id);
  expect(before.text.width).toBeGreaterThanOrEqual(152);
  expect(Math.round(before.add.left - before.text.right)).toBeLessThanOrEqual(4);
  expect(before.add.width).toBeGreaterThanOrEqual(40);
  expect(before.remove.width).toBe(0);

  await page.touchscreen.tap(before.row.left + before.row.width * 0.55, before.row.top + before.row.height / 2);
  await expect(row).toHaveClass(/selected/);

  const after = await page.evaluate((id) => {
    const box = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const row = document.querySelector(`[data-task-row="${id}"]`);
    return { row: box(row), text: box(row?.querySelector("[data-task-text]")), add: box(row?.querySelector("[data-mobile-add-child]")), remove: box(row?.querySelector("[data-mobile-delete-task]")) };
  }, id);
  expect(Math.round(after.row.height)).toBe(Math.round(before.row.height));
  expect(after.text.width).toBe(before.text.width);
  expect(after.add.left).toBe(before.add.left);
  expect(after.remove.width).toBeGreaterThan(0);
  expect(after.remove.top).toBeLessThanOrEqual(after.row.top + 2);
  expect(after.remove.right).toBeLessThanOrEqual(after.row.right + 30);
  expect(after.remove.left).toBeGreaterThanOrEqual(after.add.right + 4);
});
