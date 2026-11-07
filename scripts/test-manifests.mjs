import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const description =
  "Shared Tuskway plan for coding agents, with hosted MCP sign-in.";
const version = "0.1.0";
const mcpUrl = "https://tuskway.com/mcp";

const manifestPaths = [
  "plugins/tuskway/plugin.json",
  "plugins/tuskway/.claude-plugin/plugin.json",
  "plugins/tuskway/.cursor-plugin/plugin.json",
  "plugins/tuskway/.codex-plugin/plugin.json",
  ".grok-plugin/plugin.json",
  "package.json",
];

function readJson(relativePath) {
  const text = readFileSync(path.join(root, relativePath), "utf8");
  assert.equal(text.includes("\r"), false, `${relativePath} must use LF`);
  return JSON.parse(text);
}

test("marketplace sources resolve to plugins/tuskway", () => {
  for (const marketplacePath of [
    ".claude-plugin/marketplace.json",
    ".cursor-plugin/marketplace.json",
  ]) {
    const marketplace = readJson(marketplacePath);
    assert.equal(marketplace.name, "tuskway");
    assert.equal(marketplace.owner.name, "Tuskway");
    assert.equal(marketplace.plugins.length, 1);
    const entry = marketplace.plugins[0];
    assert.equal(entry.name, "tuskway");
    assert.equal(entry.description, description);
    assert.equal(entry.version, version);
    assert.equal(entry.source, "./plugins/tuskway");
    assert.equal(
      readFileSync(path.join(root, entry.source, "plugin.json"), "utf8").length >
        0,
      true,
    );
  }

  const codex = readJson(".agents/plugins/marketplace.json");
  assert.equal(codex.name, "tuskway");
  assert.equal(codex.plugins.length, 1);
  const entry = codex.plugins[0];
  assert.equal(entry.name, "tuskway");
  assert.deepEqual(entry.source, {
    source: "local",
    path: "./plugins/tuskway",
  });
  assert.deepEqual(entry.policy, {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  });
  assert.equal(
    readFileSync(path.join(root, entry.source.path, "plugin.json"), "utf8")
      .length > 0,
    true,
  );
});

test("names, descriptions, and versions agree", () => {
  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath);
    assert.equal(manifest.name, "tuskway", manifestPath);
    assert.equal(manifest.description, description, manifestPath);
    assert.equal(manifest.version, version, manifestPath);
  }

  const portable = readJson("plugins/tuskway/plugin.json");
  const codex = readJson("plugins/tuskway/.codex-plugin/plugin.json");
  assert.equal(
    portable.extensions["com.openai"].interface.shortDescription,
    description,
  );
  assert.equal(codex.interface.shortDescription, description);
  assert.equal(portable.extensions["com.openai"].onboardingSkill, "setup-tuskway");
  assert.equal(codex.onboardingSkill, "setup-tuskway");
});

test("MCP configs point at the hosted server and carry no secrets", () => {
  const claude = readJson("plugins/tuskway/.mcp.json");
  assert.deepEqual(claude, {
    mcpServers: {
      tuskway: { type: "http", url: mcpUrl },
    },
  });

  const portable = readJson("plugins/tuskway/mcp.json");
  assert.equal(
    portable.$schema,
    "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  );
  assert.deepEqual(portable.mcpServers, {
    tuskway: { type: "streamable-http", url: mcpUrl },
  });

  const grok = readJson(".grok-plugin/plugin.json");
  assert.equal(grok.mcpServers, "./plugins/tuskway/.mcp.json");
  assert.equal(grok.skills, "./plugins/tuskway/skills");
  assert.equal(readFileSync(path.join(root, grok.mcpServers), "utf8").includes(mcpUrl), true);
  assert.equal("agents" in grok, false);
  assert.equal("hooks" in grok, false);

  const forbidden = /bearer|token|api[_-]?key|client[_-]?secret|authorization/i;
  for (const relativePath of [
    "plugins/tuskway/.mcp.json",
    "plugins/tuskway/mcp.json",
    "plugins/tuskway/plugin.json",
    ".grok-plugin/plugin.json",
  ]) {
    assert.equal(forbidden.test(readFileSync(path.join(root, relativePath), "utf8")), false, relativePath);
  }
});

test("Pi package stays private and still installs its skills from git", async () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.pi.skills, ["./plugins/tuskway/skills"]);
  assert.equal("publishConfig" in pkg, false);
  assert.equal(
    readFileSync(path.join(root, "plugins/tuskway/skills/.gitkeep"), "utf8"),
    "",
  );

  const directory = mkdtempSync(path.join(tmpdir(), "tuskway-pi-"));
  try {
    writeFileSync(
      path.join(directory, "package.json"),
      readFileSync(path.join(root, "package.json")),
    );
    execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts"], {
      cwd: directory,
      stdio: "pipe",
    });

    // npm's dry-run never calls the publisher. The real publish path rejects
    // private manifests before any registry request.
    const npmCli = realpathSync(execFileSync("which", ["npm"], { encoding: "utf8" }).trim());
    const libpub = path.resolve(path.dirname(npmCli), "../node_modules/libnpmpublish");
    const { publish } = createRequire(import.meta.url)(libpub);
    await assert.rejects(publish(pkg, Buffer.alloc(0), {}), { code: "EPRIVATE" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("package excludes hooks, rules, subagents, and per-tool dist", () => {
  for (const relativePath of [
    "plugins/tuskway/assets/icon.png",
    "plugins/tuskway/assets/logo.svg",
    "LICENSE",
    "plugins/tuskway/LICENSE",
  ]) {
    assert.equal(readFileSync(path.join(root, relativePath)).length > 0, true, relativePath);
  }
  const absent = [
    "rules",
    "agents",
    "plugins/tuskway/agents",
    "plugins/tuskway/hooks",
    "plugins/tuskway/hooks.json",
    "server.json",
    "gemini-extension.json",
    "dist",
    "plugins/tuskway/dist",
  ];
  for (const relativePath of absent) {
    assert.throws(() => readFileSync(path.join(root, relativePath)), relativePath);
  }
  assert.equal(
    readFileSync(path.join(root, ".gitattributes"), "utf8").includes("eol=lf"),
    true,
  );
});

test("README distinguishes private testing from the later public install", () => {
  const readme = readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /^## Private testing$/m);
  assert.match(readme, /^## Later public install$/m);
  assert.match(readme, /git access/);
  assert.match(readme, /not a directory listing/);
  assert.match(readme, /not published to npm/);
  assert.match(readme, /https:\/\/tuskway\.com\/mcp/);
});
