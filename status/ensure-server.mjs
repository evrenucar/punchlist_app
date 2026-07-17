// SessionStart hook target: make sure the status-board server is up, then
// remind the agent where the input channel lives. Safe to run repeatedly.
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const serveScript = fileURLToPath(new URL("./serve.mjs", import.meta.url));
let finished = false;

async function announceSession() {
  // the server may have spawned milliseconds ago — retry briefly
  for (let attempt = 0; attempt < 6; attempt++) {
    const ok = await fetch("http://localhost:4173/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "system", text: "New agent session started — the agent introduces itself here shortly" }),
    }).then((r) => r.ok).catch(() => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function done(message) {
  if (finished) return;
  finished = true;
  console.log(message);
  await announceSession();
  console.log(
    "Live development interface: http://localhost:4173/ — read docs/AGENT_INTERFACE.md before operating it. " +
    "Introduce yourself by name in its chat (node status/say.mjs), then check Agent_Active and the chat for instructions."
  );
  process.exit(0);
}

function start() {
  spawn(process.execPath, [serveScript], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  done("Status server started on http://localhost:4173/.");
}

const socket = connect({ port: 4173, host: "127.0.0.1" });
socket.setTimeout(500);
socket.on("connect", () => { socket.destroy(); done("Status server already running on http://localhost:4173/."); });
socket.on("error", start);
socket.on("timeout", () => { socket.destroy(); start(); });
