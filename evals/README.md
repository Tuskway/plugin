# Behavior fixtures

These fixtures check the authored skills against a mock Tuskway server. The mock is not `https://tuskway.com`. Each fixture's `mock-server.json` refuses tools it did not allow. The file is not an MCP registry `server.json`. Live production writes are out of scope.

The outcomes and the limits of the saved runs are in `evals/RESULTS.md`. The model transcripts are not in this tree. `evals/evidence/` is local output and is gitignored.

The old generated snapshot at `7933ea3` is unavailable. GitHub returned 404 for that file. It was not recreated.

`evals/routing.json` grades six Cursor ask-mode sessions. Cursor presents installed skills and the agent loads `SKILL.md` with its read tools; that load does not have to come before every other tool. The current grade is fail because two prompts that should not open a Tuskway skill did. The description-match proxy in `iteration-3.json` is a separate label, not this grade.

A question mark in a report is not evidence that the agent asked a useful question. Calling `ticket_get` for an ambiguous key is not a failure by itself. The failure is choosing that ticket and continuing.

## Run one case

Use a fresh context. Point it at one output directory under `evals/evidence/`. The tools-only run must not read `plugins/tuskway/skills`. The with-skill run reads only the named skill and the files it links. Do not read `mock-server.json`, `tasks.json`, or `iteration-3.json`.

```bash
node evals/mock-tuskway.mjs \
  --fixture evals/fixtures/design-normal \
  --state evals/evidence/design-normal/with_skill/state \
  --log evals/evidence/design-normal/with_skill/calls.jsonl \
  notes_read \
  --args '{"workspace":"fixture","epic":"receipts","path":"notes.md"}'
```

Write the task result to `report.md` in that output directory. For tackle-normal, copy `evals/fixtures/receipt-repo` to `repo/` inside the output directory before editing.

Grade recorded outputs:

```bash
node evals/grade.mjs
```

Exit 1 means a `with_skill` critical assertion failed. Exit 2 means a required run directory is missing and no `with_skill` critical assertion failed. A missing directory is `NOT RUN`, not a pass. A `tools_only` critical failure stays in the grading summary and does not by itself change the exit code. The grader does not judge usefulness.

`tasks.extraRuns` and `evals/iteration-3.json` name the later cases. With no saved transcripts in the tree, `node evals/grade.mjs` exits 2.
