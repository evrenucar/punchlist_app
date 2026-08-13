import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const APP_FILE = process.env.PUNCHLIST_APP_FILE || fileURLToPath(new URL("../outputs/task-board.html", import.meta.url));
const STORAGE_KEY = "scheduling-task-management-board-v1";
const PHONE_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
];
const LONG_TEXT = "Focus mode must contain this unbroken-title-with-metadata-" + "0123456789".repeat(18);
const WIDE_IMAGE = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="300"><rect width="1400" height="300" fill="#246bfe"/><text x="20" y="160" font-size="44" fill="white">wide focus image</text></svg>',
);

let server;
let baseURL;
const browserErrors = new WeakMap();

test.beforeAll(async () => {
  const html = await readFile(APP_FILE);
  server = createServer((request, response) => {
    if (request.url === "/sw.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
      response.end("self.addEventListener('fetch', () => {});");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || [], "mobile regression emitted browser errors").toEqual([]);
});

async function openBoard(page) {
  await page.addInitScript((key) => {
    window.__storageAtLoad = window.localStorage.getItem(key);
  }, STORAGE_KEY);
  await page.goto(baseURL);
  expect(await page.evaluate(() => window.__storageAtLoad), "localStorage leaked into the mobile regression").toBeNull();
  await expect(page.locator('[data-group-card="group-getting-started"]')).toBeVisible();
}

async function openOverflowingFocusFixture(page) {
  await page.evaluate(({ text, image }) => {
    const api = window.taskBoardTestApi;
    const root = api.state.groups[0].tasks[0];
    root.text = text;
    root.images = [{ id: "focus-wide-image", src: image, width: 1400, caption: text }];
    let parent = root;
    for (let depth = 0; depth < 12; depth += 1) {
      const child = {
        id: `focus-depth-${depth}`,
        text: `${text} depth ${depth}`,
        done: false,
        collapsed: false,
        children: [],
        images: depth === 8 ? [{ id: "focus-child-wide-image", src: image, width: 1400, caption: text }] : [],
      };
      parent.children = [child];
      parent = child;
    }
    api.enterFocusMode(root.id);
  }, { text: LONG_TEXT, image: WIDE_IMAGE });
  await expect(page.locator("[data-focus-mode]")).toBeVisible();
}

test("mobile focus content fits the visual viewport at 320, 360 and 390 pixels", async ({ page }) => {
  await page.setViewportSize(PHONE_VIEWPORTS[0]);
  await openBoard(page);
  await openOverflowingFocusFixture(page);

  for (const viewport of PHONE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const selectors = [
        "[data-focus-mode]",
        "[data-focus-task]",
        ".focus-mode__text",
        ".focus-mode__crumb",
        ".focus-mode__timer",
        ".focus-mode__children",
        ".focus-outline",
        ".focus-outline li",
        ".focus-mode__image",
        ".focus-child-image",
        ".image-caption",
      ];
      const elements = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
      const outside = elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const intentionallyClipped = element.matches(".focus-mode__crumb") && getComputedStyle(element).overflowX === "hidden";
        return {
          selector: element.matches("[data-focus-mode]") ? "focus-mode" : element.className,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          intentionallyClipped,
        };
      }).filter((item) => item.left < -1 || item.right > window.innerWidth + 1 || (!item.intentionallyClipped && item.scrollWidth > item.clientWidth + 1));
      return {
        innerWidth: window.innerWidth,
        visualWidth: window.visualViewport?.width || window.innerWidth,
        documentScrollWidth: document.scrollingElement.scrollWidth,
        focusScrollWidth: document.querySelector("[data-focus-mode]").scrollWidth,
        taskScrollWidth: document.querySelector("[data-focus-task]").scrollWidth,
        outside,
      };
    });

    expect(geometry.documentScrollWidth, `${viewport.width}px document overflow: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(geometry.focusScrollWidth, `${viewport.width}px focus overflow: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(geometry.taskScrollWidth, `${viewport.width}px task overflow: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(geometry.outside, `${viewport.width}px focus descendants outside viewport`).toEqual([]);
  }
});

test.describe("mobile focus action dock", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("Back and Fold all move to one touch-safe bottom-left area only on small screens", async ({ page }) => {
    await openBoard(page);
    await page.evaluate(() => {
      const api = window.taskBoardTestApi;
      const root = api.state.groups[0].tasks[0];
      root.children = [{ id: "focus-fold-child", text: "Child to fold", done: false, collapsed: false, children: [{ id: "focus-fold-grandchild", text: "Grandchild", done: false, collapsed: false, children: [] }] }];
      api.enterFocusMode(root.id);
    });

    const actions = page.locator("[data-focus-actions]");
    const back = page.locator("[data-focus-exit]");
    const fold = page.locator("[data-focus-fold]");
    await expect(actions).toBeVisible();
    const mobile = await page.evaluate(() => {
      const dock = document.querySelector("[data-focus-actions]");
      const controls = [document.querySelector("[data-focus-exit]"), document.querySelector("[data-focus-fold]")];
      const rect = dock.getBoundingClientRect();
      return {
        dock: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        position: getComputedStyle(dock).position,
        controls: controls.map((control) => {
          const box = control.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return { width: box.width, height: box.height, hit: hit === control || control.contains(hit) };
        }),
        visualBottom: (window.visualViewport?.offsetTop || 0) + (window.visualViewport?.height || window.innerHeight),
      };
    });
    expect(mobile.position).toBe("fixed");
    expect(mobile.dock.left).toBeGreaterThanOrEqual(8);
    expect(mobile.dock.top).toBeGreaterThan(844 * 0.65);
    expect(mobile.dock.bottom).toBeLessThanOrEqual(mobile.visualBottom - 8);
    expect(mobile.controls.every((control) => control.width >= 44 && control.height >= 44 && control.hit)).toBe(true);

    await fold.tap();
    await expect(page.locator('[data-focus-chevron="focus-fold-child"]')).toHaveAttribute("aria-expanded", "false");

    await page.setViewportSize({ width: 1000, height: 800 });
    const desktop = await actions.evaluate((dock) => {
      const rect = dock.getBoundingClientRect();
      return { position: getComputedStyle(dock).position, top: rect.top, left: rect.left };
    });
    expect(desktop.position).not.toBe("fixed");
    expect(desktop.top).toBeLessThan(60);

    await page.setViewportSize({ width: 390, height: 844 });
    await back.tap();
    await expect(page.locator("[data-focus-mode]")).toBeHidden();
  });
});

test.describe("mobile scrolling navigation", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("the single hamburger pins at viewport top-right after deep scroll and reattaches at top", async ({ page }) => {
    await openBoard(page);
    const hamburger = page.locator("[data-sidebar-toggle]");
    await expect(hamburger).toHaveCount(1);

    const normal = await hamburger.boundingBox();
    expect(normal.y).toBeGreaterThan(0);
    const normalBottom = normal.y + normal.height;
    await page.evaluate(() => {
      const main = document.querySelector("main");
      main.scrollTop = Math.max(1, document.querySelector("[data-sidebar-toggle]").getBoundingClientRect().bottom - 1);
    });
    await expect.poll(() => hamburger.evaluate((button) => getComputedStyle(button).position)).not.toBe("fixed");
    await page.evaluate(() => {
      const main = document.querySelector("main");
      main.scrollTop = Math.ceil(document.querySelector("[data-sidebar-toggle]").getBoundingClientRect().bottom + main.scrollTop + 1);
    });
    await expect.poll(() => page.evaluate(() => document.querySelector("main").scrollTop)).toBeGreaterThan(normalBottom);
    await expect.poll(() => hamburger.evaluate((button) => getComputedStyle(button).position)).toBe("fixed");

    const pinned = await page.evaluate(() => {
      const button = document.querySelector("[data-sidebar-toggle]");
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        position: getComputedStyle(button).position,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        centerOwnsHit: hit === button || button.contains(hit),
      };
    });
    expect(pinned.position).toBe("fixed");
    expect(pinned.rect.top).toBeGreaterThanOrEqual(8);
    expect(pinned.rect.right).toBeLessThanOrEqual(390 - 8);
    expect(pinned.rect.left).toBeGreaterThan(390 - 80);
    expect(pinned.centerOwnsHit).toBe(true);

    await hamburger.tap();
    await expect(page.locator("[data-sidebar-backdrop]")).toBeVisible();
    await page.locator("[data-sidebar-backdrop]").tap({ position: { x: 380, y: 500 } });
    await expect(page.locator("[data-sidebar-backdrop]")).toBeHidden();

    await page.evaluate(() => window.taskBoardTestApi.enterFocusMode(window.taskBoardTestApi.state.groups[0].tasks[0].id));
    await expect(page.locator("[data-focus-mode]")).toBeVisible();
    expect(await hamburger.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === button || button.contains(hit);
    }), "the pinned board hamburger must stay behind focus mode").toBe(false);
    await page.locator("[data-focus-exit]").tap();

    await page.evaluate(() => {
      const main = document.querySelector("main");
      main.scrollTop = 0;
    });
    await expect.poll(() => hamburger.evaluate((button) => getComputedStyle(button).position)).not.toBe("fixed");
    const returned = await hamburger.boundingBox();
    expect(Math.abs(returned.x - normal.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(returned.y - normal.y)).toBeLessThanOrEqual(1);
  });

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    test(`maximum scroll fully exposes Completed and Trash with safe end space at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openBoard(page);
      await page.evaluate(() => {
        const main = document.querySelector("main");
        main.scrollTop = main.scrollHeight;
      });
      await expect.poll(() => page.evaluate(() => {
        const main = document.querySelector("main");
        return main.scrollTop + main.clientHeight >= main.scrollHeight - 1;
      })).toBe(true);

      const geometry = await page.evaluate(() => {
        const main = document.querySelector("main");
        const completed = document.querySelector("[data-completed-section]").getBoundingClientRect();
        const trash = document.querySelector("[data-trash-section]").getBoundingClientRect();
        const visualBottom = (window.visualViewport?.offsetTop || 0) + (window.visualViewport?.height || window.innerHeight);
        return {
          innerWidth: window.innerWidth,
          documentScrollWidth: document.scrollingElement.scrollWidth,
          mainScrollWidth: main.scrollWidth,
          completed: { top: completed.top, bottom: completed.bottom },
          trash: { top: trash.top, bottom: trash.bottom },
          visualBottom,
          blankAfterTrash: visualBottom - trash.bottom,
        };
      });
      expect(geometry.completed.top).toBeGreaterThanOrEqual(0);
      expect(geometry.trash.bottom).toBeLessThanOrEqual(geometry.visualBottom);
      expect(geometry.blankAfterTrash).toBeGreaterThanOrEqual(72);
      expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
      expect(geometry.mainScrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
    });
  }
});
