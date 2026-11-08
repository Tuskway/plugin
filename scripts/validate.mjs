import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clientRows,
  optionalSkills,
  outcomeRows,
  parseRecorded,
  packageContentErrors,
  skillNames,
  versionReport,
  workflowErrors,
} from "./package-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function onPath(command) {
  const found = spawnSync("which", [command], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.trim() : null;
}

function claudeValidator(root) {
  if (root !== repoRoot) {
    return {
      status: "NOT RUN",
      command: "claude plugin validate --strict",
      reason: "Strict Claude validation is not run for an alternate root.",
    };
  }
  const binary = onPath("claude");
  if (!binary) {
    return {
      status: "UNAVAILABLE",
      command: "claude plugin validate --strict",
      reason: "claude is not on PATH. This is not a passing strict validation.",
    };
  }
  const ran = spawnSync(binary, ["plugin", "validate", "--strict"], {
    cwd: path.join(root, "plugins/tuskway"),
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
    if (argv[i] === "--root") {
      const value = argv[++i];
      if (!value) {
        console.error("missing --root");
        process.exit(2);
      }
      root = path.resolve(value);
    }
    else {
      console.error(`unknown argument ${argv[i]}`);
      process.exit(2);
    }
  }
  return root;
}

const root = args(process.argv);
const names = skillNames(root);
const contentErrors = packageContentErrors(root);
const versions = versionReport(root);
function suiteEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function lastCount(stdout, label) {
  const matches = [...String(stdout).matchAll(new RegExp(`# ${label} (\\d+)`, "g"))];
  if (matches.length === 0) return null;
  return Number(matches.at(-1)[1]);
}

const checkout = root === repoRoot;
const suite = checkout
  ? spawnSync("node", ["--test", "scripts/test-manifests.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: suiteEnv(),
    })
  : null;
const tests = suite ? lastCount(suite.stdout, "tests") : null;
const fails = suite ? lastCount(suite.stdout, "fail") : null;
const suitePass = Boolean(
  suite
  && suite.status === 0
  && tests !== null
  && fails === 0
  && String(suite.stdout).includes("authored skills keep portable frontmatter"),
);
const validator = claudeValidator(root);
const tags = releaseTags(root);
const workflowPath = path.join(root, ".github/workflows/plugin.yml");
const workflowProblems = existsSync(workflowPath)
  ? workflowErrors(readFileSync(workflowPath, "utf8"))
  : checkout
    ? ["workflow file is missing"]
    : [];
const recordedPath = path.join(root, "evals/client-checks.json");
const parsedRecord = checkout && existsSync(recordedPath)
  ? parseRecorded(readFileSync(recordedPath, "utf8"))
  : null;
const recorded = parsedRecord?.data ?? null;
const recordedErrors = checkout
  ? parsedRecord
    ? parsedRecord.errors
    : ["recorded client checks are missing"]
  : [];
const structurePass = contentErrors.length === 0
  && versions.drift.length === 0
  && workflowProblems.length === 0
  && recordedErrors.length === 0
  && (checkout ? suitePass : true)
  && validator.status !== "fail";

const report = {
  structure: structurePass ? "pass" : "fail",
  liveAcceptance: "NOT RUN",
  skills: {
    present: names,
    count: names.length,
    optionalAbsent: optionalSkills.filter((name) => !names.includes(name)),
    errors: contentErrors,
  },
  contentErrors,
  version: versions.canonical,
  versionDrift: versions.drift,
  versionBump: "NOT RUN",
  unversionedManifests: versions.unversioned,
  manifestSuite: checkout ? (suitePass ? "pass" : "fail") : "not applied",
  manifestTests: tests,
  claudePluginValidate: validator,
  release: {
    ...tags,
    note: "No tag is created. A plugin-v tag waits for recorded behavior and client checks.",
  },
  workflow: workflowProblems,
  pathProbe: clientRows(onPath),
  clients: recorded && recordedErrors.length === 0 ? outcomeRows(recorded.clients) : clientRows(onPath),
  recorded: recorded
    ? { ...recorded, status: recordedErrors.length === 0 ? "recorded" : "invalid", errors: recordedErrors }
    : { status: checkout ? "missing" : "not applied", errors: recordedErrors },
  ci: {
    hostedRuns: false,
    trigger: "workflow_dispatch",
    runner: ["self-hosted", "tuskway"],
    tension: "repo.md asks the workflow to gate these static checks. .github/workflows/plugin.yml does not run on push or pull_request and does not select a GitHub-hosted runner, so opening a pull request spends no Actions minutes. Run the three local commands until a self-hosted runner labeled tuskway exists.",
  },
};

if (checkout && !suitePass) {
  console.error(suite.stdout);
  console.error(suite.stderr);
}
console.log(JSON.stringify(report, null, 2));
process.exit(structurePass ? 0 : 1);
