import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(root, "plugins/tuskway");
const description =
  "Shared Tuskway plan for coding agents, with hosted MCP sign-in.";
const version = "0.1.0";
const mcpUrl = "https://tuskway.com/mcp";
const pluginSchemaUrl =
  "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const mcpSchemaUrl = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

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

function repoFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(root);
  return files;
}

function assertInside(base, candidate, label) {
  assert.equal(path.isAbsolute(candidate), false, `${label} is absolute`);
  const parts = candidate.replaceAll("\\", "/").split("/");
  assert.equal(parts.includes(".."), false, `${label} contains ..`);
  const resolved = path.resolve(base, candidate);
  assert.equal(existsSync(resolved), true, `${label} is missing`);
  const realBase = realpathSync(base);
  const realTarget = realpathSync(resolved);
  assert.equal(
    realTarget === realBase || realTarget.startsWith(`${realBase}${path.sep}`),
    true,
    `${label} resolves outside ${realBase}`,
  );
}

function assertRelativePaths(value, base, label) {
  if (typeof value === "string") {
    if (value.startsWith("./")) assertInside(base, value, label);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertRelativePaths(item, base, `${label}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertRelativePaths(item, base, `${label}.${key}`);
    }
  }
}

function assertHostedServer(server, label) {
  const url = new URL(server.url);
  assert.equal(url.href, mcpUrl, label);
  assert.equal(url.protocol, "https:", label);
  assert.equal(url.username, "", label);
  assert.equal(url.password, "", label);
  assert.equal(url.hash, "", label);
  for (const key of ["command", "args", "env", "headers", "auth", "extensions"]) {
    assert.equal(Object.hasOwn(server, key), false, `${label} ${key}`);
  }
}

function resolveRef(rootSchema, ref) {
  assert.equal(ref.startsWith("#/"), true, ref);
  let node = rootSchema;
  for (const part of ref.slice(2).split("/")) node = node[part];
  assert.notEqual(node, undefined, ref);
  return node;
}

function schemaErrors(schema, data, pointer = "", rootSchema = schema) {
  if (schema.$ref) {
    return schemaErrors(resolveRef(rootSchema, schema.$ref), data, pointer, rootSchema);
  }
  const errors = [];
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (option) => schemaErrors(option, data, pointer, rootSchema).length === 0,
    );
    if (matches.length !== 1) {
      errors.push(`${pointer} matched ${matches.length} oneOf branches`);
    }
    return errors;
  }
  if (Object.hasOwn(schema, "const") && data !== schema.const) {
    errors.push(`${pointer} const`);
  }
  if (schema.type === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return [`${pointer} type`];
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(data, key)) errors.push(`${pointer}.${key} required`);
    }
    for (const [key, value] of Object.entries(data)) {
      const property = schema.properties?.[key];
      if (property) {
        errors.push(
          ...schemaErrors(property, value, `${pointer}.${key}`, rootSchema),
        );
      } else if (schema.additionalProperties === false) {
        errors.push(`${pointer}.${key} additional`);
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        errors.push(
          ...schemaErrors(
            schema.additionalProperties,
            value,
            `${pointer}.${key}`,
            rootSchema,
          ),
        );
      }
      const banned = schema.propertyNames?.not?.enum;
      if (banned?.includes(key)) errors.push(`${pointer} property ${key}`);
    }
    return errors;
  }
  if (schema.type === "string") {
    if (typeof data !== "string") return [`${pointer} type`];
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${pointer} minLength`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`${pointer} maxLength`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${pointer} pattern`);
    }
    return errors;
  }
  if (schema.type === "array") {
    if (!Array.isArray(data)) return [`${pointer} type`];
    if (schema.items) {
      data.forEach((item, index) => {
        errors.push(
          ...schemaErrors(schema.items, item, `${pointer}[${index}]`, rootSchema),
        );
      });
    }
  }
  return errors;
}

async function fetchSchema(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.ok, true, `${url} ${response.status}`);
  const schema = await response.json();
  assert.equal(schema.$id, url);
  return schema;
}

test("marketplace sources resolve inside plugins/tuskway", () => {
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
    assertInside(root, entry.source, marketplacePath);
    assert.equal(
      readJson(path.posix.join(entry.source, "plugin.json")).name,
      entry.name,
    );
    assertRelativePaths(marketplace, root, marketplacePath);
  }

  const codex = readJson(".agents/plugins/marketplace.json");
  assert.equal(codex.name, "tuskway");
  assert.equal(codex.plugins.length, 1);
  const entry = codex.plugins[0];
  assert.equal(entry.name, "tuskway");
  assert.equal(entry.source.path.startsWith("./"), true);
  assert.deepEqual(entry.source, {
    source: "local",
    path: "./plugins/tuskway",
  });
  assert.deepEqual(entry.policy, {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  });
  assertInside(root, entry.source.path, "codex marketplace");
  assert.equal(
    readJson(path.posix.join(entry.source.path, "plugin.json")).name,
    entry.name,
  );
  assertRelativePaths(codex, root, ".agents/plugins/marketplace.json");
});

test("names, descriptions, and versions agree", () => {
  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath);
    assert.equal(manifest.name, "tuskway", manifestPath);
    assert.equal(manifest.description, description, manifestPath);
    assert.equal(manifest.version, version, manifestPath);
    const base = manifestPath.startsWith("plugins/tuskway/")
      ? pluginRoot
      : root;
    assertRelativePaths(manifest, base, manifestPath);
  }

  const portable = readJson("plugins/tuskway/plugin.json");
  const codex = readJson("plugins/tuskway/.codex-plugin/plugin.json");
  assert.deepEqual(
    portable.extensions["com.openai"].interface,
    codex.interface,
  );
  assert.equal(
    portable.extensions["com.openai"].interface.shortDescription,
    description,
  );
  assert.equal(
    portable.extensions["com.openai"].onboardingSkill,
    "./skills/setup-tuskway/SKILL.md",
  );
  assert.equal(codex.onboardingSkill, "./skills/setup-tuskway/SKILL.md");
});

test("authored skills keep portable frontmatter and local links", () => {
  const skillsDir = path.join(pluginRoot, "skills");
  const expected = [
    "comments-tuskway",
    "draft-tickets-tuskway",
    "plan-tuskway",
    "setup-tuskway",
    "start-epic-tuskway",
    "sync-design-tuskway",
    "tackle-ticket-tuskway",
    "tracker-changes-tuskway",
    "write-design-tuskway",
  ];
  const found = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(found, expected);
  assert.equal(
    readFileSync(path.join(skillsDir, ".gitkeep"), "utf8"),
    "",
  );

  for (const name of found) {
    const skillDir = path.join(skillsDir, name);
    const skillPath = path.join(skillDir, "SKILL.md");
    const text = readFileSync(skillPath, "utf8");
    assert.equal(text.includes("\r"), false, name);
    assert.equal(Buffer.byteLength(text) < 8000, true, `${name} is ${Buffer.byteLength(text)} bytes`);
    assert.equal(text.includes("${"), false, name);
    assert.equal(/generated-from|body-sha256/i.test(text), false, name);
    const frontmatter = parseSkillFrontmatter(text, name);
    assert.equal(frontmatter.name, name);
    assert.equal(name.endsWith("-tuskway"), true);
    assert.equal(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name), true, name);
    assert.equal(frontmatter.description.length > 0, true, name);
    assert.equal(frontmatter.description.length <= 1024, true, name);
    assert.match(frontmatter.description, /Use when/);
    assert.match(frontmatter.description, /not for/i);
    for (const link of markdownLinks(text)) {
      if (/^[a-z]+:/.test(link)) continue;
      assertInside(skillDir, link.split("#")[0], `${name} ${link}`);
    }
  }
});

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

function parseSkillFrontmatter(text, name) {
  assert.equal(text.startsWith("---\n"), true, name);
  const end = text.indexOf("\n---\n", 4);
  assert.equal(end > 4, true, name);
  const data = {};
  const lines = text.slice(4, end).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith(" ")) continue;
    const match = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(line);
    assert.notEqual(match, null, `${name} ${line}`);
    if (match[2] === "") {
      const nested = {};
      while (lines[i + 1]?.startsWith("  ")) {
        i += 1;
        const child = /^  ([A-Za-z0-9-]+):\s*(.*)$/.exec(lines[i]);
        assert.notEqual(child, null, `${name} ${lines[i]}`);
        nested[child[1]] = unquote(child[2]);
      }
      data[match[1]] = nested;
    } else {
      data[match[1]] = unquote(match[2]);
    }
  }
  assert.equal(typeof data.description, "string", name);
  return data;
}

function markdownLinks(text) {
  return [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
}

test("MCP configs point at the hosted server and carry no secrets", () => {
  const claude = readJson("plugins/tuskway/.mcp.json");
  assert.deepEqual(Object.keys(claude), ["mcpServers"]);
  assert.equal(claude.mcpServers.tuskway.type, "http");
  assertHostedServer(claude.mcpServers.tuskway, ".mcp.json");

  const portable = readJson("plugins/tuskway/mcp.json");
  assert.equal(portable.$schema, mcpSchemaUrl);
  assert.equal(portable.mcpServers.tuskway.type, "streamable-http");
  assertHostedServer(portable.mcpServers.tuskway, "mcp.json");

  const cursor = readJson("plugins/tuskway/.cursor-plugin/plugin.json");
  assert.equal(cursor.mcpServers, "./.mcp.json");
  const codex = readJson("plugins/tuskway/.codex-plugin/plugin.json");
  assert.equal(codex.mcpServers, "./.mcp.json");
  const claudeManifest = readJson("plugins/tuskway/.claude-plugin/plugin.json");
  assert.equal(claudeManifest.mcpServers, "./.mcp.json");

  const grok = readJson(".grok-plugin/plugin.json");
  assert.equal(grok.mcpServers, "./plugins/tuskway/.mcp.json");
  assert.equal(grok.skills, "./plugins/tuskway/skills");
  assertInside(root, grok.mcpServers, "grok mcp");
  assertInside(root, grok.skills, "grok skills");
  assert.equal("agents" in grok, false);
  assert.equal("hooks" in grok, false);

  const secret =
    /bearer\s|api[_-]?key|client[_-]?secret|authorization\s*:|sk-[A-Za-z0-9]|ghp_|github_pat_/i;
  for (const file of repoFiles()) {
    if (!file.endsWith(".json")) continue;
    assert.equal(secret.test(readFileSync(file, "utf8")), false, file);
  }
});

test("Pi package stays private and still installs its skills from git", async () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.pi.skills, ["./plugins/tuskway/skills"]);
  assert.equal("publishConfig" in pkg, false);
  assert.equal("scripts" in pkg, false);
  assert.equal(
    readFileSync(path.join(root, "plugins/tuskway/skills/.gitkeep"), "utf8"),
    "",
  );

  const source = mkdtempSync(path.join(tmpdir(), "tuskway-pi-src-"));
  const directory = mkdtempSync(path.join(tmpdir(), "tuskway-pi-"));
  try {
    cpSync(root, source, {
      recursive: true,
      filter: (candidate) => {
        const base = path.basename(candidate);
        return base !== ".git" && base !== "node_modules";
      },
    });
    execFileSync("git", ["init", "-q"], { cwd: source });
    execFileSync("git", ["add", "."], { cwd: source });
    execFileSync(
      "git",
      [
        "-c",
        "user.email=pi-test@example.com",
        "-c",
        "user.name=Pi test",
        "commit",
        "-q",
        "-m",
        "package under test",
      ],
      { cwd: source },
    );
    execFileSync("git", ["clone", "--local", "--quiet", source, directory], {
      stdio: "pipe",
    });
    execFileSync(
      "npm",
      ["install", "--omit=dev", "--legacy-peer-deps", "--no-audit", "--no-fund"],
      { cwd: directory, stdio: "pipe" },
    );
    const installed = JSON.parse(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    assert.equal(installed.private, true);
    assert.equal(
      existsSync(path.join(directory, "plugins/tuskway/skills/.gitkeep")),
      true,
    );
    assert.equal(
      readFileSync(path.join(directory, "plugins/tuskway/mcp.json"), "utf8").includes(
        '"type": "streamable-http"',
      ),
      true,
    );
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(directory, { recursive: true, force: true });
  }

  const npmCli = realpathSync(
    execFileSync("which", ["npm"], { encoding: "utf8" }).trim(),
  );
  const libpub = path.resolve(
    path.dirname(npmCli),
    "../node_modules/libnpmpublish",
  );
  const { publish } = createRequire(import.meta.url)(libpub);
  await assert.rejects(
    publish(pkg, Buffer.alloc(0), { registry: "http://127.0.0.1:9/" }),
    { code: "EPRIVATE" },
  );
});

test("package excludes hooks, rules, subagents, and per-tool dist", () => {
  const icon = readFileSync(path.join(pluginRoot, "assets/icon.png"));
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(icon.includes(Buffer.from("IEND")), true);
  assert.equal(icon.subarray(icon.lastIndexOf(Buffer.from("IEND")) + 8).length, 0);
  const svg = readFileSync(path.join(pluginRoot, "assets/logo.svg"), "utf8");
  assert.equal(/<script|javascript:|href\s*=\s*["']https?:/i.test(svg), false);
  assert.equal(readFileSync(path.join(root, "LICENSE"), "utf8").includes("MIT License"), true);
  assert.equal(
    readFileSync(path.join(pluginRoot, "LICENSE"), "utf8"),
    readFileSync(path.join(root, "LICENSE"), "utf8"),
  );

  for (const file of repoFiles()) {
    const relative = path.relative(root, file);
    const parts = relative.split(path.sep);
    for (const banned of ["rules", "agents", "hooks", "dist"]) {
      assert.equal(parts.includes(banned), false, relative);
    }
    assert.equal(path.basename(file) === "server.json", false, relative);
    assert.equal(path.basename(file) === "gemini-extension.json", false, relative);
    assert.equal(file.endsWith(`${path.sep}hooks.json`), false, relative);
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
  assert.match(readme, /streamable-http/);
  assert.match(readme, /rejects any other field/);
  assert.match(readme, /onboardingSkill/);
  assert.match(readme, /were not run in those clients/);
  assert.match(readme, /EPRIVATE/);
  assert.match(readme, /Pi 1\.5\.0/);
  assert.match(readme, /returned 401/);
  assert.match(readme, /registration_endpoint/);
});

test("portable manifests match Agent Plugins 1.0.0", async () => {
  const [pluginSchema, mcpSchema] = await Promise.all([
    fetchSchema(pluginSchemaUrl),
    fetchSchema(mcpSchemaUrl),
  ]);
  const plugin = readJson("plugins/tuskway/plugin.json");
  const mcp = readJson("plugins/tuskway/mcp.json");
  assert.deepEqual(schemaErrors(pluginSchema, plugin), []);
  assert.deepEqual(schemaErrors(mcpSchema, mcp), []);

  const withAuth = structuredClone(mcp);
  withAuth.mcpServers.tuskway.auth = {
    type: "oauth",
    client: { mode: "dcr" },
  };
  assert.equal(schemaErrors(mcpSchema, withAuth).length > 0, true);

  const withExtensions = structuredClone(mcp);
  withExtensions.mcpServers.tuskway.extensions = {
    "com.openai": { auth: { type: "oauth", client: { mode: "dcr" } } },
  };
  assert.equal(schemaErrors(mcpSchema, withExtensions).length > 0, true);
});
