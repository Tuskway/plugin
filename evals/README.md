# Behavior fixtures

`evals/fixtures/` checks the skills against a mock Tuskway server. The mock is not `https://tuskway.com`. Each fixture's `mock-server.json` refuses tools it did not allow. The file is not an MCP registry `server.json`.

A question mark in a report is not evidence that the agent asked a useful question. Calling `ticket_get` for an ambiguous key is not a failure by itself. The failure is choosing that ticket and continuing.

## Run one case

Use a fresh context. Point it at one output directory under `evals/evidence/`. The tools-only run must not read `plugins/tuskway/skills`. The with-skill run reads only the named skill and the files it links. Do not read `mock-server.json` or `tasks.json`.

```bash
node evals/mock-tuskway.mjs \
  --fixture evals/fixtures/design-normal \
  --state evals/evidence/design-normal/with_skill/state \
  --log evals/evidence/design-normal/with_skill/calls.jsonl \
  notes_read \
  --args '{"workspace":"fixture","epic":"receipts","path":"notes.md"}'
```

Write the task result to `report.md` in that output directory. For tackle-normal, copy `evals/fixtures/receipt-repo` to `repo/` inside the output directory before editing.

Grade saved outputs:

```bash
node evals/grade.mjs
```

Exit 1 means a `with_skill` critical assertion failed. Exit 2 means a required run directory is missing. `evals/evidence/` is local output and is not part of the package.
