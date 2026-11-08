# Tuskway plugin

One plugin folder, `plugins/tuskway`, installed as-is by Claude Code, Cursor, Codex, Copilot CLI, Grok Build, OpenCode, and Pi. Grok Bot uses the Cursor install.

The plugin connects to the hosted MCP server at `https://tuskway.com/mcp`. Sign-in is OAuth in the client. The package contains no access tokens, hooks, rule files, or subagents. The root `package.json` is private so it is not published to npm. There is no per-client build output.

Nine workflow skills are authored under `plugins/tuskway/skills/`, including `sync-design-tuskway`. Codex onboarding points at `./skills/setup-tuskway/SKILL.md`.

## Private testing

This repository is public. Anonymous git ls-remote of `https://github.com/Tuskway/plugin.git` succeeds. Before it was public, every client needed git access (`gh` login or a credential helper).

- Cursor and Grok Bot install it through a team marketplace, with the Cursor GitHub App on the repository.
- If `codex plugin marketplace add tuskway/plugin` fails, clone it and run `codex plugin marketplace add` on the local folder.

You type the install commands. The plugin does not install itself.

## Later public install

The repository is public. The same commands are the public install. People no longer need a private grant to clone it. Cursor's individual import (Customize → Add Marketplace → Import from GitHub, User scope, then Add in the Personal tab) works only once the repository is public.

A public repository is not a directory listing. This package is not submitted to the Claude directory, Cursor Marketplace, Codex plugin directory, or the MCP Registry, and the root package is not published to npm.

## Manifest notes

`plugins/tuskway/mcp.json` is the Agent Plugins 1.0.0 document. Its server is `streamable-http` with `type` and `url` only. That schema rejects any other field on the server, including `auth` and `extensions`. The file has no `headers`. OpenAI's packaging guide also describes `extensions["com.openai"].auth` for OAuth. A public Codex report, [openai/codex#53658](https://github.com/openai/codex/issues/53658), says the current parser drops a server that includes `extensions` (`unknown field extensions`, expected `url` or `headers`). This package leaves the field out so the server entry stays valid. Client OAuth against `https://tuskway.com/mcp` is the sign-in path. On 7 Nov 2026 a POST `initialize` to that URL with no token returned 401, and `WWW-Authenticate` pointed at `https://tuskway.com/.well-known/oauth-protected-resource/mcp`. That document names authorization server `https://tuskway.com/api/auth`. The server metadata includes `registration_endpoint` and `client_id_metadata_document_supported`. No OAuth client was registered, and no coding-agent client signed in. A GET of the MCP URL returned 405. That probe did not sign in Claude Code, Cursor, Codex, Copilot CLI, Grok Build, or OpenCode.

`.mcp.json` is the Claude form `{ "type": "http", "url": "https://tuskway.com/mcp" }`. Claude Code accepts `streamable-http` as an alias of `http` and treats a `url` without `type` as stdio. Cursor's loader reads `.mcp.json` before `mcp.json` when both exist ([cursor/plugins#252](https://github.com/cursor/plugins/issues/252)). `.cursor-plugin/plugin.json` pins `mcpServers` to `./.mcp.json`. Both files name the server `tuskway` and use the same URL.

Current Codex requires `onboardingSkill` to be a `./` path to a packaged `SKILL.md`. `plugins/tuskway/plugin.json` sets `extensions["com.openai"].onboardingSkill` to `./skills/setup-tuskway/SKILL.md`, and `.codex-plugin/plugin.json` sets the same path. Codex 0.167.0 added this local checkout as a marketplace and installed the plugin. It did not sign in, and it did not start the onboarding skill.

Pi installs this repository from git. `"private": true` does not block that clone. Pi 1.5.0 installed this package from a local git HTTP remote and left `private` set. `pi install git:github.com/tuskway/plugin` was not run against github.com. `libnpmpublish` rejects a private manifest with `EPRIVATE` before it sends the package to the registry. On npm 10.9.9, `npm publish --dry-run` still packs a private manifest and does not upload it. The npm CLI calls the publisher only after its local credential check.

The install lines below are the agreed client commands. They were compared with current client docs and were not run in those clients. Local-checkout results, including the commands that did run, are in `evals/client-checks.json`.

## Install

| Agent | Install | Sign in |
| --- | --- | --- |
| Claude Code | `/plugin marketplace add tuskway/plugin`, then `/plugin install tuskway@tuskway` | `/mcp`, select `plugin:tuskway:tuskway` |
| Cursor (team) | Dashboard → Plugins & MCPs → Team Marketplaces → Import from Repo `https://github.com/Tuskway/plugin`. Members install from Customize. | Cursor's sign-in prompt |
| Cursor (individual) | Customize → Add Marketplace → Import from GitHub at User scope, then Add in the Personal tab. Public repository only. | Cursor's sign-in prompt |
| Grok Bot | Use the Cursor install. Complete GitHub auth if Cursor asks to sync plugins. | Through Cursor |
| Codex | `codex plugin marketplace add tuskway/plugin`, then `codex plugin add tuskway@tuskway` | `codex mcp login tuskway` |
| Copilot CLI | `copilot plugin marketplace add tuskway/plugin`, then `copilot plugin install tuskway@tuskway` | `/mcp auth tuskway` |
| Grok Build | `grok plugin install tuskway/plugin` | `/mcps`, select tuskway, press `i` |
| OpenCode | `npx skills add tuskway/plugin --agent opencode` and `opencode mcp add tuskway --url https://tuskway.com/mcp` | `opencode mcp auth tuskway` |
| Pi | `pi install git:github.com/tuskway/plugin` and `pi mcp add tuskway --url https://tuskway.com/mcp` | `pi mcp login tuskway` |

Update with the client's marketplace update command. Pi and OpenCode update by running their install commands again. The GitHub shorthand commands in the table were not run. `evals/client-checks.json` records the local CLI versions. Cursor CLI login completed. The public repository was installed for that user. The details screen counted nine skills and named six before an ellipsis. Six fresh ask-mode sessions then opened installed skill files. Three expected prompts opened the expected skill. The tackle and weekend prompts opened a Tuskway skill they should not have, so that check fails. Tuskway MCP sign-in is still waiting. Those results stay separate.

## Check the package

```bash
node --test scripts/test-plugin.mjs
node scripts/sync.mjs --check
node scripts/validate.mjs
node --test scripts/test-manifests.mjs evals/mock-tuskway.test.mjs evals/grade.test.mjs
```

`sync.mjs --check` compares manifest versions and does not rewrite them or create a tag. `validate.mjs` checks skill frontmatter, the local size budget, and resource links. `clients.install` is the plugin install from `evals/client-checks.json`, not the CLI installer. A listed skill name is discovery. Cursor applies an installed skill by presenting it and letting the agent read `SKILL.md`; that read does not have to be the first tool call. The six Cursor sessions are graded in `evals/routing.json` and currently fail. Cursor CLI login is not Tuskway MCP sign-in. A model workflow stays untested. A manifest URL is not an MCP tool pass. `pathProbe` is a separate field and is `NOT RUN` for every cell: a binary on PATH is not a result. `recorded` keeps the command-level evidence. `liveAcceptance` and `versionBump` stay `NOT RUN`. A structural pass is not live acceptance. The local Grok check set the installer's trust switch so it would not prompt. That switch is not part of the default command. All nine skills are required, including `sync-design-tuskway`. A tree that omits that directory fails. The schema test downloads the Agent Plugins 1.0.0 schemas. `evals/` is a mock, not `https://tuskway.com`. Saved model transcripts are not in this tree. See `evals/RESULTS.md`.

## License

[MIT](LICENSE)
