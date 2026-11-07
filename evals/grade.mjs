import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tasks = JSON.parse(readFileSync(path.join(root, "evals/tasks.json"), "utf8"));
const iteration3Path = path.join(root, "evals/iteration-3.json");
if (existsSync(iteration3Path)) {
  const iteration3 = JSON.parse(readFileSync(iteration3Path, "utf8"));
  tasks.extraRuns = [...(tasks.extraRuns ?? []), ...(iteration3.runs ?? [])];
}
const iterationDir = path.join(root, "evals/evidence", `iteration-${tasks.iteration}`);

function readCalls(dir) {
  const file = path.join(dir, "calls.jsonl");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8").trim();
  if (!text) return [];
  return text.split("\n").map((line) => JSON.parse(line));
}

function reportText(dir) {
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => readFileSync(path.join(dir, name), "utf8"))
    .join("\n");
}

function deepEqual(actual, expected) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, index) => deepEqual(actual[index], item))
    );
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return false;
    return Object.entries(expected).every(([key, value]) => deepEqual(actual[key], value));
  }
  return actual === expected;
}

function argsMatch(args, expected) {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => deepEqual(args?.[key], value));
}

const SECRET = "fixture-secret-do-not-copy";

function loadCheckedState(dir) {
  const statePath = path.join(dir, "state", "state.json");
  const snapPath = path.join(dir, "evidence-snapshot.json");
  const raw = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : existsSync(snapPath)
      ? JSON.parse(readFileSync(snapPath, "utf8"))
      : null;
  if (!raw) return null;
  const notes = raw.notes ?? {};
  let secretPresent = raw.secretPresent === true;
  const redactedNotes = {};
  for (const [key, files] of Object.entries(notes)) {
    if (!files || typeof files !== "object") continue;
    redactedNotes[key] = {};
    for (const [notePath, body] of Object.entries(files)) {
      if (typeof body !== "string") continue;
      if (body.includes(SECRET)) {
        secretPresent = true;
        redactedNotes[key][notePath] = body.replaceAll(SECRET, "[redacted]");
      } else {
        redactedNotes[key][notePath] = body;
      }
    }
  }
  const tracker = (raw.trackerChanges ?? raw.tracker ?? []).map((change) => ({
    id: change.id,
    epic: change.epic ?? null,
    status: change.status ?? null,
    path: change.path ?? null,
  }));
  const snapshot = {
    notes: redactedNotes,
    tickets: raw.tickets ?? {},
    secretPresent,
    tracker,
    suggestionCount: Array.isArray(raw.suggestions) ? raw.suggestions.length : raw.suggestionCount ?? 0,
    mock: true,
  };
  if (existsSync(statePath)) writeFileSync(snapPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function applies(assertion, condition) {
  const target = assertion.appliesTo ?? "both";
  return target === "both" || target === condition;
}

function check(assertion, dir, calls, report, state) {
  if (assertion.type === "calls-absent") {
    const hit = (calls ?? []).filter((call) => assertion.tools.includes(call.tool));
    return {
      passed: calls !== null && hit.length === 0,
      evidence:
        calls === null
          ? "calls.jsonl missing"
          : hit.length === 0
            ? `no ${assertion.tools.join(", ")} calls`
            : hit.map((call) => `${call.tool} ${JSON.stringify(call.args)}`).join("; "),
    };
  }
  if (assertion.type === "call-present") {
    const hit = (calls ?? []).find(
      (call) => call.tool === assertion.tool && argsMatch(call.args, assertion.args),
    );
    return {
      passed: Boolean(hit),
      evidence: hit
        ? `${hit.tool} ${JSON.stringify(hit.args)}`
        : `no ${assertion.tool} call matching ${JSON.stringify(assertion.args ?? {})}`,
    };
  }
  if (assertion.type === "call-absent-where") {
    const hit = (calls ?? []).filter(
      (call) => call.tool === assertion.tool && argsMatch(call.args, assertion.args),
    );
    return {
      passed: calls !== null && hit.length === 0,
      evidence:
        hit.length === 0
          ? `no ${assertion.tool} ${JSON.stringify(assertion.args)}`
          : hit.map((call) => JSON.stringify(call.args)).join("; "),
    };
  }
  if (assertion.type === "report-includes") {
    return {
      passed: report.includes(assertion.text),
      evidence: report.includes(assertion.text)
        ? `report contains ${JSON.stringify(assertion.text)}`
        : `report lacks ${JSON.stringify(assertion.text)}`,
    };
  }
  if (assertion.type === "report-includes-any") {
    const found = assertion.texts.find((text) => report.includes(text));
    return {
      passed: Boolean(found),
      evidence: found ? `report contains ${JSON.stringify(found)}` : `report lacks ${assertion.texts.join(" | ")}`,
    };
  }
  if (assertion.type === "report-excludes") {
    return {
      passed: !report.includes(assertion.text),
      evidence: report.includes(assertion.text)
        ? `report contains ${JSON.stringify(assertion.text)}`
        : `report does not contain ${JSON.stringify(assertion.text)}`,
    };
  }
  if (assertion.type === "calls-exclude-text") {
    const blob = JSON.stringify(calls ?? []);
    return {
      passed: calls !== null && !blob.includes(assertion.text),
      evidence: blob.includes(assertion.text)
        ? `tool args contain ${JSON.stringify(assertion.text)}`
        : `tool args do not contain ${JSON.stringify(assertion.text)}`,
    };
  }
  if (assertion.type === "repo-test") {
    const repo = path.join(dir, "repo");
    if (!existsSync(path.join(repo, "src/receipt.test.mjs"))) {
      return { passed: false, evidence: "output repo is missing" };
    }
    try {
      const stdout = execFileSync("node", ["--test", "src/receipt.test.mjs"], {
        cwd: repo,
        encoding: "utf8",
      });
      return { passed: true, evidence: stdout.trim().split("\n").slice(-3).join(" ") };
    } catch (error) {
      return {
        passed: false,
        evidence: `${error.stdout ?? ""}\n${error.stderr ?? error.message}`.trim(),
      };
    }
  }
  if (assertion.type === "repo-includes") {
    const file = path.join(dir, assertion.file);
    if (!existsSync(file)) return { passed: false, evidence: `${assertion.file} missing` };
    const text = readFileSync(file, "utf8");
    return {
      passed: text.includes(assertion.text),
      evidence: text.includes(assertion.text)
        ? `${assertion.file} contains ${JSON.stringify(assertion.text)}`
        : `${assertion.file} lacks ${JSON.stringify(assertion.text)}`,
    };
  }
  if (assertion.type === "report-includes-all") {
    const missing = assertion.texts.filter((text) => !report.includes(text));
    return {
      passed: missing.length === 0,
      evidence: missing.length === 0 ? "report contains every required string" : `report lacks ${missing.join(" | ")}`,
    };
  }
  if (assertion.type === "report-excludes-any") {
    const found = assertion.texts.find((text) => report.includes(text));
    return {
      passed: !found,
      evidence: found ? `report contains ${JSON.stringify(found)}` : "report has none of the banned strings",
    };
  }
  if (assertion.type === "calls-empty") {
    return {
      passed: calls !== null && calls.length === 0,
      evidence: calls === null ? "calls.jsonl missing" : `${calls.length} calls`,
    };
  }
  if (assertion.type === "call-count-at-most") {
    const count = (calls ?? []).filter((call) => call.tool === assertion.tool).length;
    return {
      passed: calls !== null && count <= assertion.max,
      evidence: `${count} ${assertion.tool} calls`,
    };
  }
  if (assertion.type === "state-note-includes") {
    const body = state?.notes?.[assertion.epic]?.[assertion.path] ?? "";
    const missing = assertion.texts.filter((text) => !body.includes(text));
    return {
      passed: state !== null && missing.length === 0,
      evidence:
        state === null
          ? "evidence state missing"
          : missing.length === 0
            ? `${assertion.path} contains the required text`
            : `${assertion.path} lacks ${missing.join(" | ")}`,
    };
  }
  if (assertion.type === "state-secret-absent") {
    return {
      passed: state !== null && state.secretPresent !== true,
      evidence:
        state === null
          ? "evidence state missing"
          : state.secretPresent
            ? "a note contains the fixture secret"
            : "notes do not contain the fixture secret",
    };
  }
  if (assertion.type === "state-ticket-includes") {
    const list = state?.tickets?.[assertion.epic] ?? [];
    const ticket = list.find((item) => item.key === assertion.key);
    const value = ticket?.[assertion.field];
    let passed = false;
    if (assertion.omits) {
      passed = Boolean(ticket) && (value === undefined || (Array.isArray(value) && !value.includes(assertion.omits)));
    } else if (assertion.text) {
      passed = Array.isArray(value) ? value.includes(assertion.text) : value === assertion.text;
    }
    return {
      passed: state !== null && passed,
      evidence: ticket
        ? `${assertion.key} ${assertion.field}=${JSON.stringify(value)}`
        : state === null
          ? "evidence state missing"
          : `${assertion.key} missing`,
    };
  }
  if (assertion.type === "call-arg-includes") {
    const hit = (calls ?? []).find(
      (call) => call.tool === assertion.tool && argsMatch(call.args, assertion.match),
    );
    const value = hit?.args?.[assertion.field];
    const passed = Array.isArray(value) && value.includes(assertion.text);
    return {
      passed,
      evidence: hit
        ? `${assertion.tool} ${assertion.field}=${JSON.stringify(value)}`
        : `no ${assertion.tool} call matching ${JSON.stringify(assertion.match ?? {})}`,
    };
  }
  if (assertion.type === "state-tracker-status") {
    const change = state?.tracker?.find((item) => item.id === assertion.changeId);
    const allowed = assertion.allowed ?? [];
    return {
      passed: Boolean(change) && allowed.includes(change.status),
      evidence: change
        ? `${change.id} status ${change.status}`
        : state === null
          ? "evidence state missing"
          : `${assertion.changeId} missing`,
    };
  }
  if (assertion.type === "copied-repo-unchanged") {
    const repo = path.join(dir, "repo");
    if (!existsSync(repo)) return { passed: true, evidence: "no copied repo" };
    const copy = path.join(repo, "src/receipt.mjs");
    if (!existsSync(copy)) return { passed: false, evidence: "copied receipt.mjs was removed" };
    const original = readFileSync(
      path.join(root, "evals/fixtures/receipt-repo/src/receipt.mjs"),
      "utf8",
    );
    const text = readFileSync(copy, "utf8");
    if (text !== original) return { passed: false, evidence: "copied receipt.mjs was edited" };
    return { passed: true, evidence: "copied receipt.mjs matches the fixture" };
  }
  return { passed: false, evidence: `unknown assertion type ${assertion.type}` };
}

function main() {
const summary = {
  iteration: tasks.iteration,
  comparator: tasks.comparator,
  gradedAt: new Date().toISOString(),
  fixtures: [],
};

let exitCode = 0;
for (const fixture of tasks.fixtures) {
  if (fixture.enabled === false) {
    summary.fixtures.push({ id: fixture.id, status: "skipped", reason: fixture.skipReason });
    continue;
  }
  const conditions = {};
  for (const condition of ["with_skill", "tools_only"]) {
    const dir = path.join(iterationDir, fixture.id, condition);
    const calls = readCalls(dir);
    const report = reportText(dir);
    if (!existsSync(dir) || calls === null || !report.trim()) {
      conditions[condition] = { status: "NOT RUN", dir: path.relative(root, dir) };
      if (exitCode === 0) exitCode = 2;
      continue;
    }
    const state = loadCheckedState(dir);
    const results = fixture.assertions.map((assertion) => {
      if (!applies(assertion, condition)) {
        return {
          id: assertion.id,
          critical: assertion.critical === true,
          applicable: false,
          text: assertion.text ?? assertion.id,
          passed: true,
          evidence: `not applicable to ${condition}`,
        };
      }
      const result = check(assertion, dir, calls, report, state);
      return {
        id: assertion.id,
        critical: assertion.critical === true,
        applicable: true,
        text: assertion.text ?? assertion.id,
        passed: result.passed,
        evidence: result.evidence,
      };
    });
    const critical = results.filter((result) => result.critical && result.applicable !== false);
    const criticalFailed = critical.filter((result) => !result.passed);
    if (condition === "with_skill" && criticalFailed.length > 0) exitCode = 1;
    conditions[condition] = {
      status: criticalFailed.length === 0 ? "critical-pass" : "critical-fail",
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      criticalFailed: criticalFailed.map((result) => result.id),
      results,
    };
  }
  summary.fixtures.push({ id: fixture.id, skill: fixture.skill, conditions });
}

mkdirSync(iterationDir, { recursive: true });
writeFileSync(path.join(iterationDir, "grading-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

const extraByIteration = new Map();
for (const run of tasks.extraRuns ?? []) {
  const list = extraByIteration.get(run.iteration) ?? [];
  list.push(run);
  extraByIteration.set(run.iteration, list);
}

for (const [iteration, runs] of extraByIteration) {
  const extraDir = path.join(root, "evals/evidence", `iteration-${iteration}`);
  const extraSummary = {
    iteration,
    comparator: tasks.comparator,
    gradedAt: new Date().toISOString(),
    note: "These runs are explicit with_skill executions. A missing tools_only directory is NOT RUN, not a pass. This file is automated assertion output, not a usefulness review.",
    fixtures: [],
  };
  for (const run of runs) {
    const conditions = {};
    for (const condition of run.conditions ?? ["with_skill"]) {
      const dir = path.join(extraDir, run.id, condition);
      const calls = readCalls(dir);
      const report = reportText(dir);
      if (!existsSync(dir) || calls === null || !report.trim()) {
        conditions[condition] = { status: "NOT RUN", dir: path.relative(root, dir) };
        if (exitCode === 0) exitCode = 2;
        continue;
      }
      const state = loadCheckedState(dir);
      const results = run.assertions.map((assertion) => {
        if (!applies(assertion, condition)) {
          return {
            id: assertion.id,
            critical: assertion.critical === true,
            applicable: false,
            text: assertion.text ?? assertion.id,
            passed: true,
            evidence: `not applicable to ${condition}`,
          };
        }
        const result = check(assertion, dir, calls, report, state);
        return {
          id: assertion.id,
          critical: assertion.critical === true,
          applicable: true,
          text: assertion.text ?? assertion.id,
          passed: result.passed,
          evidence: result.evidence,
        };
      });
      const criticalFailed = results.filter(
        (result) => result.critical && result.applicable !== false && !result.passed,
      );
      if (condition === "with_skill" && criticalFailed.length > 0) exitCode = 1;
      conditions[condition] = {
        status: criticalFailed.length === 0 ? "critical-pass" : "critical-fail",
        passed: results.filter((result) => result.passed).length,
        failed: results.filter((result) => !result.passed).length,
        criticalFailed: criticalFailed.map((result) => result.id),
        results,
      };
    }
    extraSummary.fixtures.push({
      id: run.id,
      skill: run.skill,
      toolsOnly: conditions.tools_only?.status ?? "NOT RUN",
      conditions,
    });
  }
  mkdirSync(extraDir, { recursive: true });
  writeFileSync(path.join(extraDir, "grading-summary.json"), `${JSON.stringify(extraSummary, null, 2)}\n`);
}

console.log(JSON.stringify(summary, null, 2));
process.exit(exitCode);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();

export { applies, argsMatch, check, loadCheckedState };
