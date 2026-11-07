# Behavior fixtures

These fixtures check the authored skills against a mock Tuskway server. The mock is not `https://tuskway.com`. Each fixture's `mock-server.json` refuses tools it did not allow. The file is not an MCP registry `server.json`. Live production writes are out of scope.

The old generated snapshot at `7933ea3` is unavailable. GitHub returned 404 for that file. It was not recreated.

`evals/routing.json` is a routing prompt list. It has not been run. Loading a skill by path is explicit execution, not a routing pass.

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

Exit 2 means a required run is missing. Exit 1 means a `with_skill` critical assertion failed. A `tools_only` critical failure stays in `evals/evidence/iteration-1/grading-summary.json` and does not by itself change the exit code. The grader does not judge usefulness. That review is `evals/evidence/human-review.md` and is not Mathis's approval.

`tasks.extraRuns` grades explicit iteration-2 directories. A missing `tools_only` directory on those runs is NOT RUN. `intake-existing`, `tickets-coverage`, and `tracker-links` were not executed. Mock `state/` directories are gitignored because they copy fixture comment bodies.
