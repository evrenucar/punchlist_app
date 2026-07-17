// SessionStart hook target: make sure the status-board server is up, then
// remind the agent where the input channel lives. Safe to run repeatedly.
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const serveScript = fileURLToPath(new URL("./serve.mjs", import.meta.url));
let finished = false;

function done(message) {
  if (finished) return;
  finished = true;
  console.log(message);
  console.log(
    'Live status board: http://localhost:4173/ — state file status/status-board.json is two-way. ' +
    'Read it before writing (Evren edits it from the browser); tasks in the "To Claude" group are direct instructions.'
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
