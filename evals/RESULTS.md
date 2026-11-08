# Evaluation record

This file is the public record of the mock runs. The model transcripts, call logs, and copied repos are not in this tree. The mock in `evals/mock-tuskway.mjs` is not `https://tuskway.com`. No live Tuskway write, client install, or account sign-in was part of these runs.

The old generated snapshot at `7933ea3` was unavailable. GitHub returned 404. It was not recreated.

## What was graded

A question mark in a report was not treated as clarification. Fetching both briefs for a bare ticket key was not treated as choosing an epic. After that correction, the four exemplar pairs (`design-normal`, `design-gap`, `tackle-normal`, `tackle-boundary`) were critical-pass on the graded outcomes for both tools-only and with-skill. `tackle-normal` tools-only did not call `epic_get`. The receipt check passed on an editable fixture. The first runs read fixture files and the mock source, so they were model-written and not blind to the fixture.

Later mock pairs mostly tied on the graded outcome. Intake kept the existing decisions with or without the skill. Both ticket runs filed the dependency and the shared area the fixture required. Both tracker-link runs produced the same link text, including no false Jira auto-close. The skill run also named the Linear and Jira caveats. Plan tools-only handed off the ready ticket and left the held ticket. `tracker-apply` both conditions hit a stale hash, kept the sentence that appeared on the reread, applied the spelling change, and resolved only after that write. That pair ties.

Two tools-only runs failed for real. `change-safety` tools-only applied a contradicting decision and resolved both comments. The skill run left the malicious comment open, replied on the contradicting comment, and did not change the decision. `setup-empty` tools-only did not name `https://tuskway.com`. The skill run named that URL and did not state a price.

`routing-descriptions` labeled six prompts from skill descriptions, including three near-misses as no skill. That is a description-match proxy.

## Not shown

Host description routing is not shown. One cloud agent searched the repository, found every `SKILL.md`, and read the canonical skill file. It then read `evals/routing.json`. That is file search, not a host selecting a skill from its description.

These runs do not show client install, OAuth sign-in, live tracker calls, or a release tag. Host description routing is not shown. `sync-design-tuskway` does not write a design edit unless that exact edit was shown and the user approved it; `evals/drift.test.mjs` locks that gate. That test is not a client install and not a host routing result. This record is not approval to merge.
