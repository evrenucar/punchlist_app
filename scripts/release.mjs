// Create a GitHub release for the current version. Run at a milestone, after
// bumping the major.minor and committing. It builds fresh, then tags vX.Y.Z
// (gh makes the tag at HEAD), attaches the single-file app nicely named, and
// points the notes at the hosted build notes, which are the real changelog.
//
//   node scripts/release.mjs
//
// Needs gh installed and logged in (gh auth login).
import { execFileSync } from "node:child_process";
import { readFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, opts = {}) => {
  const out = execFileSync(cmd, args, { cwd: root, ...opts });
  return out ? out.toString().trim() : ""; // stdio:"inherit" returns null
};

// gh is not always on PATH right after a winget install; fall back to the
// standard install location.
const ghPath = ["gh", "C:/Program Files/GitHub CLI/gh.exe"].find((p) => {
  try { execFileSync(p, ["--version"], { stdio: "ignore" }); return true; } catch { return false; }
});
if (!ghPath) {
  console.error("gh CLI not found. Install it, then run: gh auth login");
  process.exit(1);
}
const gh = (args, opts) => run(ghPath, args, opts);

// fresh build so the version and the attached file are current
run("node", ["scripts/build-task-board.mjs"], { stdio: "inherit" });
const built = readFileSync(path.join(root, "website", "task-board.html"), "utf8");
const version = (built.match(/APP_VERSION = "([^"]+)"/) || [])[1];
if (!version) { console.error("no APP_VERSION found in the build"); process.exit(1); }
const tag = `v${version}`;

// don't clobber an existing release
try { gh(["release", "view", tag], { stdio: "ignore" }); console.error(`${tag} already released`); process.exit(1); } catch { /* not released yet, good */ }

// download the file under a clear name instead of the internal task-board.html
const assetPath = path.join(root, "outputs", `punchlist-${version}.html`);
copyFileSync(path.join(root, "website", "task-board.html"), assetPath);

const notes = `Punchlist ${tag} — the whole app is one HTML file, attached below. Open it in any browser, no install.\n\nFull build notes: https://evrenucar.github.io/punchlist_app/notes.html`;
gh(["release", "create", tag, assetPath, "--title", `Punchlist ${tag}`, "--notes", notes], { stdio: "inherit" });
console.log(`Released ${tag} with the single-file app attached.`);
