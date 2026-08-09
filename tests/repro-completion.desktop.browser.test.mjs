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

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } });

test("completion target stays reliable across the full desktop hit area", async ({ page }) => {
  await page.goto(baseURL);
  const id = await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-task-text]")].find((node) => node.textContent.trim() === "Go for a 30-minute walk");
    return el.dataset.taskText;
  });
  const checkbox = page.locator(`[data-action="toggle-done"][data-task-id="${id}"]`);
  await checkbox.scrollIntoViewIfNeeded();
  const box = await checkbox.boundingBox();
  expect(box).not.toBeNull();
  for (const x of [box.x + 6, box.x + box.width / 2, box.x + box.width - 6]) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const freshId = await page.evaluate(() => [...document.querySelectorAll("[data-task-text]")].find((node) => node.textContent.trim() === "Go for a 30-minute walk").dataset.taskText);
    const fresh = page.locator(`[data-action="toggle-done"][data-task-id="${freshId}"]`);
    await fresh.scrollIntoViewIfNeeded();
    const freshBox = await fresh.boundingBox();
    await page.mouse.click(freshBox.x + (x - box.x), freshBox.y + freshBox.height / 2);
    await expect(page.locator(`[data-task-row="${freshId}"]`)).toHaveClass(/done/);
  }
});
