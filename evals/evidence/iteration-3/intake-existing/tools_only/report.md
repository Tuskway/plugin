Updated the intake note on the existing [Printed receipts](https://tuskway.example/w/fixture/epics/receipts) epic (`notes.md`).

**Constraint added**
- Amounts stay preformatted strings.

**Delivery repo**
- Set to `evals/fixtures/receipt-repo` (it was unknown).

**Decisions kept**
- D1: Receipt text is built in src/receipt.mjs only.
- D2: Do not change the total calculation.
- D3: The shop name is Northwind. This decision is unrelated to amounts.

Problem, desired outcome, plain-string output, the email-receipts non-goal, and the open question about the return window are unchanged. No tickets were drafted and nothing was published.
