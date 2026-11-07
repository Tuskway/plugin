import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applies, argsMatch, check } from "./grade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("array arguments match by value and a question mark is not a clarification check", () => {
  assert.equal(argsMatch({ dependsOn: ["T2"], areas: ["src/receipt.mjs"] }, { dependsOn: ["T2"] }), true);
  assert.equal(argsMatch({ dependsOn: ["receipts/T2"] }, { dependsOn: ["T2"] }), false);
  const tasks = JSON.parse(readFileSync(path.join(root, "evals/tasks.json"), "utf8"));
  const gap = tasks.fixtures.find((fixture) => fixture.id === "design-gap");
  const texts = gap.assertions.flatMap((assertion) => assertion.texts ?? []);
  assert.equal(texts.includes("?"), false);
  const boundary = tasks.fixtures.find((fixture) => fixture.id === "tackle-boundary");
  assert.equal(boundary.assertions.some((assertion) => assertion.id === "no-guessed-t5"), false);
  assert.equal(applies({ appliesTo: "with_skill" }, "tools_only"), false);
});

test("fetching an ambiguous ticket is not itself a failed check", () => {
  const calls = [{ tool: "ticket_get", args: { workspace: "fixture", epic: "loyalty", key: "T5" } }];
  const fetched = check(
    { type: "call-absent-where", tool: "ticket_get", args: { key: "T5" } },
    "/tmp",
    calls,
    "",
    null,
  );
  assert.equal(fetched.passed, false);
  const started = check(
    { type: "call-absent-where", tool: "ticket_update", args: { key: "T5" } },
    "/tmp",
    calls,
    "loyalty and receipts were not started",
    null,
  );
  assert.equal(started.passed, true);
  const named = check(
    { type: "report-includes-all", texts: ["receipts", "loyalty"] },
    "/tmp",
    calls,
    "loyalty and receipts were not started",
    null,
  );
  assert.equal(named.passed, true);
  const questionOnly = check(
    { type: "report-includes-any", texts: ["provisional", "not decided", "Open gaps"] },
    "/tmp",
    [],
    "Is the window 14 days?",
    null,
  );
  assert.equal(questionOnly.passed, false);
});
