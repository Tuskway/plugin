import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  clientChecks,
  clientRows,
  outcomeRows,
  parseRecorded,
  recordedProblems,
  packageContentErrors,
  requiredSkills,
  skillNames,
  skillSetErrors,
  versionFiles,
  versionReport,
  workflowErrors,
} from "./package-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validSkill = `---
name: sync-design-tuskway
description: Compares merged work with the design. Use when the user asks to sync the design after a merge; not for implementing tickets.
license: MIT
---

# Sync

See [target](references/target.md).
`;

function stagePackage() {
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-package-"));
  cpSync(
    path.join(root, "plugins/tuskway/skills"),
    path.join(dir, "plugins/tuskway/skills"),
    { recursive: true },
  );
  for (const relative of versionFiles) {
    const target = path.join(dir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(root, relative), target);
  }
  return dir;
}

function writeSkill(dir, body) {
  const skillDir = path.join(dir, "plugins/tuskway/skills/sync-design-tuskway");
  mkdirSync(path.join(skillDir, "references"), { recursive: true });
  writeFileSync(path.join(skillDir, "references/target.md"), "# Target\n");
  writeFileSync(path.join(skillDir, "SKILL.md"), body);
  return path.join(skillDir, "SKILL.md");
}

function validate(dir) {
  const ran = spawnSync("node", ["scripts/validate.mjs", "--root", dir], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: ran.status, report: JSON.parse(ran.stdout) };
}

function assertNotRun(report) {
  assert.equal(report.liveAcceptance, "NOT RUN");
  assert.equal(report.versionBump, "NOT RUN");
  assert.equal(report.clients.length, 7);
  for (const client of report.clients) {
    assert.notEqual(client.binary, "pass");
    for (const check of clientChecks) assert.equal(client[check], "NOT RUN", client.client);
  }
}

function assertPathProbe(report) {
  assert.equal(report.pathProbe.length, 7);
  for (const client of report.pathProbe) {
    for (const check of clientChecks) assert.equal(client[check], "NOT RUN", client.client);
  }
}

test("nine skills are required and an absent canonical skill fails", () => {
  assert.equal(requiredSkills.includes("sync-design-tuskway"), true);
  assert.equal(requiredSkills.length, 9);
  assert.deepEqual(skillSetErrors(requiredSkills), []);
  assert.deepEqual(skillSetErrors(requiredSkills.filter((name) => name !== "sync-design-tuskway")), [
    "missing sync-design-tuskway",
  ]);
  assert.deepEqual(skillSetErrors([...requiredSkills, "ship-tuskway"]), [
    "unexpected ship-tuskway",
  ]);
});

test("the checkout skills and versions are the files on disk", () => {
  const report = versionReport(root);
  assert.equal(report.canonical, "0.1.0");
  assert.deepEqual(report.drift, []);
  assert.deepEqual(skillNames(root), requiredSkills);
  assert.deepEqual(packageContentErrors(root), []);
  const listed = execFileSync("node", ["scripts/sync.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  const parsed = JSON.parse(listed);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.version, "0.1.0");
  assert.equal(parsed.unversioned.includes(".agents/plugins/marketplace.json"), true);
});

test("sync --check rejects drift and invalid json without rewriting or tagging", () => {
  const before = execFileSync("git", ["tag", "--list", "plugin-v*"], { cwd: root, encoding: "utf8" });
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-sync-"));
  try {
    const pluginDir = path.join(dir, "plugins/tuskway");
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(path.join(pluginDir, "plugin.json"), "{\"version\":\"0.1.0\"}\n");
    writeFileSync(path.join(dir, "package.json"), "{\"version\":\"9.9.9\"}\n");
    for (const relative of versionFiles) {
      if (relative === "plugins/tuskway/plugin.json" || relative === "package.json") continue;
      mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
      const body = relative.endsWith("marketplace.json")
        ? "{\"plugins\":[{\"version\":\"0.1.0\"}]}\n"
        : "{\"version\":\"0.1.0\"}\n";
      writeFileSync(path.join(dir, relative), body);
    }
    const drifted = spawnSync("node", ["scripts/sync.mjs", "--check", "--root", dir], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(drifted.status, 1);
    assert.match(drifted.stderr, /9\.9\.9/);
    assert.equal(readFileSync(path.join(dir, "package.json"), "utf8"), "{\"version\":\"9.9.9\"}\n");

    writeFileSync(path.join(dir, "package.json"), "{\"version\":\"0.1.0\"\n");
    const broken = spawnSync("node", ["scripts/sync.mjs", "--check", "--root", dir], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(broken.status, 1);
    assert.equal(readFileSync(path.join(dir, "package.json"), "utf8"), "{\"version\":\"0.1.0\"\n");

    const refused = spawnSync("node", ["scripts/sync.mjs", "--root", dir], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /does not rewrite/);
    assert.equal(
      execFileSync("git", ["tag", "--list", "plugin-v*"], { cwd: root, encoding: "utf8" }),
      before,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validate fails a broken skill and accepts a valid ninth skill", () => {
  const dir = stagePackage();
  const original = readFileSync(
    path.join(root, "plugins/tuskway/skills/plan-tuskway/SKILL.md"),
    "utf8",
  );
  try {
    rmSync(path.join(dir, "plugins/tuskway/skills/sync-design-tuskway"), { recursive: true, force: true });
    const absent = validate(dir);
    assert.equal(absent.status, 1);
    assert.equal(absent.report.structure, "fail");
    assert.equal(absent.report.contentErrors.includes("missing sync-design-tuskway"), true);
    assertNotRun(absent.report);

    const skillPath = writeSkill(dir, validSkill.replace("name: sync-design-tuskway", "name: other-tuskway"));
    const renamed = validate(dir);
    assert.equal(renamed.status, 1);
    assert.equal(renamed.report.structure, "fail");
    assert.equal(renamed.report.manifestSuite, "not applied");
    assertNotRun(renamed.report);
    assert.equal(renamed.report.contentErrors.some((error) => error.includes("frontmatter name")), true);

    writeSkill(dir, validSkill.replace("references/target.md", "references/missing.md"));
    const missing = validate(dir);
    assert.equal(missing.status, 1);
    assert.equal(missing.report.contentErrors.some((error) => error.includes("missing resource")), true);
    assertNotRun(missing.report);

    writeSkill(dir, `${validSkill}\nTODO: fill this in.\n`);
    const placeholder = validate(dir);
    assert.equal(placeholder.status, 1);
    assert.equal(placeholder.report.contentErrors.some((error) => error.includes("placeholder")), true);

    writeSkill(dir, validSkill + "x".repeat(8000));
    const oversized = validate(dir);
    assert.equal(oversized.status, 1);
    assert.equal(oversized.report.contentErrors.some((error) => error.includes("bytes")), true);

    writeFileSync(skillPath, validSkill);
    const accepted = validate(dir);
    assert.equal(accepted.status, 0, accepted.report.contentErrors.join("\n"));
    assert.equal(accepted.report.structure, "pass");
    assert.equal(accepted.report.skills.count, 9);
    assert.deepEqual(accepted.report.skills.optionalAbsent, []);
    assert.equal(accepted.report.manifestSuite, "not applied");
    assert.equal(accepted.report.claudePluginValidate.status, "NOT RUN");
    assertNotRun(accepted.report);
    assert.equal(
      readFileSync(path.join(root, "plugins/tuskway/skills/plan-tuskway/SKILL.md"), "utf8"),
      original,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a recorded routing or oauth pass is rejected", () => {
  const names = ["Claude Code", "Cursor", "Codex", "Copilot CLI", "Grok Build", "OpenCode", "Pi"];
  const sample = {
    clients: names.map((client) => ({
      client,
      oauth: { status: "blocked" },
      workflow: { status: "NOT RUN" },
      routing: { status: "NOT RUN" },
      mcp: "NOT RUN",
    })),
  };
  assert.deepEqual(recordedProblems(sample), []);
  sample.clients[0].routing = { status: "pass" };
  assert.equal(recordedProblems(sample).some((error) => error.includes("routing")), true);
  sample.clients[0].routing = "NOT RUN";
  sample.clients[0].discovery = "pass";
  sample.clients[0].discoveryDetail = "The plugin was enabled.";
  assert.equal(recordedProblems(sample).some((error) => error.includes("skill names")), true);
  sample.clients[4].pluginCommand = "grok plugin install <repo> --trust";
  assert.equal(recordedProblems(sample).some((error) => error.includes("default command")), true);
  assert.deepEqual(parseRecorded("{"), {
    data: null,
    errors: ["recorded client checks are not valid json"],
  });
});

test("recorded install and discovery stay distinct from the path probe", () => {
  const rows = outcomeRows([
    { client: "Claude Code", version: "1", install: "pass", discovery: "pass", pluginInstall: "pass" },
    { client: "Cursor", install: "pass", pluginInstall: "blocked", oauth: "waiting", routing: "pass" },
  ]);
  assert.equal(rows[0].install, "pass");
  assert.equal(rows[0].discovery, "pass");
  assert.equal(rows[0].routing, "NOT RUN");
  assert.equal(Object.hasOwn(rows[0], "pluginInstall"), false);
  assert.equal(rows[1].install, "blocked");
  assert.equal(rows[1].oauth, "waiting");
  assert.equal(rows[1].routing, "NOT RUN");
});

test("a binary on PATH does not count as a client result", () => {
  for (const row of clientRows(() => "/usr/bin/claude")) {
    assert.equal(row.binary, "present");
    for (const check of clientChecks) assert.equal(row[check], "NOT RUN");
  }
  for (const row of clientRows(() => null)) {
    assert.equal(row.binary, "absent");
    for (const check of clientChecks) assert.equal(row[check], "NOT RUN");
  }
});

test("validate keeps the path probe separate from recorded outcomes", () => {
  const stdout = execFileSync("node", ["scripts/validate.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  const report = JSON.parse(stdout);
  assert.equal(report.structure, "pass");
  assert.deepEqual(report.contentErrors, []);
  assert.equal(report.manifestSuite, "pass");
  assert.equal(report.manifestTests >= 8, true);
  assert.equal(report.skills.count, 9);
  assert.deepEqual(report.skills.present.includes("sync-design-tuskway"), true);
  assert.deepEqual(report.skills.optionalAbsent, []);
  assert.equal(report.versionDrift.length, 0);
  assert.equal(report.claudePluginValidate.status, "UNAVAILABLE");
  assert.notEqual(report.claudePluginValidate.status, "pass");
  assert.equal(report.release.autoTag, false);
  assert.deepEqual(report.workflow, []);
  assert.equal(report.liveAcceptance, "NOT RUN");
  assert.equal(report.versionBump, "NOT RUN");
  assertPathProbe(report);
  const byClient = Object.fromEntries(report.clients.map((client) => [client.client, client]));
  assert.equal(byClient["Claude Code"].install, "pass");
  assert.equal(byClient["Claude Code"].discovery, "pass");
  assert.equal(byClient["Claude Code"].mcp, "manifest only");
  assert.equal(byClient["Claude Code"].oauth, "blocked");
  assert.equal(byClient["Claude Code"].routing, "NOT RUN");
  assert.equal(byClient["Claude Code"].workflow, "NOT RUN");
  assert.equal(byClient.Cursor.install, "pass");
  assert.equal(byClient.Cursor.oauth, "logged in");
  assert.equal(byClient.Cursor.discovery, "counted");
  assert.equal(byClient.Cursor.routing, "file read");
  assert.equal(byClient.Cursor.mcp, "needsAuth");
  assert.equal(byClient.Codex.discovery, "not shown");
  assert.equal(byClient["Copilot CLI"].discovery, "pass");
  assert.equal(byClient["Grok Build"].discovery, "not shown");
  assert.equal(byClient.OpenCode.install, "fail");
  assert.equal(byClient.Pi.discovery, "not shown");
  assert.equal(report.clients.some((client) => client.routing === "pass" || client.oauth === "pass" || client.workflow === "pass" || client.mcp === "pass"), false);
  const raw = readFileSync(path.join(root, "evals/client-checks.json"), "utf8");
  assert.equal(/\/home\/|\/Users\/|sk-|ghp_|BEGIN |AWS_|process\.env|api[_-]?key|challenge=|uuid=/i.test(raw), false);
  const grokRow = readFileSync(path.join(root, "README.md"), "utf8")
    .split("\n")
    .find((line) => line.startsWith("| Grok Build |"));
  assert.equal(grokRow.includes("--trust"), false);
  assert.match(grokRow, /grok plugin install tuskway\/plugin/);
  assert.equal(report.ci.hostedRuns, false);
  assert.equal(report.recorded.status, "recorded");
  assert.equal(report.recorded.clients.length, 7);
  assert.deepEqual(recordedProblems(report.recorded), []);
  assert.equal(
    report.recorded.clients.some((client) => client.routing === "pass"),
    false,
  );
  assert.deepEqual(report.ci.runner, ["self-hosted", "tuskway"]);
});

test("the workflow stays manual and self-hosted", () => {
  const text = readFileSync(path.join(root, ".github/workflows/plugin.yml"), "utf8");
  assert.deepEqual(workflowErrors(text), []);
  const hosted = text.replace("self-hosted", "ubuntu-22.04");
  assert.equal(workflowErrors(hosted).some((error) => error.includes("GitHub-hosted")), true);
  const automatic = text.replace("workflow_dispatch:", "pull_request:");
  assert.equal(workflowErrors(automatic).some((error) => error.includes("not manual")), true);
});

test("a generated-body marker fails and skill prose is not hashed", () => {
  const sources = ["package-contract.mjs", "sync.mjs", "validate.mjs"]
    .map((name) => readFileSync(path.join(root, "scripts", name), "utf8"))
    .join("\n");
  assert.equal(/createHash|proseParity|descriptionParity/.test(sources), false);
  const dir = stagePackage();
  try {
    writeSkill(dir, validSkill.replace("See", "generated-from the prompt"));
    assert.equal(
      packageContentErrors(dir).some((error) => error.includes("generated-body marker")),
      true,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const t4Ref = "cursor/sync-design-tuskway-bd94";
const t4Present = spawnSync("git", ["rev-parse", "--verify", "--quiet", t4Ref], { cwd: root }).status === 0;

test("the T4 sync-design files pass these content checks", { skip: t4Present ? false : "T4 ref is not in this checkout" }, () => {
  const sha = execFileSync("git", ["rev-parse", t4Ref], { cwd: root, encoding: "utf8" }).trim();
  const listed = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", t4Ref, "plugins/tuskway/skills/sync-design-tuskway"],
    { cwd: root, encoding: "utf8" },
  ).trim().split("\n");
  const dir = stagePackage();
  try {
    for (const relative of listed) {
      const target = path.join(dir, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, execFileSync("git", ["show", `${t4Ref}:${relative}`], { cwd: root }));
    }
    assert.deepEqual(packageContentErrors(dir), [], sha);
    const report = validate(dir);
    assert.equal(report.status, 0, report.report.contentErrors.join("\n"));
    assert.equal(report.report.structure, "pass");
    assert.equal(report.report.skills.count, 9);
    assert.equal(report.report.liveAcceptance, "NOT RUN");
    assert.equal(report.report.versionBump, "NOT RUN");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
