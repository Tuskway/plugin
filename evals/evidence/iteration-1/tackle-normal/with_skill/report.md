# T2 acceptance evidence

- workspace: `fixture`
- epic: `receipts`
- key: `T2`
- url: `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT2.md`
- status transitions sent: `todo` → `in_progress` (`ticket_update` on T2 only)
- files the brief named that were not found: none (`src/receipt.mjs`, `src/receipt.test.mjs` both exist in the copied repo)
- blockers still open: none
- open comments: none on `tech-design/return-line.md` or `notes.md`. No note edit, no resolve, no suggestion.
- pull request: not opened. The copy's README says not to commit, push, or open a pull request. Status was not set to `in_review` or `done`.

`epic_get` reported `status: draft` and `permissions.canEdit: true`. `ticket_get` reported `plan.ready: true`, `waitingOn: []`, `heldBy: null`.

Decision kept from `notes.md` (sha256 `38c61ccc3373e16b93b9204cd0bb3b2699763a726febe66013572f6f0cd8e211`): D1, receipt text is built in `src/receipt.mjs` only. Design section `tech-design/return-line.md` (sha256 `b3bf0908d4a0815438b378e0444d740dcc7edc53b9752255bdc602e4e59620d9`) says `renderReceipt` appends a final line `Returns within 14 days with receipt.` and that a new module would break D1. No module was added.

| Criterion | Result | Evidence |
|---|---|---|
| renderReceipt includes the exact line "Returns within 14 days with receipt." | passed | `node --test src/receipt.test.mjs` exited 0. The new test `includes the return line` asserted the final line equals that exact string and reported `ok`. `src/receipt.mjs` appends that line after the item and total lines. |
| The existing test "includes the total" still passes. | passed | `node --test src/receipt.test.mjs` exited 0. Output included `ok 1 - includes the total`. |
| A new test covers the return line. | passed | `src/receipt.test.mjs` now has test `includes the return line`. The same command reported `ok 2 - includes the return line` and `# fail 0`. |

## Files read

- `/agent/repos/plugin/plugins/tuskway/skills/tackle-ticket-tuskway/SKILL.md`
- `/agent/repos/plugin/plugins/tuskway/skills/tackle-ticket-tuskway/references/target.md`
- `/agent/repos/plugin/plugins/tuskway/skills/tackle-ticket-tuskway/references/pr-links.md`
- `/agent/repos/plugin/plugins/tuskway/skills/tackle-ticket-tuskway/references/evidence.md`
- `/agent/repos/plugin/evals/mock-tuskway.mjs`
- `/agent/repos/plugin/evals/fixtures/tackle-normal/prompt.md`
- `/agent/repos/plugin/evals/evidence/iteration-1/tackle-normal/with_skill/repo/README.md`
- `/agent/repos/plugin/evals/evidence/iteration-1/tackle-normal/with_skill/repo/src/receipt.mjs`
- `/agent/repos/plugin/evals/evidence/iteration-1/tackle-normal/with_skill/repo/src/receipt.test.mjs`

Notes read through the mock, not as workspace files:

- `tech-design/return-line.md`
- `notes.md` (decisions)

`notes_search` with query `return line receipt` and `boostTicket` `T2` also hit `tech-design/INDEX.md`. That index was not read as a separate note because `ticket_get` already named `tech-design/return-line.md`.
