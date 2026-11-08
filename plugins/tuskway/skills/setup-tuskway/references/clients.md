# Client notes

Sign-in lines for when `epic_list` is present and the server rejected the call. These are not install commands. If the tool is missing, the user installs from the plugin README. Do not invent a command for a client that is not in the table.

| Client | Sign in |
|---|---|
| Claude Code | `/mcp`, select `plugin:tuskway:tuskway` |
| Cursor | Cursor's sign-in prompt |
| Grok Bot | Through the Cursor install |
| Codex | `codex mcp login tuskway` |
| Copilot CLI | `/mcp auth tuskway` |
| Grok Build | `/mcps`, select tuskway, press `i` |
| OpenCode | `opencode mcp auth tuskway` |
| Pi | `pi mcp login tuskway` |

The hosted server is `https://tuskway.com/mcp`. This skill does not register an OAuth client and does not store a token.
