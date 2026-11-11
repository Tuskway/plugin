# Tuskway plugin

One plugin folder, `plugins/tuskway`, for Claude Code, Cursor, Codex, Copilot CLI, Grok Build, OpenCode, and Pi. Grok Bot uses the Cursor install.

The plugin connects to the hosted MCP server at `https://tuskway.com/mcp`. Sign-in is OAuth in the client. The package contains no access tokens, hooks, rule files, or subagents.

Nine workflow skills are in `plugins/tuskway/skills/`.

## Install

Install from this repository. It is not listed in the Claude, Cursor, or Codex plugin directories, or the MCP Registry.

| Agent | Install | Sign in |
| --- | --- | --- |
| Claude Code | `/plugin marketplace add tuskway/plugin`, then `/plugin install tuskway@tuskway` | `/mcp`, select `plugin:tuskway:tuskway` |
| Cursor (team) | Dashboard → Plugins & MCPs → Team Marketplaces → Import from Repo `https://github.com/Tuskway/plugin`. Members install from Customize. | Cursor's sign-in prompt |
| Cursor (individual) | Customize → Add Marketplace → Import from GitHub at User scope, then Add in the Personal tab. | Cursor's sign-in prompt |
| Grok Bot | Use the Cursor install. Complete GitHub auth if Cursor asks to sync plugins. | Through Cursor |
| Codex | `codex plugin marketplace add tuskway/plugin`, then `codex plugin add tuskway@tuskway` | `codex mcp login tuskway` |
| Copilot CLI | `copilot plugin marketplace add tuskway/plugin`, then `copilot plugin install tuskway@tuskway` | `/mcp auth tuskway` |
| Grok Build | `grok plugin install tuskway/plugin` | `/mcps`, select tuskway, press `i` |
| OpenCode | `npx skills add tuskway/plugin --agent opencode` and `opencode mcp add tuskway --url https://tuskway.com/mcp` | `opencode mcp auth tuskway` |
| Pi | `pi install git:github.com/tuskway/plugin` and `pi mcp add tuskway --url https://tuskway.com/mcp` | `pi mcp login tuskway` |
| Gemini CLI | `gemini extensions install https://github.com/Tuskway/plugin` | Gemini's sign-in prompt |

Update with the client's marketplace update command. Pi and OpenCode update by running their install commands again.

## MCP

Two files name the server `tuskway` at `https://tuskway.com/mcp`.

`plugins/tuskway/mcp.json` is the Agent Plugins document. The server is `streamable-http` with `type` and `url` only. That schema rejects any other field, including `auth` and `extensions`. Codex drops a server entry that includes `extensions`, so this file does not declare OAuth. Sign in with the client's MCP login.

`.mcp.json` is `{ "type": "http", "url": "https://tuskway.com/mcp" }`. Claude Code treats a `url` without `type` as stdio. Cursor reads `.mcp.json` before `mcp.json`. `.cursor-plugin/plugin.json` pins `mcpServers` to `./.mcp.json`.

Codex requires `onboardingSkill` to be a `./` path to a packaged `SKILL.md`. Both Codex manifests set it to `./skills/setup-tuskway/SKILL.md`.

The root `package.json` is `"private": true`, so `npm publish` does not upload this package. Pi installs the git repository and loads `plugins/tuskway/skills`.

`server.json` names the same server for the MCP Registry: `com.tuskway/tuskway` over streamable HTTP. `gemini-extension.json` and `GEMINI.md` are the Gemini CLI extension at the repository root. The Gemini CLI gallery also needs the GitHub topic `gemini-cli-extension` on this repository.

## Check the package

```bash
node --test scripts/test-plugin.mjs
node scripts/sync.mjs --check
node scripts/validate.mjs
node scripts/package-limits.mjs
npm run build:openai-zip
node --test scripts/test-manifests.mjs scripts/test-build-claude.mjs evals/mock-tuskway.test.mjs evals/grade.test.mjs
```

`sync.mjs --check` compares manifest versions and does not rewrite them or create a tag. `validate.mjs` checks skill frontmatter, the local size budget, and resource links. `package-limits.mjs` fails on a symlink, a submodule, more than 512 files, or a non-image file over 256 KiB under `plugins/tuskway`. All nine skills are required, including `sync-design-tuskway`. `evals/` runs those skills against a mock server, not `https://tuskway.com`.

`npm run build:openai-zip` writes `dist/tuskway-openai-<version>.zip`. The archive root holds `plugin.json`, `mcp.json`, `skills/`, and `assets/`. `npm run build:openai-zip -- --folder <name>` places that same root in one top-level directory and adds no sibling entries. The build checks the Agent Plugins 1.0.0 schemas, checks that each skill frontmatter `name` matches its folder, and fails if a file matches a credential pattern. The package does not include test credentials, reviewer instructions, `apps`, or `.app.json`.

## Release

Raise `version` in every manifest when skills or listing data change. `node scripts/sync.mjs --check` fails when any manifest version differs.

Tag the merged commit and push the tag. Use the version from the manifests:

```bash
git checkout main
git pull origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag workflow publishes a GitHub release and attaches `dist/tuskway-openai-X.Y.Z.zip`. If that job cannot attach the ZIP, upload the same file to the release. Do not put access tokens in the ZIP, this README, or CI logs.

Before an OpenAI or Claude submission, run `claude plugin validate ./plugins/tuskway` when the Claude CLI is installed. The package workflow runs that command when `claude` is on the runner.

## Claude directory

The Claude plugin directory accepts only Markdown, text, JSON, YAML, and PNG, JPEG, GIF, WebP, or ICO images. This repository keeps `assets/logo.svg` and `skills/sync-design-tuskway/scripts/drift.mjs` for the other platforms.

To publish the Claude distribution:

```bash
npm run build:claude
```

That writes a stripped copy to `dist/claude`. Push that tree to [Tuskway/plugin-claude](https://github.com/Tuskway/plugin-claude) and tag the same version as the manifests.

## License

[MIT](LICENSE)
