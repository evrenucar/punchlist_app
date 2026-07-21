// Claude Code statusLine target: receives session JSON on stdin, prints the
// terminal status line, and drops the REAL context numbers into ctx.json for
// the status board's chat header. This is the only honest source of token
// numbers — page-side scripts can never see them, and we never fake them.
// Single-user by design: concurrent sessions last-writer-win the file.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ctxFile = fileURLToPath(new URL("./ctx.json", import.meta.url));

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let line = "punchlist";
try {
  const data = JSON.parse(raw);
  const ctx = data.context_window || {};
  const used = Math.round(ctx.used_percentage ?? 0);
  const model = data.model?.display_name || data.model?.id || "";
  const cost = data.cost?.total_cost_usd;
  // rate_limits (Claude Code 2.1.x): buckets like five_hour/seven_day, each
  // {used_percentage, resets_at (epoch seconds)}. Persisted wholesale so the
  // chat header can render any bucket the harness sends, present or future.
  const limits = data.rate_limits || null;
  await writeFile(ctxFile, JSON.stringify({
    usedPercentage: used,
    model,
    sessionId: data.session_id || null,
    rateLimits: limits,
    at: Date.now(),
  }));
  const fiveHour = limits?.five_hour?.used_percentage;
  line = [model, `ctx ${used}%`, cost != null ? `$${cost.toFixed(2)}` : null,
    fiveHour != null ? `5h ${Math.round(fiveHour)}%` : null]
    .filter(Boolean).join(" · ");
} catch {
  /* malformed stdin: keep the fallback line, write nothing */
}
process.stdout.write(line);
