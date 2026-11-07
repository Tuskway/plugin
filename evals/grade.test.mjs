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

test("an applied resolve counts only after a write that follows the stale error", () => {
  const calls = [
    { tool: "notes_edit", args: {}, error: "stale sha256", refused: false },
    { tool: "notes_edit", args: {}, error: null, refused: false },
    {
      tool: "tracker_changes",
      args: { action: "resolve", id: "ch_typo", outcome: "applied" },
      error: null,
      refused: false,
    },
  ];
  assert.equal(check({ type: "stale-then-success" }, "/tmp", calls, "", null).passed, true);
  assert.equal(
    check({ type: "resolve-after-success", changeId: "ch_typo" }, "/tmp", calls, "", null).passed,
    true,
  );
  const early = [
    calls[2],
    calls[0],
    calls[1],
  ];
  assert.equal(
    check({ type: "resolve-after-success", changeId: "ch_typo" }, "/tmp", early, "", null).passed,
    false,
  );
  const note = { notes: { "fixture/receipts": { "tech-design/tax.md": "The tax line stays as printed today.\n" } } };
  assert.equal(
    check(
      { type: "state-note-excludes", epic: "fixture/receipts", path: "tech-design/tax.md", texts: ["stayes"] },
      "/tmp",
      calls,
      "",
      note,
    ).passed,
    true,
  );
});
