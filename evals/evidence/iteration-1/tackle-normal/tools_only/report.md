# Tackle T2 (tools only)

T2 in workspace `fixture`, epic `receipts` was ready (`plan.ready: true`, no `heldBy`, no open comments). The brief and `tech-design/return-line.md` both say to append the exact line `Returns within 14 days with receipt.` inside `renderReceipt` in `src/receipt.mjs`, keep the item and total lines, and add a test. Decision D1 says receipt text stays in that file only.

The copy is `evals/evidence/iteration-1/tackle-normal/tools_only/repo`. `renderReceipt` now ends with that return line. `src/receipt.test.mjs` keeps `includes the total` and adds `includes the return line`. No new module was added.

The copy's README says not to commit, push, or open a pull request, so T2 was set to `in_progress` and left there.

## Test

From `repo/`: `node --test src/receipt.test.mjs`

Result: 2 passed, 0 failed (`includes the total`, `includes the return line`).

## Mock tools called

All calls used `node /agent/repos/plugin/evals/mock-tuskway.mjs` with fixture `evals/fixtures/tackle-normal`. The live Tuskway server was not called.

1. `ticket_get` — workspace `fixture`, epic `receipts`, key `T2`
2. `notes_read` — path `tech-design/return-line.md`
3. `notes_search` — query `return receipt window`, boostTicket `T2`
4. `notes_read` — path `notes.md`
5. `notes_read` — path `tickets/T2.md`
6. `ticket_update` — key `T2`, status `in_progress`

## Files read

- `/agent/repos/plugin/evals/fixtures/tackle-normal/prompt.md`
- `/agent/repos/plugin/evals/mock-tuskway.mjs`
- `/agent/repos/plugin/evals/evidence/iteration-1/tackle-normal/tools_only/repo/README.md`
- `/agent/repos/plugin/evals/evidence/iteration-1/tackle-normal/tools_only/repo/src/receipt.mjs`
- `/agent/repos/plugin/evals/evidence/iteration-1/tackle-normal/tools_only/repo/src/receipt.test.mjs`

Directory listings only (contents not read from disk): `evals/fixtures/tackle-normal/` and `evals/fixtures/receipt-repo/`. Epic notes were read through the mock, not from the fixture files on disk.
