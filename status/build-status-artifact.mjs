// Bakes the hosted-artifact snapshot of the status board: the wrapper header
// plus the real app embedded via srcdoc, seeded from status-board.json.
// Usage: node status/build-status-artifact.mjs <output.html>
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const statusDir = fileURLToPath(new URL(".", import.meta.url));
const out = process.argv[2];
if (!out) {
  console.error("usage: node status/build-status-artifact.mjs <output.html>");
  process.exit(1);
}

const index = await readFile(join(statusDir, "index.html"), "utf8");
const app = await readFile(join(statusDir, "..", "website", "task-board.html"), "utf8");
const state = await readFile(join(statusDir, "status-board.json"), "utf8");

const style = index.slice(index.indexOf("<style>"), index.indexOf("</style>") + "</style>".length);
let header = index.slice(index.indexOf("<!-- header:start -->"), index.indexOf("<!-- header:end -->"));
header = header.split("\n").filter((line) => !line.includes("data-local-only")).join("\n");
header = header.replace(
  /<span class="hint"[^>]*>[\s\S]*?<\/span>/,
  '<span class="hint">Published snapshot — the two-way interactive copy runs at localhost:4173 during work sessions; edits here don’t reach the agent and reset on reload.</span>'
);

// Force-seed on every load so a republished snapshot always shows fresh data.
const seed = `<script>try{localStorage.setItem("scheduling-task-management-board-v1",${JSON.stringify(state)})}catch(e){}</script>`;
const seeded = app.replace(/<body([^>]*)>/, (match) => match + seed);
const srcdoc = seeded.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

await writeFile(
  out,
  `<title>Punchlist — Status Board</title>\n${style}\n${header}\n<iframe class="artifact-frame" title="Punchlist status board" srcdoc="${srcdoc}"></iframe>\n`
);
console.log("wrote", out);
