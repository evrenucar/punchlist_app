import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
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

// Version: major.minor come from APP_VERSION in the app (edit that constant,
// or just say so, only for a milestone). The patch is automatic — the count
// of commits that have ever touched the app source — so it climbs on its own
// and nothing needs typing per build. It is a global build number, so it does
// not reset at a minor bump (1.5.65 -> milestone -> 1.6.66).
const base = (script.match(/APP_VERSION\s*=\s*["'](\d+\.\d+)/) || [])[1];
let patch = 0;
try {
  patch = parseInt(execSync(
    "git rev-list --count HEAD -- src/task-board.js src/task-board.css src/task-board.html",
    { cwd: root },
  ).toString().trim(), 10) || 0;
} catch { /* no git available: patch stays 0, still a valid version */ }
const version = base ? `${base}.${patch}` : null;

// stamp the computed version into the app itself so its topbar shows it
const stampedScript = version
  ? script.replace(/(APP_VERSION\s*=\s*)["'][^"']+["']/, `$1"${version}"`)
  : script;

const output = template
  .replace("<!-- TASK_BOARD_STYLES -->", `<style data-task-board-styles>\n${css.trimEnd()}\n  </style>`)
  .replace("<!-- TASK_BOARD_SCRIPT -->", `<script data-task-board-script>\n${stampedScript.trimEnd()}\n  </script>`);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");

const websiteCopy = path.join(root, "website", "task-board.html");
await mkdir(path.dirname(websiteCopy), { recursive: true });
await writeFile(websiteCopy, output, "utf8");

// Stamp the same version and the built file's real byte count into the landing
// page so its version chips and "N KB" can never drift or lie. The patterns
// (vX.Y.Z, "N KB", "N,NNN bytes") only ever match this metadata.
const bytes = Buffer.byteLength(output, "utf8");
const kb = Math.round(bytes / 1024);
const indexPath = path.join(root, "website", "index.html");
if (version) {
  let index = await readFile(indexPath, "utf8");
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
