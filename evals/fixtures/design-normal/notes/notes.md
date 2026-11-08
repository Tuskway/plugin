# Printed receipts

## Problem

Printed receipts omit the store's return window.

## Desired outcome

The receipt text includes a return line. The settled copy is "Returns within 14 days with receipt."

## Constraints

- Plain string output. Do not add a PDF library.
- Existing receipt tests must keep passing.

## Non-goals

- Email receipts.
- Changing how the total is calculated.

## Decisions

- D1: Receipt text is built in src/receipt.mjs only.
