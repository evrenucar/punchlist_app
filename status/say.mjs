// Post a chat message to the status board as the agent.
// Usage: node status/say.mjs [--img <path>] <message...>
// Links in the text render clickable; --img attaches an image (png/jpg/webp).
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const raw = process.argv.slice(2);
let imgPath = null;
const words = [];
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === "--img") { imgPath = raw[++i]; continue; }
  words.push(raw[i]);
}
const text = words.join(" ").trim();
if (!text) {
  console.error("usage: node status/say.mjs [--img <path>] <message>");
  process.exit(1);
}
const body = { from: "agent", text };
if (imgPath) {
  const buf = await readFile(imgPath);
  const ext = extname(imgPath).slice(1).toLowerCase();
  body.img = `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${buf.toString("base64")}`;
}
const response = await fetch("http://localhost:4173/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}).catch(() => null);
console.log(response && response.ok ? "sent" : "failed — is the status server up?");
