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

Exit 2 means a fixture was not run. A critical failure is recorded in `evals/evidence/iteration-1/grading-summary.json`. The grader does not judge usefulness. That review is a separate note and is not Mathis's approval.

`design-normal-paraphrase` stays skipped until a skill revision needs a fresh rerun.
