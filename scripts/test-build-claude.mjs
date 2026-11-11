import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildClaude,
  claudeSafetyErrors,
  repoRoot,
  rewriteSyncDesignSkill,
} from "./build-claude.mjs";

const pluginJson = path.join("plugins/tuskway/.claude-plugin/plugin.json");
const marketplace = path.join(".claude-plugin/marketplace.json");
const skillPath = path.join("plugins/tuskway/skills/sync-design-tuskway/SKILL.md");

function tempDest() {
  return mkdtempSync(path.join(tmpdir(), "tuskway-claude-"));
}

test("the Claude distribution keeps allowed types and drops scripts and SVG", () => {
  const dest = tempDest();
  try {
    const result = buildClaude({ root: repoRoot, dest });
    assert.deepEqual(result.errors, []);
    assert.equal(result.version, "0.1.4");
    assert.deepEqual(claudeSafetyErrors(dest), []);

    const files = new Set(result.files);
    assert.equal(files.has("assets/logo.svg"), false);
    assert.equal(files.has("plugins/tuskway/assets/logo.svg"), false);
    assert.equal(
      result.files.some((file) => file.endsWith("drift.mjs") || file.includes("/scripts/")),
      false,
    );
    assert.equal(files.has("plugins/tuskway/skills/.gitkeep"), false);
    assert.equal(files.has("plugins/tuskway/plugin.json"), false);
    assert.equal(files.has("plugins/tuskway/.cursor-plugin/plugin.json"), false);
    assert.equal(files.has("plugins/tuskway/.codex-plugin/plugin.json"), false);
    assert.equal(files.has("package.json"), false);

    assert.equal(files.has("plugins/tuskway/.claude-plugin/plugin.json"), true);
    assert.equal(files.has("plugins/tuskway/.mcp.json"), true);
    assert.equal(files.has("plugins/tuskway/assets/icon.png"), true);
    assert.equal(files.has("plugins/tuskway/LICENSE"), true);
    assert.equal(files.has("plugins/tuskway/README.md"), true);
    assert.equal(files.has("LICENSE"), true);
    assert.equal(files.has("README.md"), true);
    assert.equal(files.has(marketplace), true);

    const plugin = JSON.parse(readFileSync(path.join(dest, pluginJson), "utf8"));
    assert.equal(plugin.name, "tuskway");
    assert.equal(plugin.version, "0.1.4");
    assert.equal(plugin.mcpServers, "./.mcp.json");
    assert.equal(plugin.repository, "https://github.com/Tuskway/plugin-claude");
    assert.equal(existsSync(path.join(dest, "plugins/tuskway", plugin.mcpServers)), true);
    assert.equal(plugin.documentationUrl, "https://tuskway.com/docs/claude");
    assert.equal(plugin.supportUrl, "https://tuskway.com/support");
    assert.equal(plugin.termsOfServiceUrl, "https://tuskway.com/terms");
    assert.equal(plugin.privacyPolicyUrl, "https://tuskway.com/privacy");
    assert.equal(plugin.icon, "./assets/icon.png");
    assert.equal(existsSync(path.join(dest, "plugins/tuskway", plugin.icon)), true);
    assert.match(plugin.description, /^Tuskway is a shared epic notebook/);

    const mcp = JSON.parse(readFileSync(path.join(dest, "plugins/tuskway/.mcp.json"), "utf8"));
    assert.equal(mcp.mcpServers.tuskway.url, "https://tuskway.com/mcp");

    const market = JSON.parse(readFileSync(path.join(dest, marketplace), "utf8"));
    assert.equal(market.plugins[0].name, "tuskway");
    assert.equal(market.plugins[0].source, "./plugins/tuskway");
    assert.equal(market.plugins[0].version, plugin.version);

    const skill = readFileSync(path.join(dest, skillPath), "utf8");
    assert.equal(skill.includes("scripts/drift.mjs"), false);
    assert.equal(skill.includes("drift.mjs"), false);
    assert.match(skill, /by hand, following the steps in this skill/);

    for (const file of result.files) {
      if (file.endsWith("SKILL.md")) {
        const body = readFileSync(path.join(dest, file), "utf8");
        assert.equal(body.includes("scripts/drift.mjs"), false, file);
      }
    }
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});

test("claudeSafetyErrors rejects disallowed types, shebangs, and NUL bytes", () => {
  const dir = tempDest();
  try {
    writeFileSync(path.join(dir, "ok.md"), "# ok\n");
    writeFileSync(path.join(dir, "script.mjs"), "export const x = 1;\n");
    assert.equal(
      claudeSafetyErrors(dir).some((error) => error.includes("script.mjs is not an allowed file type")),
      true,
    );

    rmSync(path.join(dir, "script.mjs"));
    writeFileSync(path.join(dir, "hook.md"), "#!/usr/bin/env node\n");
    assert.equal(
      claudeSafetyErrors(dir).some((error) => error.includes("hook.md begins with a shebang")),
      true,
    );

    rmSync(path.join(dir, "hook.md"));
    writeFileSync(path.join(dir, "bad.md"), Buffer.from("ok\0nope"));
    assert.equal(
      claudeSafetyErrors(dir).some((error) => error.includes("bad.md contains a NUL byte")),
      true,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rewriteSyncDesignSkill fails when the drift paragraph is missing", () => {
  const result = rewriteSyncDesignSkill("# Sync the design after a merge\n");
  assert.equal(result.error.includes("does not contain the expected drift.mjs paragraph"), true);
});
