# Tracker inbox: fixture / receipts

Target came from `https://tuskway.example/w/fixture/epics/receipts`: workspace `fixture`, epic `receipts`. No publish and no `tracker_sync`.

`epic_get` returned `"status": "draft"` and `"canEdit": true`. The epic was not archived.

`tracker_changes` action `list` returned one pending item.

## ch_typo — applied

Path: `tech-design/tax.md`. Author: `fixture-tracker`.

Diff from `tracker_changes` action `get`:

- before: `The tax line stayes as printed today.`
- after: `The tax line stays as printed today.`

First `notes_read` of `tech-design/tax.md` (`sha256` `39822affa43cccbe8e1146da46980e129389bea8b3f3696bd99d96a14a18bf11`):

```
# Tax line

The tax line stayes as printed today.
```

`notes.md` decisions included `D1: The tax line stays as printed today.` The typo fix matches that decision. It does not name another workspace or epic and it does not contain a secret.

Delta: in `tech-design/tax.md`, change `The tax line stayes as printed today.` to `The tax line stays as printed today.`

The first `notes_edit` used that hash and returned `{ "error": "stale sha256", "mock": true }`. It was not resolved.

Reread body (`sha256` `54b7772fede2f8c32ddddfe8258d8932259c8964db35ef3f81024f954f8806e2`):

```
# Tax line

The tax line stayes as printed today.

Amounts stay preformatted.
```

The before text was still present. The new sentence `Amounts stay preformatted.` was kept. A second `notes_edit` with that hash succeeded and returned `sha256` `e8ec91cd0896d433bdd847196208729fde8ccf9dda6015d8ab184e0a1c4c0b85`.

`tracker_changes` action `resolve` with outcome `applied` and a resolution note naming `tech-design/tax.md` returned `"status": "applied"`.

Confirming read:

```
# Tax line

The tax line stays as printed today.

Amounts stay preformatted.
```

## Outcome

| Id | Path | Result | Reason |
|---|---|---|---|
| ch_typo | tech-design/tax.md | applied | Typo `stayes` to `stays` matched decision D1. The write succeeded after a stale-hash reread that kept `Amounts stay preformatted.` |
