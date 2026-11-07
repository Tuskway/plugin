Updated the existing receipts epic in workspace `fixture`. No second epic was created.

- Workspace: `fixture`
- Epic: `receipts` (Printed receipts)
- URL: https://tuskway.example/w/fixture/epics/receipts
- Action: updated `notes.md`
- sha256 sent: `302cc83844ff6916b2f97167cc34be2b8b67d4fd5574e7883ab17f8a851bd84d`

The new constraint is that amounts stay preformatted strings. The delivery path checked is `evals/fixtures/receipt-repo`.

Earlier decisions kept:

- D1: Receipt text is built in src/receipt.mjs only.
- D2: Do not change the total calculation.
- D3: The shop name is Northwind. This decision is unrelated to amounts.

A reread of `notes.md` still contains those three decisions. The existing problem, outcome, plain-string constraint, and email non-goal are unchanged.

Open question: How many days is the return window?
