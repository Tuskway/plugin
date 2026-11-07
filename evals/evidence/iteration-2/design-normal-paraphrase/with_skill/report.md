# Proposal: return line on printed receipts

This is a proposal. It is not an approved design, and it is not a ticket split. Nothing was written to Tuskway.

## Target

Resolved from `https://tuskway.example/w/fixture/epics/receipts` before any Tuskway call. Query, fragment, and userinfo were absent.

- Workspace: `fixture`
- Epic: `receipts`
- Title: Printed receipts
- Status: `draft` (not archived)
- `permissions.canEdit`: true
- `trackerRepo`: `fixture/receipts`
- `trackerExternalId`: null
- Phase: design. Next step on the epic: write the technical design.

Delivery repo: `evals/fixtures/receipt-repo`.

## Requirements

From `notes.md` (decisions are constraints):

- Printed receipts omit the store's return window.
- The receipt text includes a return line.
- Settled copy: `Returns within 14 days with receipt.`
- Plain string output. A PDF library is out of bounds.
- Existing receipt tests must keep passing.
- D1: Receipt text is built in `src/receipt.mjs` only.

## Non-goals

- Email receipts.
- Changing how the total is calculated.

## Open

Line position is provisional. The notes require the settled sentence to appear in the receipt string. They do not say whether that line is before the item, between the item and the total, or after the total. Both placements can keep the current total assertion passing. This proposal does not pick a position.

No two decisions disagree. No other fact blocks the settled slice.

## Approaches

- A: Add the settled sentence as a literal line inside `renderReceipt` in `src/receipt.mjs`. Cost: the window is fixed copy in that function, so a later policy change is a code change. The current call shape `renderReceipt({ item, total })` stays valid. Position of the new line stays provisional.
- B: Build the return window in a second module, or render a PDF. Cost: a second module contradicts D1, and a PDF library contradicts the plain-string constraint. The opened test imports `renderReceipt` from `./receipt.mjs` only.

Recommendation: A, because D1 limits receipt text to `src/receipt.mjs` and the notes require plain string output. Given up: a caller-supplied window and any layout outside `src/receipt.mjs`.

B is not eligible. One eligible approach remains once those constraints are applied. The unsettled placement is called out above and is not a silent choice.

## Proposed index

`tech-design/INDEX.md` today is a heading plus an empty table. The proposal adds one row. Tracker stays empty because no published issue exists (`trackerExternalId` is null). `ticket_list` returned no tickets. `T1` is the proposed stable id for this section. This proposal does not draft a ticket.

```markdown
# Index

| Title | File | Ticket | Tracker |
|---|---|---|---|
| Return line | return-line.md | T1 | |
```

Title cell `Return line` matches the H1 below. File is under `tech-design/`, not a delivery-repo path.

On a later approved write, `notes_write` for `tech-design/INDEX.md` would send `expectedSha256` `f539464ec6eba6b0fb6732eba0b33e41e3e68705b5a222a16c92dba81d32b093` from the read of that note. `tech-design/return-line.md` is new, so that write would omit `expectedSha256`. `notes.md` stays as read. Its sha256 is `e43e275497ee0e4bb8426e09b366d5c1264ff3b4208c08cb737fd9b0638c444b`. No write hash was sent.

## Proposed section `tech-design/return-line.md`

```markdown
# Return line

## Behavior

`renderReceipt` still returns a plain string for a printed receipt. The string includes the line `Returns within 14 days with receipt.` The item line and `Total: <preformatted amount>` stay as they are. The total is still the amount passed in. Email receipts stay out of scope.

Where the return line sits relative to the item and the total is provisional.

## Approaches

- A: Add the settled sentence as a literal line inside `renderReceipt` in `src/receipt.mjs`. Cost: the window is fixed copy in that function, and the line position is still unspecified.
- B: Build the return window in a second module, or render a PDF. Cost: a second module contradicts D1, and a PDF library contradicts the plain-string constraint.

Recommendation: A, because D1 limits receipt text to `src/receipt.mjs` and the notes require plain string output.

## Affected code

- `src/receipt.mjs` — `renderReceipt` returns `` `${order.item}\nTotal: ${order.total}` ``. The file comment says amounts are preformatted strings, never cents.
- `src/receipt.test.mjs` — the test named `includes the total` calls `renderReceipt({ item: "Tea", total: "$4.00" })` and asserts `/Total: \$4\.00/`.
- `README.md` — documents the test command `node --test src/receipt.test.mjs` and states that receipt text is built only in `src/receipt.mjs` and that amounts are preformatted strings.

## Risks

A caller that expects exactly the two current lines will see a longer string. The opened test uses a substring match on the total, so it still passes when the return line is missing or the copy is wrong. A policy other than 14 days needs another edit in `src/receipt.mjs`. Choosing a line position before the notes settle it can force a second text change.

## Verification

Documented command: `node --test src/receipt.test.mjs`.

Test name read: `includes the total`.

That test was run in `evals/fixtures/receipt-repo` during this proposal. It passed (1 pass, 0 fail). It proves the total line is present for Tea / `$4.00`. It does not prove the settled return sentence is present, that the copy matches character for character, or that the total is still a preformatted string. A later test needs an assertion on `Returns within 14 days with receipt.`
```

## Files read

- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/SKILL.md`
- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/references/target.md`
- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/references/section-template.md`
- `/agent/repos/plugin/plugins/tuskway/skills/write-design-tuskway/references/example.md`
- `/agent/repos/plugin/evals/fixtures/design-normal/paraphrase.md`
- `/agent/repos/plugin/evals/mock-tuskway.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/README.md`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.test.mjs`

Tuskway notes read through the design-normal mock (not written):

- `notes.md` — sha256 `e43e275497ee0e4bb8426e09b366d5c1264ff3b4208c08cb737fd9b0638c444b`
- `tech-design/INDEX.md` — sha256 `f539464ec6eba6b0fb6732eba0b33e41e3e68705b5a222a16c92dba81d32b093`

`design_get` returned no section rows. No section file was opened. No ticket brief exists.

## Mock tools called

All calls used fixture `evals/fixtures/design-normal`.

1. `epic_get` — workspace `fixture`, epic `receipts`
2. `notes_read` — path `notes.md`
3. `design_get`
4. `ticket_list`
5. `notes_read` — path `tech-design/INDEX.md`

`notes_write` was not called. `ticket_draft` was not called.
