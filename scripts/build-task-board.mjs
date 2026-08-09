import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src");
const outputPath = path.join(root, "outputs", "task-board.html");

// The app source is src/app/NN-name.js, concatenated in numeric order into the
// one script the product has always been. It is a CUT, not a rewrite: the parts
// were sliced out of the old single file without a line moving, so the built
// output did not change by a byte on the day it was split. There is no module
// system and no bundler; the pieces share one script scope exactly as before,
// which is why the order is fixed and why a part that RUNS things (25-app)
// comes last. Numbering is checked below so a gap or a duplicate cannot go
// unnoticed, and an editor's stray file cannot get into the build.
const PART_PATTERN = /^(\d\d)-[a-z0-9-]+\.js$/;

async function readAppScript() {
  const appDir = path.join(sourceDir, "app");
  const parts = (await readdir(appDir)).filter((name) => PART_PATTERN.test(name)).sort();
  if (!parts.length) throw new Error("no source parts found in src/app");
  parts.forEach((name, index) => {
    const number = Number(name.match(PART_PATTERN)[1]);
    if (number !== index + 1) throw new Error(`source parts are misnumbered at ${name}: expected ${String(index + 1).padStart(2, "0")}`);
  });
  const bodies = await Promise.all(parts.map((name) => readFile(path.join(appDir, name), "utf8")));
  return bodies.join("");
}

const [template, css, script] = await Promise.all([
  readFile(path.join(sourceDir, "task-board.html"), "utf8"),
  readFile(path.join(sourceDir, "task-board.css"), "utf8"),
  readAppScript(),
]);

if (!template.includes("<!-- TASK_BOARD_STYLES -->") || !template.includes("<!-- TASK_BOARD_SCRIPT -->")) {
  throw new Error("task-board template is missing build markers");
}

// Version: major.minor come from APP_VERSION in the app (edit that constant,
// or just say so, only for a milestone). The patch is automatic and RESETS at
// each milestone: it is the count of app-source commits since the major.minor
// last changed. So a bump to 1.6 restarts the patch at 1.6.0. execFileSync
// (no shell) keeps the -G pattern intact on Windows cmd too.
// src/task-board.js is the pre-split source and is listed on purpose: the patch
// counts commits, so dropping the path the app lived in until 2026-07-29 would
// make the version jump backwards the day it was split.
const appFiles = ["src/app", "src/task-board.js", "src/task-board.css", "src/task-board.html", "src/sw.js", "src/manifest.webmanifest"];
const base = (script.match(/APP_VERSION\s*=\s*["'](\d+\.\d+)/) || [])[1];
let patch = 0;
try {
  const git = (args) => execFileSync("git", args, { cwd: root }).toString().trim();
  // the commit that set the current major.minor; before that bump is committed
  // there is no anchor yet, which correctly leaves the patch at 0 (X.Y.0).
  // --diff-filter=M is load-bearing, learned on 2026-07-29: the source split
  // ADDED a file already containing `APP_VERSION = "1.5.0"`, which reads to a
  // plain -G exactly like a fresh milestone bump. The anchor jumped to the
  // split, the count fell to zero, and the build cheerfully stamped v1.5.0 onto
  // a v1.5.40 app. A bump MODIFIES the constant; a move only adds it.
  const anchor = base
    ? git(["log", "-1", "--format=%H", "-G", `APP_VERSION.*"${base.replace(/\./g, "\\.")}`, "--diff-filter=M", "--", "src/app/01-constants.js", "src/task-board.js"])
    : "";
  if (anchor) {
    patch = parseInt(git(["rev-list", "--count", `${anchor}..HEAD`, "--", ...appFiles]), 10) || 0;
  }
} catch { patch = 0; }
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

const [serviceWorkerSource, manifestSource] = await Promise.all([
  readFile(path.join(sourceDir, "sw.js"), "utf8"),
  readFile(path.join(sourceDir, "manifest.webmanifest"), "utf8"),
]);
await writeFile(path.join(root, "website", "sw.js"), serviceWorkerSource.replaceAll("__PUNCHLIST_VERSION__", version || "dev"), "utf8");
await writeFile(path.join(root, "website", "manifest.webmanifest"), manifestSource, "utf8");

// The update channel (task-aud-4-2gmn): a downloaded copy compares itself
// against THIS file instead of GitHub Releases, so every build tells old
// copies about itself, not just the milestones Evren cuts by hand. Pulled
// from the same constants the app itself uses (LATEST_BUILD_URL,
// UPDATE_NOTES_URL) rather than duplicating the URLs as fresh literals here.
const latestBuildUrl = (script.match(/LATEST_BUILD_URL\s*=\s*["']([^"']+)["']/) || [])[1];
const notesUrl = (script.match(/UPDATE_NOTES_URL\s*=\s*["']([^"']+)["']/) || [])[1];
if (!version || !latestBuildUrl || !notesUrl) {
  throw new Error("latest.json stamp failed: version, LATEST_BUILD_URL, or UPDATE_NOTES_URL missing");
}
const latestJsonPath = path.join(root, "website", "latest.json");
await writeFile(
  latestJsonPath,
  `${JSON.stringify({ version, download: `${latestBuildUrl}task-board.html`, notes: notesUrl }, null, 2)}\n`,
  "utf8"
);

// The development interface renders its board pane from a BUILT app file, and
// it takes the project's own pinned copy ahead of the one vendored beside the
// tool. Once the tool lives in a separate checkout, that vendored copy is the
// only thing it would find, and nothing refreshes it — the pane would silently
// freeze on whatever build shipped with the tool. Writing the pin here means
// the pane can never lag the build. Gitignored: it is a generated duplicate.
const statusDir = path.join(root, "status");
if (existsSync(statusDir)) await writeFile(path.join(statusDir, "board.html"), output, "utf8");

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

// The same treatment for the hand-written docs, because they drifted badly:
// on 2026-07-29 the README claimed 340 KB and DIRECTIONS.md claimed 267 KB
// while the file was 423. A number a human has to remember to update is a
// number that lies, and these two are the first thing a stranger reads.
for (const doc of ["README.md", path.join("docs", "DIRECTIONS.md")]) {
  const docPath = path.join(root, doc);
  if (!existsSync(docPath)) continue;
  const before = await readFile(docPath, "utf8");
  const after = before.replace(/\b\d+ KB\b/g, `${kb} KB`);
  if (after !== before) await writeFile(docPath, after, "utf8");
}

console.log(`Built ${path.relative(root, outputPath)} (+ website copy) — v${version || "?"}, ${kb} KB`);
