// Shared board-write helper: agent edits flow like another user sharing the
// board (Evren's spec, 2026-07-19) — same quiet-window protocol, same history
// trail, attributed to an agent device the app's History panel can name.
// Usage from a script:
//   import { readBoard, writeBoard } from "./board-write.mjs";
//   const board = await readBoard();
//   ...mutate board...
//   await writeBoard(board, "Marked the touch batch done");
// writeBoard THROWS when Evren edited within the last 8s — wait and retry.
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const boardFile = fileURLToPath(new URL("./status-board.json", import.meta.url));
export const AGENT_DEVICE_ID = "device-agent-claude";

export async function readBoard() {
  return JSON.parse(await readFile(boardFile, "utf8"));
}

export async function writeBoard(board, historyText, { agentName = "Claude", kind = "board" } = {}) {
  const age = Date.now() - (await stat(boardFile)).mtimeMs;
  if (age < 8000) throw new Error(`board not quiet (${Math.round(age)}ms old)`);
  if (!board.devices || typeof board.devices !== "object" || Array.isArray(board.devices)) board.devices = {};
  board.devices[AGENT_DEVICE_ID] = { name: agentName, lastSeenAt: new Date().toISOString() };
  if (historyText) {
    if (!Array.isArray(board.history)) board.history = [];
    board.history.push({ at: new Date().toISOString(), text: String(historyText), kind, deviceId: AGENT_DEVICE_ID });
    while (board.history.length > 50) board.history.shift();
  }
  await writeFile(boardFile, JSON.stringify(board));
}
