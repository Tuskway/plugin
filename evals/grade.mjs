import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tasks = JSON.parse(readFileSync(path.join(root, "evals/tasks.json"), "utf8"));
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

function argsMatch(args, expected) {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => args?.[key] === value);
}

function check(assertion, dir, calls, report) {
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
      exitCode = 2;
      continue;
    }
    const results = fixture.assertions.map((assertion) => {
      const result = check(assertion, dir, calls, report);
      return {
        id: assertion.id,
        critical: assertion.critical === true,
        text: assertion.text ?? assertion.id,
        passed: result.passed,
        evidence: result.evidence,
      };
    });
    const critical = results.filter((result) => result.critical);
    const criticalFailed = critical.filter((result) => !result.passed);
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
console.log(JSON.stringify(summary, null, 2));
process.exit(exitCode);
