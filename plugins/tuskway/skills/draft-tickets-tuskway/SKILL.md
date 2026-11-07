---
name: draft-tickets-tuskway
description: Turns an approved Tuskway design into self-contained ticket briefs with dependencies and verification criteria. Use when splitting that design into implementation tickets; not for starting implementation.
license: MIT
metadata:
  author: Tuskway
  provenance: independently authored for the Tuskway plugin
---

# Draft tickets

Each brief should stand on its own. Splitting a design is not implementing it, and it is not publishing to a tracker.

## Inputs

An epic whose design the user has approved, and the delivery repo when the design names files. If the design is not approved, stop after a preview. Do not call `ticket_draft`.

## Target

Resolve workspace and epic before any other call. [Target resolution](references/target.md).

1. Use a URL or an explicit workspace and epic. Drop userinfo, query, and fragment.
2. Otherwise reuse one settled target. A new target replaces it.
3. Otherwise `epic_list` with no workspace. Match `trackerRepo` only when the named delivery directory is its own git toplevel. A nested folder does not inherit the outer remote. Not exactly one non-archived epic: ask. A bare key does not select an epic.
4. Read the schema. Pass only values you have. No connection: stop. Do not install.

## Steps

1. `design_get` and `notes_read` `notes.md`. Decisions are constraints. Open only the sections this split covers.
2. List the behaviors the design specifies. Each one needs a brief. A behavior you cannot place stays uncovered in the preview.
3. For each slice, write the goal, the scope, the files, and acceptance checks that name a command or an observable result. Open a path before the brief claims it. An unopened path is unknown.
4. `dependsOn` is a ticket that must merge first. Slices that only share files get the same `areas` entry and no dependency, unless the design says one lands first. Do not invent an order the design did not ask for.
5. Show the preview: key, title, acceptance, `dependsOn`, `areas`, and uncovered requirements. File the briefs only if the user already asked or approves this preview.
6. `ticket_draft` each brief. On an update, pass `expectedSha256` from `ticket_get`. Do not call `tracker_sync`.
7. Read the briefs back with `ticket_get` or `ticket_list`. Report the graph the server returned.

The field shape is in [the brief](references/brief.md).

## Stop

Stop before `ticket_draft` when the design is unapproved, the epic is archived, or you cannot edit. A reader uses `suggest_change` and does not draft. Do not start implementation.

## Done

Report the target, whether you previewed or filed, each requirement and the ticket that covers it, dependencies versus shared areas, paths you did not find, and the urls returned. Filed briefs are not started work.
