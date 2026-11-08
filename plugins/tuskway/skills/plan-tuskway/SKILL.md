---
name: plan-tuskway
description: Shows which Tuskway tickets can start together and writes a ready-only handoff line for each. Use when the user asks to plan an epic or the next round; not for implementing tickets or launching agents.
license: MIT
metadata:
  author: Tuskway
---

# Plan a round

Say what the server says can start, and hand off only those tickets. This skill writes nothing and starts nothing.

## Inputs

A workspace and epic. You do not need a ticket key.

## Target

Resolve them before `ticket_plan`. [Target resolution](references/target.md).

1. Use a URL or an explicit workspace and epic. Drop userinfo, query, and fragment.
2. Otherwise reuse one settled target.
3. Otherwise `epic_list` with no workspace. A remote counts only when the named delivery directory is its own git toplevel. Otherwise ask. A bare key does not select an epic.
4. Read the schema. No connection: stop. Do not install.

## Steps

1. `ticket_plan` for that epic. The waves, ready set, waiting set, and held set are the server's. Do not recompute them.
2. A wave is `{ number, keys }`. Titles, areas, and urls come from the `ready`, `active`, `waiting`, and `held` entries, or from `ticket_list` when a key has no entry. Do not invent a title.
3. Show each wave. Then tickets already in progress, waiting tickets with `waitingOn`, and held tickets with `heldBy` and `area`. If `suggestedSharedPaths` is non-empty, mention it once, as a tip.
4. A handoff line is only for a key that is in `ready` and is not in `held` or `active`. Use the url from the server:

```text
Tackle T5 in <workspace>/<epic> (<url>) with tackle-ticket-tuskway.
```

5. When that set is empty, say there is no handoff and name the held or waiting reason. Do not hand off a held ticket just because it also appears in `ready`.

## Stop

`ticket_plan` is read-only. Do not call `ticket_update`, `notes_write`, `notes_edit`, `ticket_draft`, or `tracker_sync`. Do not launch an agent, open a pull request, or claim the ticket is started. The developer decides how many people or agents run, and how they review.

## Done

Report the target, the wave keys as returned, the handoff lines or the reason there are none, and that no status was changed. Run it again after a round merges. When those tickets are done, sync-design-tuskway is the design check, and only after the user asks for it. This report is not implementation.
