# Plan round

Target: workspace `fixture`, epic `receipts` (`https://tuskway.example/w/fixture/epics/receipts`).

`ticket_plan` is the server plan. Waves, ready, waiting, and held were not recomputed. No status was changed. No ticket was started.

## Waves

Wave 1 keys: T1, T2

- T1 — Scaffold the receipt — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT1.md`
- T2 — Add the return line — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT2.md`

Wave 2 keys: T4, T5

- T4 — Add the loyalty barcode — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT4.md`
- T5 — Rename the total label — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT5.md`

## Already in progress

- T1 — Scaffold the receipt — areas `src/receipt.mjs` — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT1.md`

## Waiting

- T5 — Rename the total label — waitingOn T2 — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT5.md`

## Held

- T4 — heldBy T1 — area `src/receipt.mjs` — `https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT4.md`

T4 is also in `ready`. It is held, so it is not a handoff.

## Tip

`suggestedSharedPaths`: `src/receipt.mjs`

## Handoff

Ready and not held and not active: T2.

```text
Tackle T2 in fixture/receipts (https://tuskway.example/w/fixture/epics/receipts/files?path=tickets%2FT2.md) with tackle-ticket-tuskway.
```

Wave keys as returned: wave 1 `T1`, `T2`; wave 2 `T4`, `T5`.
