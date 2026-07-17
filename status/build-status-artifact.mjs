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

// Bake the active bar: the wrapper renders it from live state, the artifact can't.
const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const actives = [];
const walk = (tasks) => (tasks || []).forEach((t) => { if (t.active && !t.done) actives.push(t.text); walk(t.children); });
JSON.parse(state).groups.forEach((g) => walk(g.tasks));
if (actives.length) {
  header = header
    .replace('class="activebar idle"', 'class="activebar"')
    .replace(/<span id="active-items">[\s\S]*?<\/span><\/span>/,
      '<span id="active-items">' + actives.map(escapeHtml).join(" · ") + "</span>");
}
header = header.replace(
  /<span class="hint"[^>]*>[\s\S]*?<\/span>/,
  '<span class="hint">Published snapshot — the two-way interactive copy runs at localhost:4173 during work sessions; edits here don’t reach the agent and reset on reload.</span>'
);

// Static execution-thread SVG for the artifact: same model as the live graph
// (grill Q20), frozen at bake time. Colors ride the page's CSS variables.
function bakeGraphSvg(boardState) {
  const cols = [];
  const inbox = boardState.groups.find((g) => g.id === "group-inbox");
  if (!inbox) return "";
  const walkAll = (tasks, fn) => (tasks || []).forEach((t) => { fn(t); walkAll(t.children, fn); });
  const laneOf = (t) => (t.lane === "dev" ? "dev" : "app");
  const holder = inbox.tasks.find((t) => t.id === "task-agent-completed");
  (holder ? holder.children : []).filter((t) => t.completedAt)
    .sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1)).slice(-3)
    .forEach((t) => cols.push([{ text: t.text, kind: "done", lane: laneOf(t) }]));
  const actives = [];
  boardState.groups.forEach((g) => walkAll(g.tasks, (t) => { if (t.active && !t.done) actives.push(t); }));
  cols.push(actives.length ? actives.map((t) => ({ text: t.text, kind: "active", lane: laneOf(t) }))
    : [{ text: "idle — nothing active", kind: "idle" }]);
  const branchNodes = [];
  inbox.tasks.filter((t) => !t.done && t.id !== "task-agent-completed" && !t.active)
    .forEach((t) => {
      const node = { text: t.text, kind: "queue", lane: laneOf(t) };
      if (t.inserted) branchNodes.push(node); else cols.push([node]);
    });
  const dirA = boardState.groups.find((g) => g.id === "group-dir-a");
  const friction = dirA && dirA.tasks.find((t) => (t.text || "").startsWith("Friction list"));
  let forked = false;
  (friction ? friction.children : []).filter((p) => /^P\d/.test(p.text || "")).forEach((level) => {
    const open = (level.children || []).filter((c) => !c.done);
    if (!open.length) return;
    if (!forked) { cols.push(open.map((c) => ({ text: c.text, kind: "queue", lane: "app" }))); forked = true; }
    else cols.push([{ text: level.text + " (" + open.length + ")", kind: "bucket", lane: "app" }]);
  });
  const W = 190, H = 58, XSTEP = 240, YSTEP = 78, PAD = 20;
  const rows = Math.max(...cols.map((c) => c.length));
  let height = PAD * 2 + rows * YSTEP - 20;
  const mid = height / 2;
  const pos = cols.map((col, i) => col.map((node, j) => ({
    node, x: PAD + i * XSTEP, y: mid - (col.length * YSTEP - 20) / 2 + j * YSTEP,
  })));
  // Open branch below the main line: inserted items hang off the active node's
  // right side and just end (Evren's spec, 2026-07-17).
  const activePos = pos.flat().find((p) => p.node.kind === "active");
  const branchPos = [];
  if (branchNodes.length && activePos) {
    const startX = activePos.x + W + 44;
    const branchY = activePos.y + H + 48;
    branchNodes.forEach((node, i) => branchPos.push({ node, x: startX + i * XSTEP, y: branchY }));
    height = Math.max(height, branchY + H + PAD);
  }
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  let out = "";
  for (let i = 0; i < pos.length - 1; i++) {
    const from = pos[i], to = pos[i + 1];
    const pairs = from.length === 1 ? to.map((t) => [from[0], t])
      : to.length === 1 ? from.map((f) => [f, to[0]])
      : from.map((f, k) => [f, to[Math.min(k, to.length - 1)]]);
    pairs.forEach(([f, t]) => {
      const hot = f.node.kind === "active" || t.node.kind === "active";
      out += `<path d="M ${f.x + W} ${f.y + H / 2} C ${f.x + W + 30} ${f.y + H / 2}, ${t.x - 30} ${t.y + H / 2}, ${t.x} ${t.y + H / 2}" fill="none" stroke="${hot ? "#7c3aed" : "#8b948f"}" stroke-width="${hot ? 2.5 : 1.5}"/>`;
    });
  }
  branchPos.forEach(({ x, y }, i) => {
    const x1 = i === 0 ? activePos.x + W : branchPos[i - 1].x + W;
    const y1 = i === 0 ? activePos.y + H * 0.75 : branchPos[i - 1].y + H / 2;
    out += `<path d="M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x - 30} ${y + H / 2}, ${x} ${y + H / 2}" fill="none" stroke="#7c3aed" stroke-width="2.5"/>`;
  });
  pos.flat().concat(branchPos).forEach(({ node, x, y }) => {
    const stroke = node.kind === "active" ? "#7c3aed" : node.kind === "done" ? "#2d7d46" : "#8b948f";
    const dash = node.kind === "bucket" || node.kind === "idle" ? ' stroke-dasharray="5 4"' : "";
    const fill = node.kind === "active" ? "rgba(124,58,237,0.14)" : "var(--surface, #fff)";
    out += `<g><title>${esc(node.text)}</title><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="8" style="fill:${fill}" stroke="${stroke}" stroke-width="${node.kind === "active" ? 2 : 1}"${dash}/>`;
    const line1 = clip(node.text, 30);
    const line2 = node.text.length > 30 ? clip(node.text.slice(30).trim(), 30) : "";
    out += `<text x="${x + 10}" y="${y + 20}" font-size="11" fill="currentColor">${esc((node.kind === "done" ? "✓ " : "") + line1)}</text>`;
    if (line2) out += `<text x="${x + 10}" y="${y + 34}" font-size="11" fill="currentColor">${esc(line2)}</text>`;
    if (node.lane) out += `<text x="${x + 10}" y="${y + 50}" font-size="8.5" font-weight="700" letter-spacing="0.8" fill="${node.lane === "dev" ? "#246bfe" : "#d4a017"}">${node.lane === "dev" ? "DEVELOPMENT INTERFACE" : "APP"}</text>`;
    out += "</g>";
  });
  let width = PAD * 2 + (cols.length - 1) * XSTEP + W;
  if (branchPos.length) width = Math.max(width, branchPos[branchPos.length - 1].x + W + PAD);
  return `<div style="overflow-x:auto;margin-top:12px;border:1px solid var(--line);border-radius:8px;background:var(--bg)"><svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${out}</svg></div>`;
}

// Force-seed on every load so a republished snapshot always shows fresh data.
const seed = `<script>try{localStorage.setItem("scheduling-task-management-board-v1",${JSON.stringify(state)})}catch(e){}</script>`;
const seeded = app.replace(/<body([^>]*)>/, (match) => match + seed);
const srcdoc = seeded.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

await writeFile(
  out,
  `<title>Punchlist — Status Board</title>\n${style}\n${header}\n${bakeGraphSvg(JSON.parse(state))}\n<iframe class="artifact-frame" title="Punchlist status board" srcdoc="${srcdoc}"></iframe>\n`
);
console.log("wrote", out);
