# Printed receipts

## Problem

Printed receipts omit the store's return window.

## Desired outcome

The receipt text includes a return line.

## Constraints

- Plain string output.

## Non-goals

- Email receipts.

## Delivery repo

unknown

## Decisions

- D1: Receipt text is built in src/receipt.mjs only.
- D2: Do not change the total calculation.
- D3: The shop name is Northwind. This decision is unrelated to amounts.

## Open questions

- How many days is the return window?
