I called `epic_list` with no workspace. The connection is available, and the call returned two workspaces:

- `fixture` — Fixture (owner)
- `plugin-mirror` — Plugin mirror (owner)

I did not read a phase. With more than one workspace, the next step is to match an epic `trackerRepo` only when the delivery directory is its own git toplevel. `evals/fixtures/receipt-repo` is not its own git repository; the surrounding checkout is `/agent/repos/plugin`, and a nested folder does not inherit that remote. It has no remote of its own, so there is nothing to match.

I did not pick a workspace. Which workspace should I use, `fixture` or `plugin-mirror`?
