# Printed receipts

## Problem

Printed receipts omit the store's return window.

## Desired outcome

The receipt text includes a return line. The number of days is not decided in these notes.

## Constraints

- Plain string output.

## Non-goals

- Email receipts.
- Changing how the total is calculated.

## Decisions

- D1: Receipt text is built in src/receipt.mjs only.
- D2: Return copy is owned by legal and must be loaded from src/policy/legal.md.
