# Design proposal: return line

Target: workspace `fixture`, epic `receipts` (`https://tuskway.example/w/fixture/epics/receipts`). Epic title “Printed receipts”, status `draft`, `permissions.canEdit` true. This result is a proposal. The user has not approved a write, so nothing was written to Tuskway. A proposal is not an approved design, and this proposal is not a ticket split.

## Requirements

From `notes.md` and the user:

- Printed receipts omit the store's return window.
- The receipt text includes a return line.
- The settled copy is `Returns within 14 days with receipt.`
- Output stays a plain string. A PDF library is out of bounds.
- Existing receipt tests must keep passing.
- Receipt text is built in `src/receipt.mjs` only (decision D1).

## Non-goals

- Email receipts.
- Changing how the total is calculated.

## Decisions already written

D1 is a constraint: receipt text is built in `src/receipt.mjs` only. `notes.md` was left unchanged. Its `sha256` is `e43e275497ee0e4bb8426e09b366d5c1264ff3b4208c08cb737fd9b0638c444b`.

## Still open

The notes require that sentence to be included. They do not set its position relative to the item and the total. Placement below is provisional: its own line after the total. Any order that keeps the settled sentence and leaves the total line untouched still meets the written decisions.

No ticket briefs exist. `T1` below is the proposed stable id for this section. The brief is not drafted.

## Approaches

- A: Append the settled sentence as its own line inside the existing template in `src/receipt.mjs`. Cost: every receipt uses this copy; a different window means editing that function.
- B: Own the line in a new module, or render it with a PDF library, and call that from `renderReceipt`. Cost: a second module contradicts D1, and a PDF contradicts the plain-string constraint. The opened test imports only `renderReceipt` from `./receipt.mjs`.

Recommendation: A, because D1 builds receipt text in `src/receipt.mjs` only and the notes require a plain string. The settled sentence makes a per-order window unnecessary.

## Proposed index

`tech-design/INDEX.md` today is only the heading and an empty table (`sha256` `f539464ec6eba6b0fb6732eba0b33e41e3e68705b5a222a16c92dba81d32b093`). On an approved write, that hash would be sent as `expectedSha256`. The Title cell matches the section H1. Tracker stays empty; no issue is published. `notes.md` would not be part of the write.

```markdown
# Index

| Title | File | Ticket | Tracker |
|---|---|---|---|
| Return line | return-line.md | T1 | |
```

`tech-design/return-line.md` is new, so there is no prior hash to send.

## Proposed section

```markdown
# Return line

## Behavior

`renderReceipt` still prints the item on the first line and `Total: ` plus the preformatted `order.total` on the second. It then prints a third line, `Returns within 14 days with receipt.`

A caller who passes `{ item: "Tea", total: "$4.00" }` gets:

    Tea
    Total: $4.00
    Returns within 14 days with receipt.

The total string is still `order.total`. The function still returns one string. Line order is provisional: the notes require the sentence, and this proposal places it after the total.

## Approaches

- A: Append the settled sentence as its own line inside the existing template in `src/receipt.mjs`. Cost: every receipt uses this copy; a different window means editing that function.
- B: Own the line in a new module, or render it with a PDF library, and call that from `renderReceipt`. Cost: a second module contradicts D1, and a PDF contradicts the plain-string constraint. The opened test imports only `renderReceipt` from `./receipt.mjs`.

Recommendation: A, because D1 builds receipt text in `src/receipt.mjs` only and the notes require a plain string.

## Affected code

- `src/receipt.mjs` — `renderReceipt` returns `` `${order.item}\nTotal: ${order.total}` ``. The file comment says amounts are preformatted strings, never cents.
- `src/receipt.test.mjs` — the test named `includes the total` calls `renderReceipt({ item: "Tea", total: "$4.00" })` and asserts `/Total: \$4\.00/`.
- `README.md` — documents the test command `node --test src/receipt.test.mjs`, and says receipt text is built only in `src/receipt.mjs` and amounts are preformatted strings.

## Risks

If the return sentence is spliced into the total line, or the total is recomputed, the existing total assertion fails or the non-goal on totals is broken. If the characters differ from `Returns within 14 days with receipt.`, the receipt misses the settled copy. If another file starts owning receipt text, D1 is broken even when the words look right. If the provisional line order is wrong, the sentence can move without changing the total line.

## Verification

The repo documents `node --test src/receipt.test.mjs`. The test read is `includes the total`. It passed when run against the current repo: it proves the total line is still present for Tea at `$4.00`. It does not prove the return sentence is present or spelled as settled. That needs a new assertion after the change. The README fixture process says to run that command after a copy change, and to leave the repo uncommitted.
```

## Hashes

| Path | sha256 | On an approved write |
|---|---|---|
| `notes.md` | `e43e275497ee0e4bb8426e09b366d5c1264ff3b4208c08cb737fd9b0638c444b` | Not sent. Decisions stay. |
| `tech-design/INDEX.md` | `f539464ec6eba6b0fb6732eba0b33e41e3e68705b5a222a16c92dba81d32b093` | Sent as `expectedSha256`. |
| `tech-design/return-line.md` | none | New file. No `expectedSha256`. |

## Files read

- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/SKILL.md`
- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/references/target.md`
- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/references/section-template.md`
- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/references/example.md`
- `/agent/repos/plugin/evals/fixtures/design-normal/prompt.md`
- `/agent/repos/plugin/evals/mock-tuskway.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/README.md`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.test.mjs`

Tuskway notes opened through the mock, not as local files: `notes.md`, `tech-design/INDEX.md`. `notes_list` showed only those two paths. No design section files exist yet.

## Mock tools called

- `epic_get` workspace `fixture`, epic `receipts`
- `notes_read` path `notes.md`
- `design_get`
- `notes_read` path `tech-design/INDEX.md`
- `notes_list`
- `ticket_list` (empty)

`notes_write`, `notes_edit`, and `ticket_draft` were not called.
