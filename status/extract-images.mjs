// Dump images embedded in status-board tasks to files so the agent can view them.
// Usage: node status/extract-images.mjs <task text or id substring> <output dir>
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const [needle, outDir] = process.argv.slice(2);
if (!needle || !outDir) {
  console.error("usage: node status/extract-images.mjs <substring> <outdir>");
  process.exit(1);
}
const stateFile = fileURLToPath(new URL("./status-board.json", import.meta.url));
const state = JSON.parse(await readFile(stateFile, "utf8"));

const hits = [];
const walk = (tasks) => (tasks || []).forEach((t) => {
  if (((t.text || "") + t.id).toLowerCase().includes(needle.toLowerCase()) && (t.images || []).length) hits.push(t);
  walk(t.children);
});
state.groups.forEach((g) => walk(g.tasks));

if (!hits.length) { console.log("no matching tasks with images"); process.exit(0); }
await mkdir(outDir, { recursive: true });
for (const task of hits) {
  for (const [i, img] of task.images.entries()) {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(img.src);
    if (!match) continue;
    const file = join(outDir, `${task.id}-${i}.${match[1] === "jpeg" ? "jpg" : match[1]}`);
    await writeFile(file, Buffer.from(match[2], "base64"));
    console.log(file + (img.caption ? "  caption: " + img.caption : "") + '  from task: "' + (task.text || "").slice(0, 60) + '"');
  }
}
