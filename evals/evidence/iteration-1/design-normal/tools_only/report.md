# Return window line — design proposal

Epic: [Printed receipts](https://tuskway.example/w/fixture/epics/receipts) (`fixture` / `receipts`).

Status: proposal only. The epic is in phase `design` (next step: write the technical design). `tech-design/INDEX.md` has a header and no section rows. There are no tickets, open comments, or pending tracker changes. This proposal is not saved on the epic because a write was not approved.

Delivery repo: `evals/fixtures/receipt-repo`. Existing test `includes the total` passes with `node --test src/receipt.test.mjs`.

## Settled inputs

From `notes.md`:

- Printed receipts omit the store's return window.
- The receipt text includes a return line. Settled copy: `Returns within 14 days with receipt.`
- Plain string output. Do not add a PDF library.
- Existing receipt tests must keep passing.
- Non-goals: email receipts, and changing how the total is calculated.
- D1: receipt text is built in `src/receipt.mjs` only.

Current `renderReceipt` returns two lines. Amounts are already preformatted strings:

```js
export function renderReceipt(order) {
  return `${order.item}\nTotal: ${order.total}`;
}
```

For `{ item: "Tea", total: "$4.00" }` that is:

```
Tea
Total: $4.00
```

The existing test asserts `/Total: \$4\.00/` and does not look at other lines.

## Proposed notes

One section, one ticket id. The section heading matches the index title. Tracker stays empty because this epic has no tracker provider.

### `tech-design/INDEX.md`

Replace the current body (sha256 `f539464ec6eba6b0fb6732eba0b33e41e3e68705b5a222a16c92dba81d32b093`) with:

```markdown
# Index

| Title | File | Ticket | Tracker |
|---|---|---|---|
| Return window line | tech-design/return-window.md | T1 | |
```

### `tech-design/return-window.md`

```markdown
## Return window line

Ticket T1. Receipt text stays a plain string built only in `src/receipt.mjs` (D1).

### Behavior

`renderReceipt` keeps the item line and the total line, then appends the settled return line:

```
${order.item}
Total: ${order.total}
Returns within 14 days with receipt.
```

The return line is a fixed string. It does not read a new field on `order`. `order.total` is still interpolated as given. No PDF library, no new module, and no email path.

Example for `{ item: "Tea", total: "$4.00" }`:

```
Tea
Total: $4.00
Returns within 14 days with receipt.
```

### Tests

Leave `includes the total` in `src/receipt.test.mjs` as it is. That assertion still matches the total line.

Add one test on the same Tea fixture that asserts the full string:

```
Tea
Total: $4.00
Returns within 14 days with receipt.
```

Run `node --test src/receipt.test.mjs` from `evals/fixtures/receipt-repo`.

### Out of scope

Email receipts. Changing how the total is calculated. Building receipt text anywhere other than `src/receipt.mjs`.
```

`notes.md` stays as it is (sha256 `e43e275497ee0e4bb8426e09b366d5c1264ff3b4208c08cb737fd9b0638c444b`). Decisions and copy are already settled there.

## Implementation sketch for T1

In `src/receipt.mjs`, append the return line inside `renderReceipt` and leave the total interpolation unchanged:

```js
export function renderReceipt(order) {
  return `${order.item}\nTotal: ${order.total}\nReturns within 14 days with receipt.`;
}
```

In `src/receipt.test.mjs`, add a full-string assertion beside the existing total test. Do not edit the existing test.

T1 is named in the design only. No ticket brief is drafted, because this task stops at the design proposal.

## Files read

- `/agent/repos/plugin/evals/fixtures/design-normal/prompt.md`
- `/agent/repos/plugin/evals/fixtures/design-normal/paraphrase.md`
- `/agent/repos/plugin/evals/fixtures/design-normal/notes/notes.md`
- `/agent/repos/plugin/evals/fixtures/design-normal/notes/tech-design/INDEX.md`
- `/agent/repos/plugin/evals/fixtures/design-normal/mock-server.json`
- `/agent/repos/plugin/evals/mock-tuskway.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/README.md`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.mjs`
- `/agent/repos/plugin/evals/fixtures/receipt-repo/src/receipt.test.mjs`
