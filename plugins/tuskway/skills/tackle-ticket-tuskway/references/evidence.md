# Acceptance evidence

One row per acceptance criterion in the brief. Do not add a pass for work the brief did not ask for.

```markdown
| Criterion | Result | Evidence |
|---|---|---|
| <text from the brief> | passed | `<command>` exited 0. <what it showed> |
| <text from the brief> | failed | `<command>` exited <n>. <the assertion that failed> |
| <text from the brief> | skipped | <why it did not run> |
```

`passed` cites a command, a diff, or a file you produced in this run. A pull request URL is not a pass. `failed` stays visible. `skipped` is for a check you could not run, with the reason, not for a check you assume would pass.

Also list:

- workspace, epic, key, and ticket url
- status transitions you actually sent, or "none"
- files the brief named that you did not find
- blockers still open
