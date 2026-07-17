// Post a question to the status-board chat with tappable answer buttons.
// Single-select: a tap sends the answer. Multi (--multi): toggles + note + send.
// Usage: node status/ask.mjs [--multi] "Question text" "Option 1" "Option 2" [...]
const args = process.argv.slice(2);
const multi = args[0] === "--multi";
if (multi) args.shift();
const [text, ...options] = args;
if (!text || options.length < 2) {
  console.error('usage: node status/ask.mjs [--multi] "Question" "Option 1" "Option 2" [...]');
  process.exit(1);
}
const response = await fetch("http://localhost:4173/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ from: "agent", text, question: { options, multi } }),
}).catch(() => null);
console.log(response && response.ok ? "asked" : "failed — is the status server up?");
