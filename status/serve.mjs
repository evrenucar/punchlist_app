// Serves the live status board: wrapper page, the real app, and the shared
// state file that both Evren (through the board) and the agent (through the
// filesystem) read and write. Zero dependencies, like everything else here.
import { createServer } from "node:http";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const statusDir = fileURLToPath(new URL(".", import.meta.url));
const stateFile = join(statusDir, "status-board.json");
const chatFile = join(statusDir, "chat.jsonl");
const port = 4173;

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function appendChat(from, text) {
  const entry = { from, text, at: new Date().toISOString() };
  await appendFile(chatFile, JSON.stringify(entry) + "\n");
}

const routes = {
  "/": { file: join(statusDir, "index.html"), type: "text/html; charset=utf-8" },
  "/board": { file: join(statusDir, "..", "website", "task-board.html"), type: "text/html; charset=utf-8" },
  "/state": { file: stateFile, type: "application/json" },
};

createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  try {
    if (req.method === "POST" && pathname === "/state") {
      const parsed = JSON.parse(await readBody(req, 25_000_000)); // reject garbage before it clobbers the file
      delete parsed.identity; // tripwire: a signing keypair must never land in the shared file
      await writeFile(stateFile, JSON.stringify(parsed));
      res.writeHead(204).end();
      return;
    }
    if (req.method === "POST" && pathname === "/chat") {
      const message = JSON.parse(await readBody(req, 100_000));
      if (!["user", "agent", "system"].includes(message.from) || typeof message.text !== "string" || !message.text.trim()) {
        throw new SyntaxError("bad message");
      }
      await appendChat(message.from, message.text.trim());
      res.writeHead(204).end();
      return;
    }
    if (req.method === "POST" && pathname === "/intake") {
      await appendChat("system", "Braindump intake requested");
      res.writeHead(204).end();
      return;
    }
    if (req.method === "GET" && pathname === "/chat") {
      const data = await readFile(chatFile, "utf8").catch(() => "");
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end(data);
      return;
    }
    const route = req.method === "GET" ? routes[pathname] : null;
    if (!route) throw new Error("no route");
    const data = await readFile(route.file);
    res.writeHead(200, { "content-type": route.type, "cache-control": "no-store" });
    res.end(data);
  } catch (error) {
    res.writeHead(error instanceof SyntaxError ? 400 : 404, { "content-type": "text/plain" });
    res.end(error instanceof SyntaxError ? "body is not JSON" : "not found");
  }
}).listen(port, () => console.log(`status board on http://localhost:${port}/`));
