# Return line

## Behavior

renderReceipt appends the exact line "Returns within 14 days with receipt." after the total line.

## Affected code

- src/receipt.mjs — the function returns the item line and `Total:` line today.
- src/receipt.test.mjs — the test named "includes the total" must keep passing.

## Verification

`node --test src/receipt.test.mjs` from the delivery repo.
