import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src");
const outputPath = path.join(root, "outputs", "task-board.html");

const [template, css, script] = await Promise.all([
  readFile(path.join(sourceDir, "task-board.html"), "utf8"),
  readFile(path.join(sourceDir, "task-board.css"), "utf8"),
  readFile(path.join(sourceDir, "task-board.js"), "utf8"),
]);

if (!template.includes("<!-- TASK_BOARD_STYLES -->") || !template.includes("<!-- TASK_BOARD_SCRIPT -->")) {
  throw new Error("task-board template is missing build markers");
}

const output = template
  .replace("<!-- TASK_BOARD_STYLES -->", `<style data-task-board-styles>\n${css.trimEnd()}\n  </style>`)
  .replace("<!-- TASK_BOARD_SCRIPT -->", `<script data-task-board-script>\n${script.trimEnd()}\n  </script>`);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");

const websiteCopy = path.join(root, "website", "task-board.html");
await mkdir(path.dirname(websiteCopy), { recursive: true });
await writeFile(websiteCopy, output, "utf8");

// Single source of version + size: APP_VERSION in the app is the truth, and
// the built file's own byte count is the real size. Stamp both into the
// landing page so its version chips and "N KB" can never drift or lie. The
// patterns (vX.Y.Z, "N KB", "N,NNN bytes") only ever match this metadata.
const version = (script.match(/APP_VERSION\s*=\s*["']([^"']+)["']/) || [])[1];
const bytes = Buffer.byteLength(output, "utf8");
const kb = Math.round(bytes / 1024);
const indexPath = path.join(root, "website", "index.html");
let index = await readFile(indexPath, "utf8");
if (version) {
  index = index
    .replace(/v\d+\.\d+\.\d+/g, `v${version}`)
    .replace(/\d+ KB/g, `${kb} KB`)
    .replace(/[\d,]+ bytes/g, `${bytes.toLocaleString("en-US")} bytes`);
  await writeFile(indexPath, index, "utf8");
  if (index.match(/v\d+\.\d+\.\d+/g).some((v) => v !== `v${version}`)) {
    throw new Error("landing page version stamp failed");
  }
}

console.log(`Built ${path.relative(root, outputPath)} (+ website copy) — v${version || "?"}, ${kb} KB`);
