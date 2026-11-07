# Total label

## Behavior

The total line label changes from `Total:` to `Amount due:`. It does not wait on the return line or the barcode.

## Affected code

- src/receipt.mjs — same file, no required merge order.
- src/receipt.test.mjs — "includes the total" currently expects `Total:`.
