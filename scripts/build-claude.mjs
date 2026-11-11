import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const defaultDest = path.join(repoRoot, "dist/claude");
export const pluginSource = path.join(repoRoot, "plugins/tuskway");
export const CLAUDE_REPO_URL = "https://github.com/Tuskway/plugin-claude";

export const ALLOWED_EXTENSIONS = new Set([
  "md",
  "txt",
  "json",
  "yaml",
  "yml",
  "png",
  "jpeg",
  "jpg",
  "gif",
  "webp",
  "ico",
]);

export const SPECIAL_BASENAMES = new Set(["LICENSE", "README", ".gitignore"]);

export const TEXT_EXTENSIONS = new Set(["md", "txt", "json", "yaml", "yml"]);

const SKIP_PLUGIN_PATHS = new Set([
  "assets/logo.svg",
  "skills/.gitkeep",
  "plugin.json",
  "mcp.json",
]);

const SKIP_PLUGIN_PREFIXES = [
  "skills/sync-design-tuskway/scripts/",
  ".cursor-plugin/",
  ".codex-plugin/",
];

const DRIFT_PARAGRAPH = "`scripts/drift.mjs` checks a pull-request list you already fetched. It writes nothing. It accepts an edit only when that same string was shown and approved.";

const HAND_COMPARE_PARAGRAPH = "Check the pull-request list you already fetched by hand, following the steps in this skill. Write nothing. Accept an edit only when that same string was shown and approved.";

const ROOT_README = `# Tuskway plugin

The Tuskway plugin for Claude Code. It connects to the hosted MCP server at \`https://tuskway.com/mcp\` and includes workflow skills for starting an epic, writing the design, drafting tickets, planning parallel work, tackling a ticket, and handling comments and tracker changes.

## Install

\`\`\`
/plugin marketplace add tuskway/plugin-claude
/plugin install tuskway@tuskway
\`\`\`

Then sign in with \`/mcp\` and select \`plugin:tuskway:tuskway\`.

Tuskway is a shared epic notebook for software teams. The package stores no access tokens.
`;

function fail(errors) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

function posix(relative) {
  return relative.split(path.sep).join("/");
}

export function walkFiles(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink() || lstatSync(full).isSymbolicLink()) {
        return { error: `symlink is not allowed: ${full}` };
      }
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
      else return { error: `unsupported file type: ${full}` };
    }
  }
  files.sort();
  return { files };
}

function extensionOf(basename) {
  const dot = basename.lastIndexOf(".");
  if (dot <= 0) return "";
  return basename.slice(dot + 1).toLowerCase();
}

function isAllowedName(relative) {
  const basename = path.posix.basename(relative);
  if (SPECIAL_BASENAMES.has(basename)) return true;
  const ext = extensionOf(basename);
  return ALLOWED_EXTENSIONS.has(ext);
}

function isTextFile(relative) {
  const basename = path.posix.basename(relative);
  if (SPECIAL_BASENAMES.has(basename)) return true;
  return TEXT_EXTENSIONS.has(extensionOf(basename));
}

function skipPluginFile(relative) {
  if (SKIP_PLUGIN_PATHS.has(relative)) return true;
  return SKIP_PLUGIN_PREFIXES.some((prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix));
}

function utf8NulAndShebangErrors(relative, bytes) {
  const errors = [];
  if (bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21) {
    errors.push(`${relative} begins with a shebang`);
  }
  if (!isTextFile(relative)) return errors;
  if (bytes.includes(0)) errors.push(`${relative} contains a NUL byte`);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    errors.push(`${relative} is not valid UTF-8`);
  }
  return errors;
}

export function claudeSafetyErrors(dir) {
  const listed = walkFiles(dir);
  if (listed.error) return [listed.error];
  const errors = [];
  for (const full of listed.files) {
    const relative = posix(path.relative(dir, full));
    if (!isAllowedName(relative)) {
      errors.push(`${relative} is not an allowed file type`);
    }
    errors.push(...utf8NulAndShebangErrors(relative, readFileSync(full)));
  }
  return errors;
}

export function rewriteSyncDesignSkill(text) {
  if (!text.includes(DRIFT_PARAGRAPH)) {
    return { error: "sync-design-tuskway/SKILL.md does not contain the expected drift.mjs paragraph" };
  }
  const next = text.replace(DRIFT_PARAGRAPH, HAND_COMPARE_PARAGRAPH);
  if (next.includes("scripts/drift.mjs") || next.includes("drift.mjs")) {
    return { error: "rewritten SKILL.md still mentions drift.mjs" };
  }
  return { text: next };
}

function readPluginVersion(root) {
  const manifestPath = path.join(root, "plugins/tuskway/.claude-plugin/plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof manifest.version !== "string" || !manifest.version) {
    throw new Error("plugins/tuskway/.claude-plugin/plugin.json is missing version");
  }
  return { version: manifest.version, manifest };
}

function writeMarketplace(dest, version, description) {
  const marketplace = {
    name: "tuskway",
    description,
    owner: { name: "Tuskway" },
    plugins: [
      {
        name: "tuskway",
        description,
        source: "./plugins/tuskway",
        version,
      },
    ],
  };
  const dir = path.join(dest, ".claude-plugin");
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/marketplace.json`, `${JSON.stringify(marketplace, null, 2)}\n`);
}

function copyPluginTree(destPlugin) {
  const listed = walkFiles(pluginSource);
  if (listed.error) return [listed.error];
  for (const full of listed.files) {
    const relative = posix(path.relative(pluginSource, full));
    if (skipPluginFile(relative)) continue;
    const target = path.join(destPlugin, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(full, target);
  }
  return [];
}

function patchGeneratedPluginManifest(destPlugin) {
  const manifestPath = path.join(destPlugin, ".claude-plugin/plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.repository = CLAUDE_REPO_URL;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function rewriteCopiedSkill(destPlugin) {
  const skillPath = path.join(destPlugin, "skills/sync-design-tuskway/SKILL.md");
  const rewritten = rewriteSyncDesignSkill(readFileSync(skillPath, "utf8"));
  if (rewritten.error) return [rewritten.error];
  writeFileSync(skillPath, rewritten.text);
  return [];
}

export function buildClaude({ root = repoRoot, dest = defaultDest } = {}) {
  const errors = [];
  const resolvedDest = path.resolve(dest);
  const resolvedRoot = path.resolve(root);
  if (resolvedDest === resolvedRoot || resolvedRoot.startsWith(`${resolvedDest}${path.sep}`)) {
    return { errors: ["destination must not contain the repository root"] };
  }
  if (pluginSource === resolvedDest || resolvedDest.startsWith(`${pluginSource}${path.sep}`)) {
    return { errors: ["destination must not be inside plugins/tuskway"] };
  }

  let version;
  let description;
  try {
    const read = readPluginVersion(resolvedRoot);
    version = read.version;
    description = read.manifest.description;
  } catch (error) {
    return { errors: [error.message] };
  }

  rmSync(resolvedDest, { recursive: true, force: true });
  mkdirSync(resolvedDest, { recursive: true });

  const destPlugin = path.join(resolvedDest, "plugins/tuskway");
  errors.push(...copyPluginTree(destPlugin));
  if (errors.length > 0) return { errors };

  try {
    patchGeneratedPluginManifest(destPlugin);
  } catch (error) {
    return { errors: [error.message] };
  }

  errors.push(...rewriteCopiedSkill(destPlugin));
  if (errors.length > 0) return { errors };

  writeMarketplace(resolvedDest, version, description);
  cpSync(path.join(resolvedRoot, "LICENSE"), path.join(resolvedDest, "LICENSE"));
  writeFileSync(path.join(resolvedDest, "README.md"), ROOT_README);
  writeFileSync(path.join(resolvedDest, ".gitignore"), ".DS_Store\n");

  const safety = claudeSafetyErrors(resolvedDest);
  if (safety.length > 0) return { errors: safety };

  const listed = walkFiles(resolvedDest);
  if (listed.error) return { errors: [listed.error] };

  return {
    errors: [],
    dest: resolvedDest,
    version,
    files: listed.files.map((full) => posix(path.relative(resolvedDest, full))),
  };
}

function args(argv) {
  const parsed = { dest: defaultDest };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("-")) fail([`unknown argument ${arg}`]);
    if (parsed.dest !== defaultDest) fail(["destination already set"]);
    parsed.dest = path.resolve(arg);
  }
  return parsed;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const parsed = args(process.argv);
  const result = buildClaude({ dest: parsed.dest });
  if (result.errors.length > 0) fail(result.errors);
  console.log(JSON.stringify({
    ok: true,
    dest: path.relative(repoRoot, result.dest) || result.dest,
    version: result.version,
    files: result.files.length,
  }, null, 2));
}
