Filed the three ticket briefs the approved receipts design already names. Nothing was published to a tracker, and the delivery repo was not changed.

Paths opened before a brief claimed them: `src/receipt.mjs` and `src/receipt.test.mjs`. The barcode section says the repo has no barcode file, so that brief does not claim one.

| Key | Title | dependsOn | areas |
|---|---|---|---|
| T2 | Return line | none | `src/receipt.mjs`, `src/receipt.test.mjs` |
| T4 | Barcode | T2 | `src/receipt.mjs` |
| T5 | Total label | none | `src/receipt.mjs`, `src/receipt.test.mjs` |

**T2 — Return line.** `renderReceipt` appends the exact line `Returns within 14 days with receipt.` after the total line. The item line and the `Total:` line stay as they are. The existing test named "includes the total" must still pass. `node --test src/receipt.test.mjs` from the delivery repo. https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT2.md

**T4 — Barcode.** After the return line is in the receipt, `renderReceipt` appends a barcode line. The only file is `src/receipt.mjs`. This merges only after T2. https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT4.md

**T5 — Total label.** The total line label changes from `Total:` to `Amount due:`. The test named "includes the total" currently expects `Total:` and must expect `Amount due:`. It does not wait on the return line or the barcode. It shares `src/receipt.mjs` and `src/receipt.test.mjs` with T2. https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT5.md
