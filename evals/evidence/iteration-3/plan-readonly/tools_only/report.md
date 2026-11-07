# Next round: Printed receipts

Epic: [Printed receipts](https://tuskway.example/w/fixture/epics/receipts) (`fixture/receipts`). No ticket was started.

Wave 1 is T1 and T2. T1 is already active. The rest of this round is T2. Wave 2 is T4 and T5, after the tickets they wait on finish. The shared path is `src/receipt.mjs`.

## Hand off

- **T2 — Add the return line.** Ready and unheld. It can run beside T1.

Tackle T2 in fixture/receipts (https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT2.md) with the tackle-ticket prompt.

## Do not hand off

- **T1 — Scaffold the receipt.** Already active on `src/receipt.mjs`. Leave that run as it is.
- **T4 — Add the loyalty barcode.** Listed as ready, and held by T1 on `src/receipt.mjs`. It is wave 2. Hand it off after T1 releases that file.
- **T5 — Rename the total label.** Waiting on T2. It is wave 2. Hand it off after T2 is merged.
