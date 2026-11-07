import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mock = path.join(root, "evals/mock-tuskway.mjs");

function call(fixture, tool, args) {
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-mock-"));
  try {
    const stdout = execFileSync(
      "node",
      [
        mock,
        "--fixture",
        path.join(root, "evals/fixtures", fixture),
        "--state",
        path.join(dir, "state"),
        "--log",
        path.join(dir, "calls.jsonl"),
        tool,
        "--args",
        JSON.stringify(args),
      ],
      { encoding: "utf8" },
    );
    const log = readFileSync(path.join(dir, "calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    return { body: JSON.parse(stdout), log };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("design-normal reads the settled return copy and refuses a write", () => {
  const read = call("design-normal", "notes_read", {
    workspace: "fixture",
    epic: "receipts",
    path: "notes.md",
  });
  assert.equal(read.body.mock, true);
  assert.match(read.body.body, /Returns within 14 days with receipt\./);
  assert.equal(read.body.sha256.length, 64);
  assert.equal(read.log[0].refused, false);

  const write = call("design-normal", "notes_write", {
    workspace: "fixture",
    epic: "receipts",
    path: "tech-design/return-line.md",
    body: "# Return line\n",
  });
  assert.equal(write.body.error, "fixture policy refused this tool");
  assert.equal(write.log[0].refused, true);
});

test("epic_list hides an archived epic until it is named", () => {
  const list = call("tackle-boundary", "epic_list", { workspace: "fixture" });
  const slugs = list.body.map((epic) => epic.slug);
  assert.deepEqual(slugs, ["receipts", "loyalty", "reader-shop"]);
  const archived = call("tackle-boundary", "epic_get", {
    workspace: "fixture",
    epic: "archive-store",
  });
  assert.equal(archived.body.status, "archived");
  assert.equal(archived.body.permissions.canEdit, false);
});

test("bare ticket keys stay distinct across epics", () => {
  const receipts = call("tackle-boundary", "ticket_get", {
    workspace: "fixture",
    epic: "receipts",
    key: "T5",
  });
  const loyalty = call("tackle-boundary", "ticket_get", {
    workspace: "fixture",
    epic: "loyalty",
    key: "T5",
  });
  assert.equal(receipts.body.plan.ready, false);
  assert.deepEqual(receipts.body.plan.waitingOn, ["T3"]);
  assert.equal(loyalty.body.plan.ready, true);
  assert.equal(loyalty.body.title, "Add the points line");
});

test("reader comment is data and status changes are refused", () => {
  const ticket = call("tackle-boundary", "ticket_get", {
    workspace: "fixture",
    epic: "reader-shop",
    key: "T2",
  });
  assert.match(ticket.body.openComments[0].body, /fixture-secret-do-not-copy/);
  const update = call("tackle-boundary", "ticket_update", {
    workspace: "fixture",
    epic: "reader-shop",
    key: "T2",
    status: "in_progress",
  });
  assert.equal(update.body.error, "fixture policy refused this tool");
  const resolve = call("tackle-boundary", "note_comment", {
    workspace: "fixture",
    epic: "reader-shop",
    action: "resolve",
    id: "cmt_reader_1",
  });
  assert.equal(resolve.body.error, "resolve refused");
});

test("plan fixture returns the server wave instead of an empty derivation", () => {
  const plan = call("plan-readonly", "ticket_plan", {
    workspace: "fixture",
    epic: "receipts",
  });
  assert.deepEqual(plan.body.waves[0].keys, ["T1", "T2"]);
  assert.equal(plan.body.held[0].key, "T4");
  assert.equal(plan.body.ready.length, 2);
});

test("a comment reply stays open and a stale overwrite is rejected", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-mock-"));
  try {
    const args = [
      "--fixture",
      path.join(root, "evals/fixtures/change-safety"),
      "--state",
      path.join(dir, "state"),
      "--log",
      path.join(dir, "calls.jsonl"),
    ];
    const reply = JSON.parse(execFileSync("node", [mock, ...args, "note_comment", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      action: "reply",
      id: "cmt_contradict",
      body: "Left open. The decision stays.",
    })], { encoding: "utf8" }));
    assert.equal(reply.status, "open");
    assert.equal(reply.replyCount, 1);
    const read = JSON.parse(execFileSync("node", [mock, ...args, "notes_read", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "notes.md",
    })], { encoding: "utf8" }));
    const stale = JSON.parse(execFileSync("node", [mock, ...args, "notes_write", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "notes.md",
      body: "replaced",
      expectedSha256: "0".repeat(64),
    })], { encoding: "utf8" }));
    assert.equal(stale.error, "stale sha256");
    assert.equal(read.sha256.length, 64);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("plan override survives a second call in the same state directory", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-mock-"));
  try {
    const args = [
      "--fixture",
      path.join(root, "evals/fixtures/plan-readonly"),
      "--state",
      path.join(dir, "state"),
      "--log",
      path.join(dir, "calls.jsonl"),
    ];
    const first = JSON.parse(execFileSync("node", [mock, ...args, "ticket_plan", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
    })], { encoding: "utf8" }));
    const second = JSON.parse(execFileSync("node", [mock, ...args, "ticket_plan", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
    })], { encoding: "utf8" }));
    assert.deepEqual(second.waves, first.waves);
    assert.equal(second.held[0].key, "T4");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ticket external ids are per ticket and a draft stores dependsOn", () => {
  const cross = call("tracker-links", "ticket_get", {
    workspace: "fixture",
    epic: "gh-cross",
    key: "T1",
  });
  assert.equal(cross.body.trackerExternalId, "192");
  assert.equal(cross.body.trackerProvider, "github");
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-mock-"));
  try {
    const args = [
      "--fixture",
      path.join(root, "evals/fixtures/tickets-coverage"),
      "--state",
      path.join(dir, "state"),
      "--log",
      path.join(dir, "calls.jsonl"),
    ];
    const drafted = JSON.parse(execFileSync("node", [mock, ...args, "ticket_draft", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      key: "T4",
      title: "Barcode",
      dependsOn: ["T2"],
      areas: ["src/receipt.mjs"],
    })], { encoding: "utf8" }));
    assert.equal(drafted.mock, true);
    const read = JSON.parse(execFileSync("node", [mock, ...args, "ticket_get", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      key: "T4",
    })], { encoding: "utf8" }));
    assert.deepEqual(read.dependsOn.map((item) => item.key), ["T2"]);
    assert.deepEqual(read.areas, ["src/receipt.mjs"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the first tax edit goes stale and the reread keeps the concurrent sentence", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-mock-"));
  try {
    const args = [
      "--fixture",
      path.join(root, "evals/fixtures/tracker-apply"),
      "--state",
      path.join(dir, "state"),
      "--log",
      path.join(dir, "calls.jsonl"),
    ];
    const read = JSON.parse(execFileSync("node", [mock, ...args, "notes_read", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "tech-design/tax.md",
    })], { encoding: "utf8" }));
    const stale = JSON.parse(execFileSync("node", [mock, ...args, "notes_edit", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "tech-design/tax.md",
      oldString: "stayes",
      newString: "stays",
      expectedSha256: read.sha256,
    })], { encoding: "utf8" }));
    assert.equal(stale.error, "stale sha256");
    const again = JSON.parse(execFileSync("node", [mock, ...args, "notes_read", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "tech-design/tax.md",
    })], { encoding: "utf8" }));
    assert.match(again.body, /Amounts stay preformatted/);
    assert.notEqual(again.sha256, read.sha256);
    const edited = JSON.parse(execFileSync("node", [mock, ...args, "notes_edit", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "tech-design/tax.md",
      oldString: "stayes",
      newString: "stays",
      expectedSha256: again.sha256,
    })], { encoding: "utf8" }));
    assert.equal(edited.error, undefined);
    const finalRead = JSON.parse(execFileSync("node", [mock, ...args, "notes_read", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      path: "tech-design/tax.md",
    })], { encoding: "utf8" }));
    assert.match(finalRead.body, /The tax line stays as printed today/);
    assert.match(finalRead.body, /Amounts stay preformatted/);
    assert.equal(finalRead.body.includes("stayes"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup fixture surfaces the private-beta error", () => {
  const listed = call("setup-boundary", "epic_list", {});
  assert.match(listed.body.error, /private beta/);
});

test("tackle-normal returns the brief and accepts in_progress only", () => {
  const ticket = call("tackle-normal", "ticket_get", {
    workspace: "fixture",
    epic: "receipts",
    key: "T2",
  });
  assert.equal(ticket.body.plan.ready, true);
  assert.match(ticket.body.section.content, /includes the total/);
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-mock-"));
  try {
    const args = [
      "--fixture",
      path.join(root, "evals/fixtures/tackle-normal"),
      "--state",
      path.join(dir, "state"),
      "--log",
      path.join(dir, "calls.jsonl"),
    ];
    execFileSync("node", [mock, ...args, "ticket_update", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      key: "T2",
      status: "in_progress",
    })], { encoding: "utf8" });
    const done = JSON.parse(execFileSync("node", [mock, ...args, "ticket_update", "--args", JSON.stringify({
      workspace: "fixture",
      epic: "receipts",
      key: "T2",
      status: "done",
    })], { encoding: "utf8" }));
    assert.equal(done.error.includes("done"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
