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
const prefsFile = join(statusDir, "prefs.json");
const port = 4173;
// Live agent registry for the execution graph. In-memory on purpose: entries
// expire after 90 s without a heartbeat, so restarts self-heal within a beat.
const agents = new Map();

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
  // real context numbers from the Claude Code statusline hook; 404 until a
  // session with the statusLine setting has run
  "/ctx": { file: join(statusDir, "ctx.json"), type: "application/json" },
  // served (not file://) so its send-feedback button can POST /chat same-origin
  "/testplan": { file: join(statusDir, "..", "docs", "touch-test-plan.html"), type: "text/html; charset=utf-8" },
  // codebase summary for Evren; agents refresh the file when the shape changes
  "/codebase": { file: join(statusDir, "codebase.html"), type: "text/html; charset=utf-8" },
  // mobile-behavior guide: one card per gesture with a comment box that POSTs
  // /chat same-origin (like /testplan). Keep in step with the app's touch spec.
  "/mobile-guide": { file: join(statusDir, "mobile-guide.html"), type: "text/html; charset=utf-8" },
  // interactive review pages: clickable answers + notes that POST /chat, all
  // generated from status/review-harness.template.html by build-review-pages.mjs
  "/focus-grill": { file: join(statusDir, "focus-grill.html"), type: "text/html; charset=utf-8" },
  "/update-overview": { file: join(statusDir, "update-overview.html"), type: "text/html; charset=utf-8" },
  "/graph-options": { file: join(statusDir, "graph-options.html"), type: "text/html; charset=utf-8" },
  "/priorities": { file: join(statusDir, "priorities.html"), type: "text/html; charset=utf-8" },
  // step-by-step recovery walkthrough for the 2026-07-21 sync data-loss incident
  "/recovery": { file: join(statusDir, "recovery.html"), type: "text/html; charset=utf-8" },
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
      const message = JSON.parse(await readBody(req, 4_000_000)); // images ride along as data URLs
      const img = typeof message.img === "string" && message.img.startsWith("data:image/") && message.img.length < 2_500_000
        ? message.img
        : null;
      if (!["user", "agent", "system"].includes(message.from) || typeof message.text !== "string" || (!message.text.trim() && !img)) {
        throw new SyntaxError("bad message");
      }
      const entry = { from: message.from, text: message.text.trim(), at: new Date().toISOString() };
      if (img) entry.img = img;
      if (message.question && Array.isArray(message.question.options)) {
        const options = message.question.options.filter((o) => typeof o === "string" && o.trim()).slice(0, 8);
        if (options.length >= 2) entry.question = { options, multi: Boolean(message.question.multi) };
      }
      if (typeof message.answerTo === "string") entry.answerTo = message.answerTo;
      await appendFile(chatFile, JSON.stringify(entry) + "\n");
      res.writeHead(204).end();
      return;
    }
    if (req.method === "POST" && pathname === "/agents") {
      const beat = JSON.parse(await readBody(req, 10_000));
      if (typeof beat.name !== "string" || !beat.name.trim()) throw new SyntaxError("bad agent");
      const name = beat.name.trim();
      if (beat.taskId === null) agents.delete(name);
      else if (typeof beat.taskId === "string") {
        const prev = agents.get(name);
        agents.set(name, {
          name,
          taskId: beat.taskId,
          at: Date.now(),
          // runtime = now - since; survives beats, resets when the task changes
          since: prev && prev.taskId === beat.taskId ? prev.since : Date.now(),
          status: typeof beat.status === "string" && beat.status.trim()
            ? beat.status.trim().slice(0, 120)
            : (prev && prev.taskId === beat.taskId ? prev.status : undefined),
        });
      } else throw new SyntaxError("bad agent");
      res.writeHead(204).end();
      return;
    }
    if (req.method === "GET" && pathname === "/agents") {
      const fresh = [...agents.values()].filter((a) => Date.now() - a.at < 90_000);
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(fresh));
      return;
    }
    if (req.method === "GET" && pathname === "/prefs") {
      const data = await readFile(prefsFile, "utf8").catch(() => "{}");
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(data);
      return;
    }
    if (req.method === "POST" && pathname === "/prefs") {
      const incoming = JSON.parse(await readBody(req, 10_000));
      const current = JSON.parse(await readFile(prefsFile, "utf8").catch(() => "{}"));
      for (const key of ["notifications", "fullAuto", "preferParallel"]) {
        if (typeof incoming[key] === "boolean") current[key] = incoming[key];
      }
      await writeFile(prefsFile, JSON.stringify(current, null, 2));
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
