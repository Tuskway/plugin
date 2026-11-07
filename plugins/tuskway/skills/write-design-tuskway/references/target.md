# Target resolution

Use this when the main skill says to resolve a workspace and epic. Do the resolution before any call that takes those values.

## URL

Take the path only. Drop userinfo, query, and fragment, and do not print a remote that still contains credentials.

`https://tuskway.com/w/fixture/epics/receipts/files?path=tickets%2FT2.md`

- workspace: `fixture`
- epic: `receipts`
- key, when the path is `tickets/<KEY>.md`: `T2`

A different host with the same `/w/<workspace>/epics/<epic>/` path is the same shape. The hosted product is `https://tuskway.com`.

## One workspace, or several

`epic_list` with no workspace argument returns the workspaces this session can access. Each item has a `slug`. When the list has one workspace, call `epic_list` again with that slug.

When it has several, list epics and compare `trackerRepo` with the delivery repo's origin:

- `git@github.com:acme/receipts.git` matches `acme/receipts`
- `https://github.com/acme/receipts.git` matches `acme/receipts`
- `https://gitlab.com/group/sub/receipts.git` matches `group/sub/receipts`

Match only a remote you read from the repo. Linear and Jira identifiers do not identify a delivery repo. Archived epics are omitted from the list unless you pass `includeArchived`; naming one still opens it in `epic_get`.

Zero matches, or more than one, means ask. Show the candidate slugs and titles. Do not pick the first row.

## Arguments

Read the schema the connected server exposes for the logical tool. A host may prefix the tool name. Call the tool only with values you already resolved. If a value is missing, ask the user. The argument is the value, not a sentence about the value.
