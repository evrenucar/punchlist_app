import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sw = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../src/manifest.webmanifest", import.meta.url), "utf8"));
const template = await readFile(new URL("../src/task-board.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app/25-app.js", import.meta.url), "utf8");

test("offline web app assets are wired into the hosted app", () => {
  assert.match(template, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/sw\.js"/);
  assert.match(sw, /self\.addEventListener\("install"/);
  assert.match(sw, /self\.addEventListener\("fetch"/);
  assert.match(sw, /punchlist-v__PUNCHLIST_VERSION__/);
  assert.equal(manifest.start_url, "./task-board.html");
  assert.equal(manifest.scope, "./");
});
