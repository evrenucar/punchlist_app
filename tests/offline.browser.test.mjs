import { createServer } from "node:http";
import { createReadStream, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

const root = path.resolve("website");
let server;
let baseURL;

async function serve(request, response) {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(404); response.end(); return;
  }
  try {
    await stat(file);
    const contentType = file.endsWith(".json") ? "application/json" : file.endsWith(".js") ? "application/javascript" : file.endsWith(".webmanifest") ? "application/manifest+json" : "text/html; charset=utf-8";
    response.writeHead(200, { "content-type": contentType });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404); response.end("not found");
  }
}

test.beforeAll(async () => {
  server = createServer((request, response) => { serve(request, response); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("online navigations are network-first so an installed preview can upgrade", () => {
  const worker = readFileSync(path.resolve("src/sw.js"), "utf8");
  expect(worker).toContain('event.request.mode === "navigate"');
  expect(worker).toContain('fetch(event.request).catch(() => caches.match(event.request))');
});

test("hosted app reopens from its service-worker cache while offline", async ({ page, context }) => {
  await page.goto(`${baseURL}/task-board.html`, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const onlineVersion = await page.locator("[data-app-version]").textContent();
  expect(onlineVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-app-version]")).toHaveText(onlineVersion);
  await expect(page.locator("[data-task-row]").first()).toBeVisible();
});
