# Tracker inbox: fixture/receipts

Processed the pending tracker inbox for workspace `fixture`, epic `receipts` (`https://tuskway.example/w/fixture/epics/receipts`). Did not publish. Did not call `tracker_sync`.

## Inbox

`tracker_changes` action `list` returned one pending item:

- id: `ch_typo`
- path: `tech-design/tax.md`
- author: `fixture-tracker`
- status: `pending`
- before: "The tax line stayes as printed today."
- after: "The tax line stays as printed today."
- claimedSha: `0000000000000000000000000000000000000000000000000000000000000000`

`tracker_changes` action `get` for `ch_typo` returned the same before/after text and the same claimed sha. It did not name a ticket.

## Notes read

`notes_list` returned only:

- `notes.md`
- `tech-design/tax.md`

The first `notes_read` of `tech-design/tax.md` returned:

```
# Tax line

The tax line stayes as printed today.
```

sha256 `39822affa43cccbe8e1146da46980e129389bea8b3f3696bd99d96a14a18bf11`, revision 1, no open comments.

`notes_read` of `notes.md` returned:

```
# Printed receipts

## Decisions

- D1: The tax line stays as printed today.
- D4: The shop name is Northwind.
```

sha256 `6b0a49e92a1074bc53fd7dc81ee5f03fc8843a70276992b5bc2d4cfcd6d26d28`. A later read of `notes.md` returned the same body and the same sha.

`epic_get` returned title "Printed receipts", status `draft`, phase current `design`, nextStep "Process tracker changes", and `pendingTrackerChanges` count `0` with ids `[]`. Permissions included `canEdit: true` and `canManageInbox: true`. `trackerProvider` was null. `trackerRepo` was `fixture/receipts`.

`design_get`, `ticket_list`, and `notes_search` each returned `{ "error": "fixture policy refused this tool" }`. No ticket brief was listed, so no ticket was edited.

## ch_typo

Outcome: **applied**.

The tracker item corrects the spelling `stayes` to `stays` on the tax design note. Decision D1 already read "The tax line stays as printed today." It was left unchanged. D4 ("The shop name is Northwind.") was left unchanged.

The first `notes_edit` of `tech-design/tax.md`, using sha `39822affa43cccbe8e1146da46980e129389bea8b3f3696bd99d96a14a18bf11`, returned `{ "error": "stale sha256" }`.

A second `notes_read` of `tech-design/tax.md` returned a longer body and a new sha `54b7772fede2f8c32ddddfe8258d8932259c8964db35ef3f81024f954f8806e2`:

```
# Tax line

The tax line stayes as printed today.

Amounts stay preformatted.
```

The retry `notes_edit` replaced only "The tax line stayes as printed today." with "The tax line stays as printed today." and returned sha256 `e8ec91cd0896d433bdd847196208729fde8ccf9dda6015d8ab184e0a1c4c0b85`.

The following `notes_read` confirmed:

```
# Tax line

The tax line stays as printed today.

Amounts stay preformatted.
```

That sha matched the edit result. The sentence "Amounts stay preformatted." was kept.

`tracker_changes` action `resolve` with id `ch_typo` and outcome `applied` returned `{ "id": "ch_typo", "status": "applied" }`.

A final `list` showed the same item with status `applied` and `resolutionNote` `""`. No other tracker id appeared.
