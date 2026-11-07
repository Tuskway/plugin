# Client notes

These rows are the install and sign-in lines from the plugin README. They were compared with client docs and were not run in those clients. T5 records real client results. Repeat a row only after the user tells you which client this session is. Do not invent a command for a client that is not in the table. An unknown client means ask, or point at the README, not a guessed flag.

| Client | Sign in, as documented |
|---|---|
| Claude Code | `/mcp`, select `plugin:tuskway:tuskway` |
| Cursor | Cursor's sign-in prompt |
| Grok Bot | Through the Cursor install |
| Codex | `codex mcp login tuskway` |
| Copilot CLI | `/mcp auth tuskway` |
| Grok Build | `/mcps`, select tuskway, press `i` |
| OpenCode | `opencode mcp auth tuskway` |
| Pi | `pi mcp login tuskway` |

The hosted server is `https://tuskway.com/mcp`. This skill does not register an OAuth client and does not store a token. If the user has not installed the plugin, they type the install command. You do not.
