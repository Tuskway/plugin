---
name: setup-tuskway
description: Checks the Tuskway connection and workspace, then gives one next step. Use when the user asks to set up Tuskway or the connection is missing; not for installing the plugin or editing repo config.
license: MIT
metadata:
  author: Tuskway
  provenance: independently authored for the Tuskway plugin
---

# Set up Tuskway

Find out whether this session can reach Tuskway, then give one next step that matches what you just saw. Do not install the plugin and do not write configuration.

## Inputs

The user asked to set up Tuskway, or a workflow skill stopped because the connection was missing. You may not know the client. That is an input to ask for, not a guess.

## Check

1. Look for the Tuskway tools in this session and read the schema for `epic_list`. Hosts prefix names. If the tool is not there, stop. Ask which client they are using if they have not said. The user types that client's install line from the plugin README. Do not paste an install command when the client is unknown, and do not quote a sign-in command as if it creates missing tools. Do not claim private beta. Do not run a marketplace install, `npx`, `pi install`, or any other installer. Do not retry.
2. Call `epic_list` with no workspace only when the tool is present. If the call fails, quote the error and stop. Mention a private-beta invite at hello@tuskway.com only when the error says private beta or invite. Otherwise do not invent the cause. Do not retry or work around it. The sign-in rows in [the client notes](references/clients.md) apply only after the tool exists and the call failed. Say that those rows were copied from the plugin README and were not executed here.
3. An empty workspace list: the next step is to create a workspace at https://tuskway.com. Do not state a price or a trial. Stop.
4. One workspace: `epic_list` with that slug. Several: ask, unless one epic's `trackerRepo` matches a delivery directory that is its own git toplevel. A nested folder does not inherit the outer checkout's remote. [Target resolution](references/target.md).
5. From the epic's `phase.current` and `phase.nextStep`, suggest one skill that matches that state. Discovery or missing intake: `start-epic-tuskway`. Design: `write-design-tuskway`. An approved design with no briefs: `draft-tickets-tuskway`. Delivery: `plan-tuskway`, which will name ready tickets. Do not pick a ticket the server did not mark ready. Do not launch work.

## Stop

Stop after the one next step. Write no file in the user's repo, no token, and no MCP config. Do not claim a client was verified because this skill ran.

## Done

Report what you called, the error or the workspace you found, the phase you read, and the single next step. If you did not call `epic_list`, say the connection was not available.
