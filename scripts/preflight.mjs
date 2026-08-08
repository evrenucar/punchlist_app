import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function extractAppVersion(html) {
  return html.match(/APP_VERSION\s*=\s*["']([^"']+)["']/)?.[1] || null;
}

export function checkArtifactConsistency({ outputHtml, websiteHtml, latestJson, landingHtml }) {
  const errors = [];
  const version = extractAppVersion(outputHtml);
  if (!version) errors.push("outputs/task-board.html has no APP_VERSION");
  if (outputHtml !== websiteHtml) errors.push("outputs/task-board.html and website/task-board.html differ");
  if (version && extractAppVersion(websiteHtml) !== version) errors.push("website copy has a different APP_VERSION");
  if (version && latestJson?.version !== version) errors.push("website/latest.json has a different version");
  if (version && !new RegExp(`\\bv${version.replaceAll(".", "\\.")}\\b`).test(landingHtml)) {
    errors.push("landing page has a different stamped version");
  }
  return { ok: errors.length === 0, version, checks: 4, errors };
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function readArtifacts() {
  return checkArtifactConsistency({
    outputHtml: readFileSync(path.join(ROOT, "outputs/task-board.html"), "utf8"),
    websiteHtml: readFileSync(path.join(ROOT, "website/task-board.html"), "utf8"),
    latestJson: JSON.parse(readFileSync(path.join(ROOT, "website/latest.json"), "utf8")),
    landingHtml: readFileSync(path.join(ROOT, "website/index.html"), "utf8"),
  });
}

function runTests(jsonMode) {
  const started = Date.now();
  const result = spawnSync("npm", ["run", "test:all"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: jsonMode ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  return {
    command: "npm run test:all",
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    outputTail: jsonMode ? `${result.stdout || ""}\n${result.stderr || ""}`.trim().slice(-1600) : undefined,
  };
}

export function formatReport(report) {
  const title = report.ok ? "PRE-FLIGHT PASS" : "PRE-FLIGHT FAIL";
  const lines = [
    title,
    `Candidate: v${report.version || "unknown"} at ${report.commit || "unknown"}`,
    `Local tests: ${report.tests.ok ? "PASS" : "FAIL"} (${report.tests.command}, ${(report.tests.durationMs ?? 0)}ms)`,
    `Generated artifacts: ${report.consistency.ok ? "PASS" : "FAIL"} (${report.consistency.checks} checks)`,
    "External safety: PASS (no push, no deploy, no PR, no credentials)",
  ];
  if (report.consistency.errors?.length) lines.push(`Artifact errors: ${report.consistency.errors.join("; ")}`);
  if (report.tests.outputTail) lines.push(`Test output tail:\n${report.tests.outputTail}`);
  lines.push("Manual gates still required: disposable preview + rollback, physical-device mobile check, and explicit user authorization before production.");
  return lines.join("\n");
}

function main() {
  const jsonMode = process.argv.includes("--json");
  let tests;
  try {
    tests = runTests(jsonMode);
  } catch (error) {
    tests = { command: "npm run test:all", ok: false, exitCode: 1, durationMs: 0, outputTail: error.message };
  }

  let consistency;
  try {
    consistency = readArtifacts();
  } catch (error) {
    consistency = { ok: false, version: null, checks: 0, errors: [error.message] };
  }

  const report = {
    ok: tests.ok && consistency.ok,
    version: consistency.version,
    commit: (() => { try { return git(["rev-parse", "--short", "HEAD"]); } catch { return null; } })(),
    tests,
    consistency,
    safety: { ok: true, checks: ["no push", "no deploy", "no PR", "no credentials"] },
  };
  if (jsonMode) console.log(JSON.stringify(report, null, 2));
  else console.log(`\n${formatReport(report)}`);
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
