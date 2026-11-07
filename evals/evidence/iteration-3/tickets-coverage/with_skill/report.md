# Receipts ticket briefs

Filed briefs for the approved design. These tickets are not started work, and nothing was published to a tracker.

## Target

- Workspace: `fixture`
- Epic: `receipts` (Printed receipts, status draft, editable)
- URL: https://tuskway.example/w/fixture/epics/receipts
- Delivery repo: `evals/fixtures/receipt-repo`

## Coverage

| Requirement | Ticket |
|---|---|
| `renderReceipt` appends the exact line `Returns within 14 days with receipt.` after the total line, and the test named `includes the total` still passes | T2 Return line |
| After that return line is present, `renderReceipt` appends a barcode line. This merges only after T2 | T4 Barcode |
| The total line label changes from `Total:` to `Amount due:`, with no wait on the return line or the barcode | T5 Total label |

Uncovered requirements: none. Email receipts and a PDF renderer stay out of scope.

## Graph returned by ticket_list

| Key | Title | dependsOn | areas | URL |
|---|---|---|---|---|
| T2 | Return line | none | `src/receipt.mjs`, `src/receipt.test.mjs` | https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT2.md |
| T4 | Barcode | T2 | `src/receipt.mjs` | https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT4.md |
| T5 | Total label | none | `src/receipt.mjs`, `src/receipt.test.mjs` | https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT5.md |

`ticket_get` agrees on those areas. It returns T4 `dependsOn` as `{ key: "T2", epic: "receipts", title: "T2", status: "unknown" }`. T2 and T5 `dependsOn` are empty. Each ticket status is `todo`. `plan.ready` is false and `waitingOn` is empty.

T4 depends on T2 because the barcode section and decision D3 say that work merges only after the return-line ticket. T2, T4, and T5 share `src/receipt.mjs`, so that path is an area on each brief. T2 and T5 also share `src/receipt.test.mjs`. T5 has no dependency: decision D4 and the total-label section give that rename no merge order.

## Acceptance

**T2 Return line**

1. `renderReceipt` appends the exact line `Returns within 14 days with receipt.` after the total line.
2. The test named `includes the total` still passes.
3. `node --test src/receipt.test.mjs` from the delivery repo passes.

**T4 Barcode**

1. `renderReceipt` appends a barcode line after the return line `Returns within 14 days with receipt.`

**T5 Total label**

1. `renderReceipt` prints `Amount due:` in place of `Total:`.
2. The test named `includes the total` expects `Amount due:` and `node --test src/receipt.test.mjs` from the delivery repo passes.

## Paths

Opened and claimed: `src/receipt.mjs`, `src/receipt.test.mjs`.

The delivery repo also contains `README.md`. It has no separate barcode file, so T4 claims only `src/receipt.mjs`.
