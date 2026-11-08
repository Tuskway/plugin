import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  requiredSkills,
  skillSetErrors,
  versionReport,
} from "./package-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("eight current skills pass and sync-design may be added", () => {
  assert.deepEqual(skillSetErrors(requiredSkills), []);
  assert.deepEqual(skillSetErrors([...requiredSkills, "sync-design-tuskway"].sort()), []);
  assert.deepEqual(skillSetErrors(requiredSkills.filter((name) => name !== "plan-tuskway")), [
    "missing plan-tuskway",
  ]);
  assert.deepEqual(skillSetErrors([...requiredSkills, "ship-tuskway"]), [
    "unexpected ship-tuskway",
  ]);
});

test("the real package has the eight skills and no version drift", () => {
  const report = versionReport(root);
  assert.equal(report.canonical, "0.1.0");
  assert.deepEqual(report.drift, []);
  assert.deepEqual(skillSetErrors(
    ["comments-tuskway", "draft-tickets-tuskway", "plan-tuskway", "setup-tuskway", "start-epic-tuskway", "tackle-ticket-tuskway", "tracker-changes-tuskway", "write-design-tuskway"],
  ), []);
  const listed = execFileSync("node", ["scripts/sync.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  const parsed = JSON.parse(listed);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.version, "0.1.0");
  assert.equal(parsed.unversioned.includes(".agents/plugins/marketplace.json"), true);
});

test("sync --check rejects a drifted version and does not rewrite", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-sync-"));
  try {
    const pluginDir = path.join(dir, "plugins/tuskway");
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(path.join(pluginDir, "plugin.json"), "{\"version\":\"0.1.0\"}\n");
    writeFileSync(path.join(dir, "package.json"), "{\"version\":\"9.9.9\"}\n");
    for (const relative of [
      "plugins/tuskway/.claude-plugin/plugin.json",
      "plugins/tuskway/.cursor-plugin/plugin.json",
      "plugins/tuskway/.codex-plugin/plugin.json",
      ".grok-plugin/plugin.json",
      ".claude-plugin/marketplace.json",
      ".cursor-plugin/marketplace.json",
    ]) {
      mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
      const body = relative.endsWith("marketplace.json")
        ? "{\"plugins\":[{\"version\":\"0.1.0\"}]}\n"
        : "{\"version\":\"0.1.0\"}\n";
      writeFileSync(path.join(dir, relative), body);
    }
    let failed = false;
    try {
      execFileSync("node", ["scripts/sync.mjs", "--check", "--root", dir], {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      failed = true;
      assert.equal(error.status, 1);
      assert.match(error.stderr, /9\.9\.9/);
    }
    assert.equal(failed, true);
    assert.equal(
      readFileSync(path.join(dir, "package.json"), "utf8"),
      "{\"version\":\"9.9.9\"}\n",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validate reports structural pass and live client checks as not run", () => {
  const stdout = execFileSync("node", ["scripts/validate.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  const report = JSON.parse(stdout);
  assert.equal(report.structure, "pass");
  assert.equal(report.manifestTests >= 8, true);
  assert.equal(report.liveAcceptance, "NOT RUN");
  assert.equal(report.skills.count, 8);
  assert.deepEqual(report.skills.optionalAbsent, ["sync-design-tuskway"]);
  assert.equal(report.versionDrift.length, 0);
  assert.equal(report.claudePluginValidate.status, "UNAVAILABLE");
  assert.equal(report.release.autoTag, false);
  assert.equal(report.clients.length, 7);
  for (const client of report.clients) {
    for (const check of ["install", "discovery", "resources", "mcp", "oauth", "update", "workflow", "routing"]) {
      assert.equal(client[check], "NOT RUN", client.client);
    }
  }
  assert.equal(report.ci.hostedRuns, false);
});

test("the workflow does not start a GitHub-hosted runner", () => {
  const text = readFileSync(path.join(root, ".github/workflows/plugin.yml"), "utf8");
  assert.equal(text.includes("ubuntu-latest"), false);
  assert.equal(text.includes("pull_request"), false);
  assert.equal(/^\s*push:/m.test(text), false);
  assert.match(text, /workflow_dispatch/);
  assert.match(text, /self-hosted/);
  assert.match(text, /node --test scripts\/test-plugin\.mjs/);
  assert.match(text, /node scripts\/sync\.mjs --check/);
  assert.match(text, /node scripts\/validate\.mjs/);
});

test("validation does not require prose parity", () => {
  const sources = ["package-contract.mjs", "sync.mjs", "validate.mjs"]
    .map((name) => readFileSync(path.join(root, "scripts", name), "utf8"))
    .join("\n");
  assert.equal(/body-sha256|generated-from|prose parity|description parity/i.test(sources), false);
});
