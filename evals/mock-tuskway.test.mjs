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
