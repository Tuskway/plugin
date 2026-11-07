# Printed receipts

## Desired outcome

Printed receipts include the settled return line, then a barcode, and a renamed total label.

## Decisions

- D1: Receipt text is built in src/receipt.mjs only.
- D2: The return copy is "Returns within 14 days with receipt."
- D3: The barcode work merges only after the return-line ticket.
- D4: Renaming the total label shares src/receipt.mjs and has no merge order of its own.

## Non-goals

- Email receipts.
- A PDF renderer.
