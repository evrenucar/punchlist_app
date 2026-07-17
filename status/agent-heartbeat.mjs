// Register an agent on the status graph and keep its heartbeat fresh.
// Entries expire server-side after 90 s without a beat, so a killed process
// self-heals off the graph. The server tracks runtime from first registration.
// Usage: node status/agent-heartbeat.mjs <name> <taskId> [status text...]
//        node status/agent-heartbeat.mjs <name> --stop     (deregister now)
// Re-running with the same name and task updates the status without resetting
// the runtime clock.
const [name, taskId, ...statusWords] = process.argv.slice(2);
if (!name || !taskId) {
  console.error("usage: node status/agent-heartbeat.mjs <name> <taskId|--stop> [status...]");
  process.exit(1);
}
const status = statusWords.join(" ").trim() || undefined;
const post = (tid) => fetch("http://localhost:4173/agents", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name, taskId: tid, status }),
}).catch(() => null);

if (taskId === "--stop") {
  await post(null);
  console.log("deregistered", name);
  process.exit(0);
}
await post(taskId);
console.log("heartbeat started:", name, "on", taskId, status ? "(" + status + ")" : "");
setInterval(() => post(taskId), 30_000);
