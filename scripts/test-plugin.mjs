import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
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

    const skillPath = writeSkill(dir, validSkill.replace("name: sync-design-tuskway", "name: other-tuskway"));
    const renamed = validate(dir);
    assert.equal(renamed.status, 1);
    assert.equal(renamed.report.structure, "fail");
    assert.equal(renamed.report.manifestSuite, "not applied");
    assert.equal(renamed.report.contentErrors.some((error) => error.includes("frontmatter name")), true);

    writeSkill(dir, validSkill.replace("references/target.md", "references/missing.md"));
    const missing = validate(dir);
    assert.equal(missing.status, 1);
    assert.equal(missing.report.contentErrors.some((error) => error.includes("missing resource")), true);

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
    assert.equal(
      readFileSync(path.join(root, "plugins/tuskway/skills/plan-tuskway/SKILL.md"), "utf8"),
      original,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validate reports the package on disk", () => {
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
  const claudeOnPath = spawnSync("which", ["claude"], { encoding: "utf8" }).status === 0;
  if (claudeOnPath) {
    assert.equal(report.claudePluginValidate.status, "pass");
  } else {
    assert.equal(report.claudePluginValidate.status, "UNAVAILABLE");
    assert.notEqual(report.claudePluginValidate.status, "pass");
  }
  assert.equal(report.release.autoTag, false);
  assert.deepEqual(report.workflow, []);
  assert.equal(report.clients, undefined);
  assert.equal(report.recorded, undefined);
  assert.equal(report.routingGrade, undefined);
  const grokRow = readFileSync(path.join(root, "README.md"), "utf8")
    .split("\n")
    .find((line) => line.startsWith("| Grok Build |"));
  assert.equal(grokRow.includes("--trust"), false);
  assert.match(grokRow, /grok plugin install tuskway\/plugin/);
  assert.equal(report.ci.hostedRuns, true);
  assert.equal(report.ci.trigger, "workflow_dispatch");
  assert.deepEqual(report.ci.runner, ["ubuntu-latest"]);
});

test("the workflow stays manual and runs on a GitHub-hosted runner", () => {
  const text = readFileSync(path.join(root, ".github/workflows/plugin.yml"), "utf8");
  assert.deepEqual(workflowErrors(text), []);
  const selfHosted = text.replaceAll("runs-on: ubuntu-latest", "runs-on: self-hosted");
  assert.equal(workflowErrors(selfHosted).some((error) => error.includes("self-hosted")), true);
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
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
