# Section and index

Propose one file per section. The index is `tech-design/INDEX.md`, a table in reading order:

```markdown
| Title | File | Ticket | Tracker |
|---|---|---|---|
| Return line | return-line.md | T2 | |
```

The Title cell matches the section's H1. File is the name under `tech-design/`, not a delivery-repo path. Ticket is the stable id this section belongs to, or empty when the design has not split work yet. Leave Tracker empty unless a published issue already exists. Do not invent an issue number.

Each section uses this shape:

```markdown
# <section title>

## Behavior

What a person can observe when this is done.

## Approaches

- A: <real option, and what it costs>
- B: <real option, and what it costs>

Recommendation: <A or B>, because <the constraint that decides it>.

## Affected code

- `<path>` — <the fact you read there>

Mark a path you did not open as unknown. Do not describe its contents.

## Risks

What fails if the recommendation is wrong.

## Verification

The check you found in the repo, the test name you read, and what that check does not prove.
```

Keep an existing section's unrelated text. On a write, send `expectedSha256` from the `notes_read` you just did.
