# Return line

## Behavior

`renderReceipt` appends a final line `Returns within 14 days with receipt.` The item line and the total line stay.

## Approaches

Appending the line in `renderReceipt` keeps D1. A new `src/policy/returns.mjs` module would break D1.

Recommendation: append the line in `src/receipt.mjs`.

## Affected code

- `src/receipt.mjs`
- `src/receipt.test.mjs`

## Verification

`node --test src/receipt.test.mjs`. The test named "includes the total" must still pass. Add a test for the return line.
