import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { packageContentErrors, requiredSkills, skillNames, versionReport } from "./package-contract.mjs";
import { fetchSchema, schemaErrors } from "./agent-schema.mjs";
import { buildOpenAiZip, defaultZipPath, folderError } from "./build-openai-zip.mjs";
import { treeErrors, submoduleErrors, MAX_FILES, MAX_NON_IMAGE_BYTES } from "./package-limits.mjs";
import { openaiExtensionErrors, reviewErrors } from "./openai-review.mjs";
import { releaseTagError } from "./attach-release.mjs";
import { zipLayoutErrors } from "./zip-layout.mjs";

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
  "gemini-extension.json",
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
      if (dir === root && entry.name === "dist") continue;
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
    if (marketplacePath === ".claude-plugin/marketplace.json") {
      assert.equal(marketplace.description, description);
    }
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
    "Shared plans for coding agents",
  );
  assert.equal(portable.extensions["com.openai"].interface.shortDescription.length <= 30, true);
  assert.deepEqual(openaiExtensionErrors(portable.extensions["com.openai"]), []);
  assert.equal(portable.extensions["com.openai"].review.test_cases, undefined);
  assert.equal(portable.extensions["com.openai"].review.demo_recording_url, undefined);
  assert.equal(typeof portable.extensions["com.openai"].publication.release_notes, "string");
  assert.equal(portable.extensions["com.openai"].review.release_notes, undefined);
  assert.equal(
    portable.extensions["com.openai"].onboardingSkill,
    "./skills/setup-tuskway/SKILL.md",
  );
  assert.equal(codex.onboardingSkill, "./skills/setup-tuskway/SKILL.md");
});

test("plan and tackle descriptions stay on a named Tuskway task", () => {
  const plan = readFileSync(
    path.join(pluginRoot, "skills/plan-tuskway/SKILL.md"),
    "utf8",
  );
  const tackle = readFileSync(
    path.join(pluginRoot, "skills/tackle-ticket-tuskway/SKILL.md"),
    "utf8",
  );
  assert.match(plan, /ready to start/);
  assert.match(plan, /next round of a Tuskway epic/);
  assert.match(plan, /personal schedules/);
  assert.equal(plan.includes("plan an epic"), false);
  assert.match(tackle, /Tuskway ticket they named/);
  assert.match(tackle, /without a Tuskway ticket/);
  assert.equal(/weekend|receipt total/i.test(`${plan}\n${tackle}`), false);
});

test("authored skills keep portable frontmatter and local links", () => {
  const skillsDir = path.join(pluginRoot, "skills");
  assert.deepEqual(skillNames(root), requiredSkills);
  assert.equal(requiredSkills.includes("sync-design-tuskway"), true);
  assert.equal(requiredSkills.length, 9);
  assert.deepEqual(packageContentErrors(root), []);
  assert.equal(
    readFileSync(path.join(skillsDir, ".gitkeep"), "utf8"),
    "",
  );
});

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
  assert.deepEqual(pkg.scripts, {
    "build:openai-zip": "node scripts/build-openai-zip.mjs",
  });
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
        return base !== ".git" && base !== "node_modules" && base !== "dist";
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
    assert.equal(file.endsWith(`${path.sep}hooks.json`), false, relative);
  }
  assert.equal(
    readFileSync(path.join(root, ".gitattributes"), "utf8").includes("eol=lf"),
    true,
  );
});

test("README documents install and the MCP constraints", () => {
  const readme = readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /https:\/\/tuskway\.com\/mcp/);
  assert.match(readme, /streamable-http/);
  assert.match(readme, /rejects any other field/);
  assert.match(readme, /onboardingSkill/);
  assert.match(readme, /npm publish/);
  assert.match(readme, /git tag vX\.Y\.Z/);
  assert.match(readme, /build:openai-zip/);
  assert.match(readme, /--folder/);
  assert.match(readme, /claude plugin validate \.\/plugins\/tuskway/);
  assert.equal(readme.includes("## Private testing"), false);
  assert.equal(readme.includes("## Later public install"), false);
  assert.equal(/were not run|client-checks|liveAcceptance|This repository is public/i.test(readme), false);
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

test("gemini extension and registry server share the hosted MCP URL", async () => {
  const gemini = readJson("gemini-extension.json");
  assert.equal(gemini.contextFileName, "GEMINI.md");
  assert.equal(gemini.mcpServers.tuskway.httpUrl, mcpUrl);
  assert.equal(existsSync(path.join(root, "GEMINI.md")), true);
  const geminiText = readFileSync(path.join(root, "GEMINI.md"), "utf8");
  for (const name of requiredSkills) assert.match(geminiText, new RegExp(name));

  const server = readJson("server.json");
  assert.equal(server.name, "com.tuskway/tuskway");
  assert.equal(server.version, version);
  assert.equal(server.description, description);
  assert.equal(server.description.length <= 100, true);
  assert.deepEqual(server.remotes, [{ type: "streamable-http", url: mcpUrl }]);
  const schema = await fetchSchema(server.$schema);
  const detail = schema.definitions.ServerDetail;
  const transport = schema.definitions.StreamableHttpTransport;
  for (const key of ["name", "description", "version"]) {
    assert.equal(detail.required.includes(key), true, key);
  }
  assert.match(server.name, new RegExp(detail.properties.name.pattern));
  assert.equal(server.description.length <= detail.properties.description.maxLength, true);
  assert.equal(transport.properties.type.enum.includes("streamable-http"), true);
  assert.match(server.remotes[0].url, new RegExp(transport.properties.url.pattern));

  const report = versionReport(root);
  assert.equal(report.drift.length, 0);
  assert.equal(report.rows.some((row) => row.path === "server.json" && row.version === version), true);
  assert.equal(report.rows.some((row) => row.path === "gemini-extension.json" && row.version === version), true);
});

function positiveCase(index) {
  return {
    description: `Case ${index}`,
    prompt: `Prompt ${index}`,
    tools_triggered: "epic_list",
    expected_behavior: "The reviewer sees the epic list.",
  };
}

test("OpenAI review schema accepts a complete case list and rejects a partial one", () => {
  const complete = reviewErrors({
    demo_recording_url: "https://tuskway.com/demo",
    test_cases: {
      positive: [1, 2, 3, 4, 5].map(positiveCase),
      negative: [1, 2, 3].map((index) => ({
        description: `Negative ${index}`,
        prompt: `Negative prompt ${index}`,
      })),
    },
  });
  assert.deepEqual(complete, []);
  const short = reviewErrors({
    test_cases: {
      positive: [1, 2, 3, 4].map(positiveCase),
      negative: [{ description: "No", prompt: "No" }],
    },
  });
  assert.equal(short.some((error) => error.includes("exactly 5")), true);
  assert.equal(short.some((error) => error.includes("exactly 3")), true);
  assert.equal(
    reviewErrors({ demo_recording_url: "demo.mp4" }).some((error) => error.includes("https URL")),
    true,
  );
  assert.equal(
    reviewErrors({ release_notes: "notes" }).some((error) => error.includes("release_notes")),
    true,
  );
  const shipped = readJson("plugins/tuskway/plugin.json").extensions["com.openai"];
  assert.equal(Object.hasOwn(shipped.review, "test_cases"), false);
  assert.equal(Object.hasOwn(shipped.review, "demo_recording_url"), false);
});

test("OpenAI ZIP layout is one plugin root and fails on credentials", async () => {
  assert.equal(
    defaultZipPath(root, version),
    path.join(root, "dist", `tuskway-openai-${version}.zip`),
  );
  assert.equal(releaseTagError(`v${version}`, version), null);
  assert.match(releaseTagError("v9.9.9", version), /does not match/);
  assert.equal(zipLayoutErrors([
    "plugin.json",
    "mcp.json",
    "skills/setup-tuskway/SKILL.md",
    "assets/icon.png",
    "extra.txt",
  ]).some((error) => error.includes("outside")), true);
  assert.deepEqual(zipLayoutErrors([
    "tuskway/plugin.json",
    "tuskway/mcp.json",
    "tuskway/skills/setup-tuskway/SKILL.md",
    "tuskway/assets/icon.png",
  ]), []);

  const built = await buildOpenAiZip({
    plugin: pluginRoot,
    folder: "",
    out: path.join(root, "dist", `tuskway-openai-${version}.zip`),
  });
  assert.deepEqual(built.errors, [], built.errors.join("\n"));
  const names = execFileSync("unzip", ["-Z1", built.zipPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(zipLayoutErrors(names), []);
  assert.equal(names.includes("plugin.json"), true);
  assert.equal(names.includes("mcp.json"), true);
  assert.equal(names.some((name) => name.startsWith("skills/")), true);
  assert.equal(names.some((name) => name.startsWith("assets/")), true);
  assert.equal(names.some((name) => name.includes(".app.json") || name.split("/").includes("apps")), false);
  assert.equal(names.some((name) => name.split("/").some((part) => part.startsWith("."))), false);
  assert.equal(names.includes("skills/.gitkeep"), false);
  const zipText = readFileSync(built.zipPath);
  assert.equal(zipText.includes(Buffer.from("test_credentials")), false);
  assert.equal(zipText.includes(Buffer.from("reviewer_instructions")), false);

  const folded = await buildOpenAiZip({
    plugin: pluginRoot,
    folder: "tuskway",
    out: path.join(tmpdir(), `tuskway-folder-${process.pid}.zip`),
  });
  assert.deepEqual(folded.errors, []);
  const foldedNames = execFileSync("unzip", ["-Z1", folded.zipPath], { encoding: "utf8" })
    .split("\n")
    .filter((name) => name && !name.endsWith("/"));
  assert.equal(foldedNames.every((name) => name.startsWith("tuskway/")), true);
  assert.equal(new Set(foldedNames.map((name) => name.split("/")[0])).size, 1);
  rmSync(folded.zipPath, { force: true });

  const broken = mkdtempSync(path.join(tmpdir(), "tuskway-zip-"));
  try {
    cpSync(pluginRoot, broken, { recursive: true });
    writeFileSync(path.join(broken, "skills/setup-tuskway/leak.md"), "token sk-live-abcdef12\n");
    const leaked = await buildOpenAiZip({
      plugin: broken,
      folder: "",
      out: path.join(broken, "leaked.zip"),
    });
    assert.equal(leaked.errors.some((error) => error.includes("credential pattern")), true);
    assert.equal(existsSync(path.join(broken, "leaked.zip")), false);

    writeFileSync(path.join(broken, "skills/setup-tuskway/leak.md"), "clean\n");
    const pluginJson = JSON.parse(readFileSync(path.join(broken, "plugin.json"), "utf8"));
    pluginJson.extensions["com.openai"].review.test_credentials = { email: "person@example.com" };
    writeFileSync(path.join(broken, "plugin.json"), JSON.stringify(pluginJson));
    const keyed = await buildOpenAiZip({
      plugin: broken,
      folder: "",
      out: path.join(broken, "keyed.zip"),
    });
    assert.equal(keyed.errors.some((error) => error.includes("test_credentials")), true);
    assert.equal(existsSync(path.join(broken, "keyed.zip")), false);

    delete pluginJson.extensions["com.openai"].review.test_credentials;
    writeFileSync(path.join(broken, "plugin.json"), JSON.stringify(pluginJson));
    const skillPath = path.join(broken, "skills/setup-tuskway/SKILL.md");
    writeFileSync(skillPath, readFileSync(skillPath, "utf8").replace("name: setup-tuskway", "name: other-tuskway"));
    const renamed = await buildOpenAiZip({
      plugin: broken,
      folder: "",
      out: path.join(broken, "renamed.zip"),
    });
    assert.equal(renamed.errors.some((error) => error.includes("frontmatter name")), true);
  } finally {
    rmSync(broken, { recursive: true, force: true });
    rmSync(path.join(root, "dist"), { recursive: true, force: true });
  }
});

test("OpenAI ZIP bytes stay identical and the folder cannot escape", async () => {
  const stage = mkdtempSync(path.join(tmpdir(), "tuskway-stage-"));
  assert.equal(folderError(stage, "."), "--folder must be a single directory name");
  assert.equal(folderError(stage, ".."), "--folder must be a single directory name");
  assert.equal(folderError(stage, "tuskway"), null);
  const outside = path.resolve(stage, "..", "escape");
  assert.equal(outside.startsWith(`${path.resolve(stage)}${path.sep}`), false);

  const first = path.join(tmpdir(), `tuskway-bytes-a-${process.pid}.zip`);
  const second = path.join(tmpdir(), `tuskway-bytes-b-${process.pid}.zip`);
  try {
    const left = await buildOpenAiZip({ plugin: pluginRoot, folder: "", out: first });
    const right = await buildOpenAiZip({ plugin: pluginRoot, folder: "", out: second });
    assert.deepEqual(left.errors, [], left.errors.join("\n"));
    assert.deepEqual(right.errors, []);
    assert.deepEqual(readFileSync(first), readFileSync(second));
    for (const folder of [".", ".."]) {
      const escaped = await buildOpenAiZip({
        plugin: pluginRoot,
        folder,
        out: path.join(tmpdir(), `tuskway-escape-${folder.length}-${process.pid}.zip`),
      });
      assert.equal(escaped.errors.some((error) => error.includes("--folder")), true, folder);
      assert.equal(escaped.zipPath, undefined);
    }
  } finally {
    rmSync(first, { force: true });
    rmSync(second, { force: true });
    rmSync(stage, { recursive: true, force: true });
  }
});

test("a symlinked skills directory is rejected before copy", async () => {
  const linked = mkdtempSync(path.join(tmpdir(), "tuskway-linked-"));
  const out = path.join(linked, "linked.zip");
  try {
    cpSync(pluginRoot, linked, {
      recursive: true,
      filter: (candidate) => path.basename(candidate) !== "skills",
    });
    mkdirSync(linked, { recursive: true });
    symlinkSync(path.join(pluginRoot, "skills"), path.join(linked, "skills"));
    const result = await buildOpenAiZip({ plugin: linked, folder: "", out });
    assert.equal(result.errors.some((error) => error.includes("symlink skills")), true);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(linked, { recursive: true, force: true });
  }
});

test("plugin limits fail on a symlink, a large text file, too many files, and a submodule", () => {
  assert.equal(MAX_FILES, 512);
  assert.equal(MAX_NON_IMAGE_BYTES, 256 * 1024);
  const dir = mkdtempSync(path.join(tmpdir(), "tuskway-limits-"));
  try {
    mkdirSync(path.join(dir, "ok"));
    writeFileSync(path.join(dir, "ok/a.txt"), "a");
    writeFileSync(path.join(dir, "ok/b.png"), Buffer.alloc(64));
    assert.deepEqual(treeErrors(dir, { maxFiles: 2, maxBytes: 32 }), []);
    writeFileSync(path.join(dir, "ok/c.txt"), "c");
    assert.equal(treeErrors(dir, { maxFiles: 2 }).some((error) => error.includes("file count")), true);
    writeFileSync(path.join(dir, "ok/big.md"), Buffer.alloc(64));
    assert.equal(
      treeErrors(dir, { maxFiles: 10, maxBytes: 32 }).some((error) => error.includes("non-image")),
      true,
    );
    symlinkSync(path.join(dir, "ok/a.txt"), path.join(dir, "ok/link.txt"));
    assert.equal(treeErrors(dir, { maxFiles: 10, maxBytes: 32 }).some((error) => error.includes("symlink")), true);
    assert.deepEqual(submoduleErrors("160000 abcdef plugins/tuskway\n100644 dead README.md\n"), [
      "submodule 160000 abcdef plugins/tuskway",
    ]);
    assert.deepEqual(treeErrors(pluginRoot).filter((error) => error.includes("symlink") || error.includes("file count")), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
