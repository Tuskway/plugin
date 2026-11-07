# Brief fields

`ticket_draft` takes `key`, `title`, `goal`, `scope`, `acceptance`, `files`, `dependsOn`, and `areas`. `title` is required with the key. The goal is one outcome. The scope says what is in and what is out. Acceptance is a list of checks, each something a later run can mark passed, failed, or skipped.

```markdown
## Goal

Printed receipts include the return window.

## Scope

Append the line in src/receipt.mjs and cover it with a test. Do not add a module.

## Acceptance criteria

1. renderReceipt includes the exact return line.
2. The existing total test still passes.

## Files

src/receipt.mjs, src/receipt.test.mjs
```

`dependsOn` entries are keys such as `T3`, or `other-epic/T3` when the prerequisite is in another epic. `areas` are the paths or tags those tickets must not edit at the same time. A shared path without a merge order is an area, not a dependency.

After filing, the read-back is the source of the report. Do not describe a graph you did not read back.
