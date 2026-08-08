import test from "node:test";
import assert from "node:assert/strict";
import {
  checkArtifactConsistency,
  extractAppVersion,
  formatReport,
} from "../scripts/preflight.mjs";

const artifact = (version) => `<!doctype html><script>const APP_VERSION = "${version}";</script>`;

 test("extractAppVersion reads the stamped single-file version", () => {
  assert.equal(extractAppVersion(artifact("1.5.44")), "1.5.44");
  assert.equal(extractAppVersion("no version here"), null);
});

test("checkArtifactConsistency passes matching generated copies and metadata", () => {
  const result = checkArtifactConsistency({
    outputHtml: artifact("1.5.44"),
    websiteHtml: artifact("1.5.44"),
    latestJson: { version: "1.5.44", download: "https://example.test/task-board.html" },
    landingHtml: '<div class="brand-ver">v1.5.44</div>',
  });
  assert.equal(result.ok, true);
  assert.equal(result.version, "1.5.44");
  assert.equal(result.checks, 4);
  assert.deepEqual(result.errors, []);
});

test("checkArtifactConsistency rejects stale copies and metadata", () => {
  const result = checkArtifactConsistency({
    outputHtml: artifact("1.5.44"),
    websiteHtml: artifact("1.5.43"),
    latestJson: { version: "1.5.43" },
    landingHtml: '<div class="brand-ver">v1.5.43</div>',
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /website copy/);
  assert.match(result.errors.join("\n"), /latest\.json/);
  assert.match(result.errors.join("\n"), /landing page/);
});

test("formatReport makes the gate state copyable", () => {
  const report = formatReport({
    ok: true,
    version: "1.5.44",
    commit: "abc1234",
    tests: { command: "npm run test:all", ok: true },
    consistency: { ok: true, checks: 4 },
    safety: { ok: true, checks: ["no push", "no deploy"] },
  });
  assert.match(report, /PRE-FLIGHT PASS/);
  assert.match(report, /v1\.5\.44/);
  assert.match(report, /no push/);
});
