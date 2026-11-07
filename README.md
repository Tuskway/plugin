# Tuskway plugin

One plugin folder, `plugins/tuskway`, installed as-is by Claude Code, Cursor, Codex, Copilot CLI, Grok Build, OpenCode, and Pi. Grok Bot uses the Cursor install.

The plugin connects to the hosted MCP server at `https://tuskway.com/mcp`. Each client signs in with OAuth. This repository contains no access tokens, hooks, rule files, or subagents. The root `package.json` is private so it is not published to npm. There is no per-client build output.

## Private testing

This repository is private while it is being checked. Every client clones it from GitHub, so each person needs git access (`gh` login or a credential helper).

- Cursor and Grok Bot install it through a team marketplace, with the Cursor GitHub App on the repository.
- If `codex plugin marketplace add tuskway/plugin` fails while the repository is private, clone it and run `codex plugin marketplace add` on the local folder.

You type the install commands. The plugin does not install itself.

## Later public install

After the repository is made public, the same commands are the public install. People no longer need a private grant to clone it. Cursor's individual import (Customize → Add Marketplace → Import from GitHub, User scope, then Add in the Personal tab) works only once the repository is public.

A public repository is not a directory listing. This package is not submitted to the Claude directory, Cursor Marketplace, Codex plugin directory, or the MCP Registry, and the root package is not published to npm.

## Install

| Agent | Install | Sign in |
| --- | --- | --- |
| Claude Code | `/plugin marketplace add tuskway/plugin`, then `/plugin install tuskway@tuskway` | `/mcp`, select `plugin:tuskway:tuskway` |
| Cursor (team) | Dashboard → Plugins & MCPs → Team Marketplaces → Import from Repo `https://github.com/Tuskway/plugin`. Members install from Customize. | Cursor's sign-in prompt |
| Cursor (individual) | Customize → Add Marketplace → Import from GitHub at User scope, then Add in the Personal tab. Public repository only. | Cursor's sign-in prompt |
| Grok Bot | Use the Cursor install. Complete GitHub auth if Cursor asks to sync plugins. | Through Cursor |
| Codex | `codex plugin marketplace add tuskway/plugin`, then `codex plugin add tuskway@tuskway` | `codex mcp login tuskway` |
| Copilot CLI | `copilot plugin marketplace add tuskway/plugin`, then `copilot plugin install tuskway@tuskway` | `/mcp auth tuskway` |
| Grok Build | `grok plugin install tuskway/plugin --trust` | `/mcps`, select tuskway, press `i` |
| OpenCode | `npx skills add tuskway/plugin --agent opencode` and `opencode mcp add tuskway --url https://tuskway.com/mcp` | `opencode mcp auth tuskway` |
| Pi | `pi install git:github.com/tuskway/plugin` and `pi mcp add tuskway --url https://tuskway.com/mcp` | `pi mcp login tuskway` |

Update with the client's marketplace update command. Pi and OpenCode update by running their install commands again.

## Check the package

```bash
node --test scripts/test-manifests.mjs
```

## License

[MIT](LICENSE)
