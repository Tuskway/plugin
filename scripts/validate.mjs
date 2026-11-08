import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { skillNames, skillSetErrors, versionReport } from "./package-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const clients = [
  ["Claude Code", "claude"],
  ["Cursor", "cursor"],
  ["Codex", "codex"],
  ["Copilot CLI", "copilot"],
  ["Grok Build", "grok"],
  ["OpenCode", "opencode"],
  ["Pi", "pi"],
];

const checks = [
  "install",
  "discovery",
  "resources",
  "mcp",
  "oauth",
  "update",
  "workflow",
  "routing",
];

function onPath(command) {
  const found = spawnSync("which", [command], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.trim() : null;
}

function claudeValidator() {
  const binary = onPath("claude");
  if (!binary) {
    return {
      status: "UNAVAILABLE",
      command: "claude plugin validate --strict",
      reason: "claude is not on PATH. This is not a passing strict validation.",
    };
  }
  const ran = spawnSync(binary, ["plugin", "validate", "--strict"], {
    cwd: path.join(repoRoot, "plugins/tuskway"),
    encoding: "utf8",
  });
  return {
    status: ran.status === 0 ? "pass" : "fail",
    command: "claude plugin validate --strict",
    exitCode: ran.status,
  };
}

function releaseTags(root) {
  const listed = spawnSync("git", ["tag", "--list", "plugin-v*"], {
    cwd: root,
    encoding: "utf8",
  });
  if (listed.status !== 0) {
    return { status: "unknown", tags: [], autoTag: false };
  }
  return {
    status: "listed",
    tags: listed.stdout.split("\n").map((line) => line.trim()).filter(Boolean),
    autoTag: false,
  };
}

function args(argv) {
  let root = repoRoot;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--root") root = path.resolve(argv[++i]);
    else {
      console.error(`unknown argument ${argv[i]}`);
      process.exit(2);
    }
  }
  return root;
}

const root = args(process.argv);
const names = skillNames(root);
const skillErrors = skillSetErrors(names);
const versions = versionReport(root);
function suiteEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function suiteSummary(stdout) {
  const tests = Number(/# tests (\d+)/.exec(stdout)?.[1] ?? "0");
  const fail = Number(/# fail (\d+)/.exec(stdout)?.[1] ?? "1");
  return { tests, fail };
}

const suite = spawnSync("node", ["--test", "scripts/test-manifests.mjs"], {
  cwd: repoRoot,
  encoding: "utf8",
  env: suiteEnv(),
});
const summary = suiteSummary(suite.stdout ?? "");
const suitePass = suite.status === 0 && summary.fail === 0 && summary.tests >= 8;
const validator = claudeValidator();
const tags = releaseTags(root);
const structurePass = skillErrors.length === 0
  && versions.drift.length === 0
  && suitePass
  && validator.status !== "fail";

const report = {
  structure: structurePass ? "pass" : "fail",
  liveAcceptance: "NOT RUN",
  skills: {
    present: names,
    count: names.length,
    optionalAbsent: ["sync-design-tuskway"].filter((name) => !names.includes(name)),
    errors: skillErrors,
  },
  version: versions.canonical,
  versionDrift: versions.drift,
  unversionedManifests: versions.unversioned,
  manifestSuite: suitePass ? "pass" : "fail",
  manifestTests: summary.tests,
  claudePluginValidate: validator,
  release: {
    ...tags,
    note: "No tag is created. A plugin-v tag waits for recorded behavior and client checks.",
  },
  clients: clients.map(([name, command]) => {
    const binary = onPath(command);
    const row = { client: name, binary: binary ? "present" : "absent" };
    for (const check of checks) row[check] = "NOT RUN";
    if (name === "Cursor") {
      row.note = "Grok Bot uses the Cursor install and was not run separately.";
    }
    return row;
  }),
  ci: {
    hostedRuns: false,
    trigger: "workflow_dispatch",
    runner: ["self-hosted", "tuskway"],
    tension: "repo.md asks the workflow to gate these static checks. .github/workflows/plugin.yml does not run on push or pull_request and does not select a GitHub-hosted runner, so opening a pull request spends no Actions minutes. Run the three local commands until a self-hosted runner labeled tuskway exists.",
  },
};

if (!structurePass) {
  console.error(suite.stdout);
  console.error(suite.stderr);
}
console.log(JSON.stringify(report, null, 2));
process.exit(structurePass ? 0 : 1);
