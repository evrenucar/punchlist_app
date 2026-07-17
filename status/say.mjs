// Post a chat message to the status board as the agent.
// Usage: node status/say.mjs <message...>
const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error("usage: node status/say.mjs <message>");
  process.exit(1);
}
const response = await fetch("http://localhost:4173/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ from: "agent", text }),
}).catch(() => null);
console.log(response && response.ok ? "sent" : "failed — is the status server up?");
