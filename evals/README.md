# Behavior fixtures

These fixtures check the authored skills against a mock Tuskway server. The mock is not `https://tuskway.com`. Each fixture's `mock-server.json` refuses tools it did not allow. The file is not an MCP registry `server.json`. Live production writes are out of scope.

The old generated snapshot at `7933ea3` is unavailable. GitHub returned 404 for that file. It was not recreated.

`evals/routing.json` is a routing prompt list. This environment has no host skill router, so those prompts are not a routing pass. `routing-descriptions` in iteration 3 is a description-match proxy: one model saw the skill descriptions and labeled each prompt. It is not evidence that a client would select the skill. Loading a skill by path is explicit execution.

A question mark in a report is not evidence that the agent asked a useful question. Calling `ticket_get` for an ambiguous key is not a failure by itself. The failure is choosing that ticket and continuing. Iteration 1 and 2 were regraded on that basis. The saved reports were not rewritten.

Iteration 3 and 4 agents are instructed not to read `mock-server.json`, `tasks.json`, `iteration-3.json`, or other evidence. Iteration 1 reports show those runs read fixture files and the mock source, so they are model-written but not blind to the fixture. The old generated snapshot remains unavailable. Iteration 3 `with_skill` critical checks passed. `change-safety` tools-only applied a contradicting decision, and `setup-empty` tools-only omitted `https://tuskway.com`. Those two stay failed. Several other pairs matched on the graded outcome. Iteration 4 `tracker-apply` is a mock safe apply plus a stale-hash retry. Both conditions were `critical-pass` on the trace and the final note. That pair ties. See `evals/evidence/human-review.md`.

## Run one case

Use a fresh context. Point it at one output directory. The tools-only run must not read `plugins/tuskway/skills`. The with-skill run reads only the named skill and the files it links.

```bash
node evals/mock-tuskway.mjs \
  --fixture evals/fixtures/design-normal \
  --state evals/evidence/iteration-1/design-normal/with_skill/state \
  --log evals/evidence/iteration-1/design-normal/with_skill/calls.jsonl \
  notes_read \
  --args '{"workspace":"fixture","epic":"receipts","path":"notes.md"}'
```

Write the task result to `report.md` in that output directory. For tackle-normal, copy `evals/fixtures/receipt-repo` to `repo/` inside the output directory before editing.

Grade recorded outputs:

```bash
node evals/grade.mjs
```

Exit 1 means a `with_skill` critical assertion failed. Exit 2 means a required run is missing and no `with_skill` critical assertion failed. A `tools_only` critical failure stays in the grading summary and does not by itself change the exit code. The grader does not judge usefulness. That review is `evals/evidence/human-review.md` and is not Mathis's approval.

`tasks.extraRuns` grades explicit iteration-2 directories, and `evals/iteration-3.json` adds later runs. A missing directory is NOT RUN. Iteration 3 ran intake, ticket coverage, tracker-link text, tracker safety, setup variants, plan tools-only, change safety, a design near-miss, and a description-match proxy. Iteration 4 ran `tracker-apply`. Mock `state/` directories are gitignored because they copy fixture note bodies. The committed snapshots are the redacted notes the grader checked.
