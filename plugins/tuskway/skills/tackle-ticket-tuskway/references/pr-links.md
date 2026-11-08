# Tracker lines on a pull request

Use this only when the developer's own process opens a pull request. Their branch and title conventions stay. The key has to appear where that tracker looks for it. Build the line from `ticket_get` (`trackerProvider`, `trackerExternalId`) and `epic_get` (`trackerRepo`). Do not guess an id the tools did not return.

| Tracker | Branch | Title | Body | Closes on merge |
|---|---|---|---|---|
| GitHub | free | free | `Closes #191`, or `Closes owner/repo#191` when the code repo is not `trackerRepo` | Yes, into the default branch |
| GitLab | free | free | `Closes #12`, or `Closes group/project#12` | Yes, on that project's default closing pattern and default branch |
| Linear | contains `ENG-42` | starts with `ENG-42` | `Fixes ENG-42` | Only through the customer's own Linear integration. A team can turn magic words off. |
| Jira | contains `PROJ-7` | starts with `PROJ-7` | mentions `PROJ-7` | No. Jira shows the link in Development. Status changes only if the customer's automation does that. |
| None | free | free | Tuskway line only | n/a |

GitLab closing patterns are per project. Linear and Jira linking both need the customer's integration with the code host. Say that caveat when the tracker is Linear or Jira. Do not claim a Jira key auto-closes.

End the body with one line per ticket:

```text
Tuskway: <ticket title> — <ticket url from ticket_get>
```

Several tickets in one pull request: one closing line and one `Tuskway:` line for each. Later lookups search the ticket URL in the body. The branch is the developer's and may contain no key, so it is only a fallback.
