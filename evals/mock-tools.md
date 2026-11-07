# Fixture mock tools

This file is the argument list for `evals/mock-tuskway.mjs`. It is not `https://tuskway.com` and it is not a skill. Every result includes `"mock": true`. A refused or failed call returns `{ "error": "...", "mock": true }` and is still appended to the log.

```bash
node evals/mock-tuskway.mjs --fixture FIXTURE --state STATE_DIR --log CALLS.jsonl TOOL --args '{"workspace":"fixture"}'
```

Pass only values you already have. Do not read `mock-server.json`.

| Tool | Required arguments |
|---|---|
| epic_list | none. Omit `workspace` to list workspaces. Pass `workspace` to list that workspace's epics. |
| epic_get | `workspace`, `epic` |
| epic_create | `workspace`, `slug`, `title` |
| notes_read | `workspace`, `epic`, `path` |
| notes_list | `workspace`, `epic` |
| notes_search | `workspace`, `epic`, `query` |
| notes_write | `workspace`, `epic`, `path`, `body`. Pass `expectedSha256` from the read when the note already exists. A mismatch returns `stale sha256`. |
| notes_edit | `workspace`, `epic`, `path`, `oldString`, `newString`, `expectedSha256` |
| design_get | `workspace`, `epic` |
| ticket_list | `workspace`, `epic` |
| ticket_get | `workspace`, `epic`, `key` |
| ticket_plan | `workspace`, `epic` |
| ticket_draft | `workspace`, `epic`, `key`, `title`. Optional `goal`, `scope`, `acceptance`, `files`, `dependsOn`, `areas`, `expectedSha256`. |
| ticket_update | `workspace`, `epic`, `key`, `status` |
| note_comment | `workspace`, `epic`, `action` (`list`, `reply`, `resolve`). `reply` needs `id` and `body` and leaves the comment open. `resolve` needs `id`. |
| suggest_change | `workspace`, `epic`, `path`, `message` |
| tracker_changes | `workspace`, `epic`, `action` (`list`, `get`, `resolve`). `get` needs `id`. `resolve` needs `id` and `outcome` (`applied` or `dismissed`). |
| tracker_sync | no successful publish. The fixture returns an error. |
