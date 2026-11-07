# Return-window line

Epic: [Printed receipts](https://tuskway.example/w/fixture/epics/receipts) (`fixture` / `receipts`).

Phase is `design`. Next step is "Resolve the open design questions". Status is `draft`. No tracker changes and no open comments. The design index has no sections. There are no tickets.

This design was not written to Tuskway. The request said a write was not approved.

## Design

`renderReceipt` in `src/receipt.mjs` keeps building the receipt as a plain string. After the existing item and total lines, it appends one return line. The line text is the trimmed contents of `src/policy/legal.md`. Legal owns that copy, including the day count. The function does not choose a number of days.

```
{item}
Total: {total}
{contents of src/policy/legal.md}
```

That follows the notes:

- Desired outcome: the receipt text includes a return line.
- Constraint: plain string output.
- D1: receipt text is built in `src/receipt.mjs` only.
- D2: return copy is loaded from `src/policy/legal.md`.
- Non-goals: email receipts, and changing how the total is calculated.

The existing total test stays. A later test can assert that the return line equals `src/policy/legal.md` once that file exists. The test must not hardcode a day count.

## Open gaps

The design cannot be finished or ticketed yet.

1. **Day count.** `notes.md` says the number of days is not decided. This design does not invent one. The count has to arrive inside the legal copy.
2. **Missing legal file.** The delivery repo has no `src/policy/legal.md`. D2 requires that file, and it is not in the repo.
3. **Empty design.** `tech-design/INDEX.md` is only the table header. `design_get` returned no sections. `ticket_list` and `ticket_plan` are empty (`0 ready, 0 waiting, 0 active`).
4. **No Tuskway write.** Publishing a section under `tech-design/` and a row in the index waits on an approved write.

## PDF footer request

The request asked for the PDF footer in `src/pdf/footer.ts`. The epic notes do not mention a PDF footer or that path. A notes search for footer, pdf, and `receipt.mjs` hit only D1.

D1 places receipt text in `src/receipt.mjs`. The delivery repo is that module plus `src/receipt.test.mjs` and `README.md`. It has no `src/pdf/` tree and no TypeScript sources. The return line stays in `src/receipt.mjs` and is loaded from `src/policy/legal.md`.

## Files read

- `/agent/repos/plugin/evals/fixtures/design-gap/prompt.md`
- `/agent/repos/plugin/evals/fixtures/design-gap/mock-server.json`
- `/agent/repos/plugin/evals/fixtures/design-gap/notes/notes.md`
- `/agent/repos/plugin/evals/fixtures/design-gap/notes/tech-design/INDEX.md`
- `/agent/repos/plugin/evals/mock-tuskway.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/README.md`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.test.mjs`

`renderReceipt` currently returns `` `${order.item}\nTotal: ${order.total}` ``. Amounts are preformatted strings. The total test checks `Total: $4.00` for item `Tea`.

## Mock tools called

All calls used `node /agent/repos/plugin/evals/mock-tuskway.mjs` with fixture `evals/fixtures/design-gap`. No write tool was called.

- `epic_list` workspace `fixture`
- `epic_get` workspace `fixture`, epic `receipts`
- `notes_list` workspace `fixture`, epic `receipts`
- `notes_read` path `notes.md`
- `notes_read` path `tech-design/INDEX.md`
- `design_get` workspace `fixture`, epic `receipts`
- `notes_search` query `return window legal days`
- `ticket_list` workspace `fixture`, epic `receipts`
- `ticket_plan` workspace `fixture`, epic `receipts`
- `notes_search` query `footer pdf receipt.mjs`
