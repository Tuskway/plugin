# Design proposal: return window line

Target: workspace `fixture`, epic `receipts` (`/w/fixture/epics/receipts/`). Resolved from `https://tuskway.example/w/fixture/epics/receipts` before any Tuskway call.

Result: **proposal**. Nothing was written to Tuskway. The user has not approved a write. Epic `status` is `draft` and `permissions.canEdit` is true, so a later approved write is allowed. This is not a ticket split.

`notes.md` sha256 (kept, not rewritten): `a63421252d634dec298f769387b8062d55cdcb9c519ac0f6c8069e04d2623a16`

`tech-design/INDEX.md` sha256 that a later write would send as `expectedSha256`: `f539464ec6eba6b0fb6732eba0b33e41e3e68705b5a222a16c92dba81d32b093`

`tech-design/return-window.md` is not stored. There is no sha256 to send for it until a write creates it.

## Requirements

From `notes.md` and the user:

- Printed receipt text includes a return line.
- Output stays a plain string.
- D1: receipt text is built in `src/receipt.mjs` only.
- D2: return copy is owned by legal and must be loaded from `src/policy/legal.md`.
- The total calculation stays as it is.
- Email receipts stay out of scope.

## Open

The number of days is not decided in the notes. That slice is provisional. This proposal does not pick a number.

`src/policy/legal.md` is not in the delivery repo. Its contents are unknown. The proposal does not quote a return sentence.

Question for whoever decides the window: how many days is the return window, and is that number already the text in `src/policy/legal.md`?

## Approaches compared

- A: In `src/receipt.mjs`, `renderReceipt` keeps the call `renderReceipt({ item, total })`, keeps the item line and `Total:` line, and appends the return copy loaded from `src/policy/legal.md`. Cost: the renderer depends on a file that is not in the repo today, so the exact sentence stays unspecified, and each render reads that file.
- B: Put the return line in a PDF footer at `src/pdf/footer.ts`. Cost: that contradicts D1, D2, the plain-string constraint, and the README statement that receipt text is built only in `src/receipt.mjs`. The path is not in the repo.

Recommendation: A, because D1 and D2 already choose the module and the copy source, and the opened test calls `renderReceipt` with only `{ item, total }`.

Given up: a separate PDF footer module, and any day count chosen in code.

One stored approach is enough. Approach B contradicts decisions already written in `notes.md`.

## Proposed index row

Current `tech-design/INDEX.md` has a header and no section rows. `design_get` returned no sections. No existing section was opened. On approval, add one row and leave the `# Index` heading in place. Tracker stays empty. No issue number is invented. `ticket_list` returned no tickets. `T1` is the proposed stable id for this section only. No ticket brief is drafted.

| Title | File | Ticket | Tracker |
|---|---|---|---|
| Return window line | return-window.md | T1 | |

Title matches the H1 below.

## Proposed section `tech-design/return-window.md`

```markdown
# Return window line

## Behavior

`renderReceipt` still returns a plain string. The string still starts with the item line and a `Total:` line whose amount is the preformatted `order.total`. After that total line, the string includes the return copy loaded from `src/policy/legal.md`. Email receipts are out of scope. The number of days is not stated here, because the notes leave it undecided and `src/policy/legal.md` was not in the delivery repo to read.

## Approaches

- A: Load `src/policy/legal.md` inside `src/receipt.mjs` and append that text from `renderReceipt`, keeping the current `{ item, total }` argument. Cost: a file read on the render path, and the legal file is absent today so the sentence cannot be specified yet.
- B: Add the return line as a PDF footer in `src/pdf/footer.ts`. Cost: this contradicts D1 and D2 and the plain-string constraint, and that path is not in the repo.

Recommendation: A, because D1 builds receipt text only in `src/receipt.mjs`, D2 loads the return copy from `src/policy/legal.md`, and the opened test calls `renderReceipt({ item, total })`.

## Affected code

- `src/receipt.mjs` — `renderReceipt(order)` returns the item, a newline, and `Total: ` plus `order.total`. The file comment says amounts are preformatted strings, never cents.
- `src/receipt.test.mjs` — the test named "includes the total" calls `renderReceipt({ item: "Tea", total: "$4.00" })` and asserts `/Total: \$4\.00/`.
- `README.md` — documents the test command `node --test src/receipt.test.mjs`, says receipt text is built only in `src/receipt.mjs`, and says amounts are preformatted strings.
- `src/policy/legal.md` — unknown. The path is not in the delivery repo. No contents are described.
- `src/pdf/footer.ts` — unknown. The path is not in the delivery repo. No contents are described.

## Risks

If `src/policy/legal.md` is missing at render time, the return line cannot be loaded. If that file's day count is wrong, every printed receipt shows the wrong window. If the append changes the `Total:` line, the test "includes the total" fails. A PDF footer would leave the plain string from `renderReceipt` without a return line.

## Verification

Command documented in `README.md`: `node --test src/receipt.test.mjs`. Test name read: "includes the total". That test checks the total line for item Tea and total `$4.00`. It does not prove a return line is present, does not read `src/policy/legal.md`, and does not check a day count.
```

## Files read

Skill and the references it links:

- `plugins/tuskway/skills/write-design-tuskway/SKILL.md`
- `plugins/tuskway/skills/write-design-tuskway/references/target.md`
- `plugins/tuskway/skills/write-design-tuskway/references/section-template.md`
- `plugins/tuskway/skills/write-design-tuskway/references/example.md`

Eval inputs:

- `evals/fixtures/design-gap/prompt.md`
- `evals/mock-tuskway.mjs` (local mock used for every Tuskway call)

Tuskway notes, through the mock:

- `notes.md`
- `tech-design/INDEX.md`

Delivery repo `evals/fixtures/receipt-repo`:

- `README.md`
- `src/receipt.mjs`
- `src/receipt.test.mjs`
- `src/policy/legal.md` — open attempted, file not found
- `src/pdf/footer.ts` — open attempted, file not found

The repo contains only `README.md`, `src/receipt.mjs`, and `src/receipt.test.mjs`.
