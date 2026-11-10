import { spawnSync } from "node:child_process";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSchema, schemaErrors } from "./agent-schema.mjs";
import { forbiddenKeyErrors, openaiExtensionErrors } from "./openai-review.mjs";
import { zipLayoutErrors } from "./zip-layout.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginSchemaUrl = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const mcpSchemaUrl = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

const credentialPattern = /(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9][A-Za-z0-9-]{7,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})|(?:bearer\s+[A-Za-z0-9._~+/-]{8,})|(?:api[_-]?key|client[_-]?secret)\s*[:=]\s*\S+|authorization\s*:\s*\S+/i;

export function defaultZipPath(root, version) {
  return path.join(root, "dist", `tuskway-openai-${version}.zip`);
}

function fail(errors) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

function args(argv) {
  const parsed = {
    plugin: path.join(repoRoot, "plugins/tuskway"),
    folder: "",
    out: "",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--folder") {
      const value = argv[++i];
      if (!value || !/^[A-Za-z0-9._-]+$/.test(value)) fail(["--folder must be a single path segment"]);
      parsed.folder = value;
    } else if (arg === "--plugin") {
      const value = argv[++i];
      if (!value) fail(["missing --plugin"]);
      parsed.plugin = path.resolve(value);
    } else if (arg === "--out") {
      const value = argv[++i];
      if (!value) fail(["missing --out"]);
      parsed.out = path.resolve(value);
    } else {
      fail([`unknown argument ${arg}`]);
    }
  }
  return parsed;
}

function skillFolderName(text, folder) {
  if (!text.startsWith("---\n")) return { error: `${folder} frontmatter must start with ---` };
  const end = text.indexOf("\n---\n", 4);
  if (end <= 4) return { error: `${folder} frontmatter is not closed` };
  const line = text.slice(4, end).split("\n").find((item) => item.startsWith("name:"));
  if (!line) return { error: `${folder} frontmatter name is missing` };
  const name = line.slice("name:".length).trim().replace(/^"|"$/g, "");
  if (name !== folder) return { error: `${folder} frontmatter name is ${name}` };
  return { name };
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (lstatSync(full).isSymbolicLink()) {
      return { error: `symlink ${path.relative(dir, full) || entry.name}` };
    }
    if (entry.isDirectory()) {
      const nested = walkFiles(full);
      if (nested.error) return nested;
      files.push(...nested.files);
    } else if (entry.isFile()) {
      files.push(full);
    } else {
      return { error: `special file ${entry.name}` };
    }
  }
  return { files };
}

function copyPackage(pluginDir, destination) {
  const errors = [];
  mkdirSync(destination, { recursive: true });
  for (const name of ["plugin.json", "mcp.json"]) {
    const source = path.join(pluginDir, name);
    if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
      errors.push(`${name} is missing`);
      continue;
    }
    if (lstatSync(source).isSymbolicLink()) errors.push(`symlink ${name}`);
    else cpSync(source, path.join(destination, name));
  }
  for (const name of ["skills", "assets"]) {
    const source = path.join(pluginDir, name);
    if (!statSync(source, { throwIfNoEntry: false })?.isDirectory()) {
      errors.push(`${name}/ is missing`);
      continue;
    }
    const walked = walkFiles(source);
    if (walked.error) errors.push(`${name}: ${walked.error}`);
    else cpSync(source, path.join(destination, name), { recursive: true, verbatimSymlinks: true });
  }
  return errors;
}

function contentErrors(destination) {
  const errors = [];
  const walked = walkFiles(destination);
  if (walked.error) return [walked.error];
  const skills = path.join(destination, "skills");
  const folders = readdirSync(skills, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (folders.length === 0) errors.push("skills/ is missing a skill");
  for (const folder of folders) {
    const skillPath = path.join(skills, folder.name, "SKILL.md");
    if (!statSync(skillPath, { throwIfNoEntry: false })?.isFile()) {
      errors.push(`${folder.name} is missing SKILL.md`);
      continue;
    }
    const parsed = skillFolderName(readFileSync(skillPath, "utf8"), folder.name);
    if (parsed.error) errors.push(parsed.error);
  }
  for (const file of walked.files) {
    const relative = path.relative(destination, file);
    const text = readFileSync(file);
    if (credentialPattern.test(text.toString("latin1"))) {
      errors.push(`${relative} matches a credential pattern`);
    }
    if (file.endsWith(".json")) {
      try {
        errors.push(...forbiddenKeyErrors(JSON.parse(text.toString("utf8")), relative));
      } catch {
        errors.push(`${relative} is not json`);
      }
    }
  }
  return errors;
}

async function manifestErrors(destination) {
  const plugin = JSON.parse(readFileSync(path.join(destination, "plugin.json"), "utf8"));
  const mcp = JSON.parse(readFileSync(path.join(destination, "mcp.json"), "utf8"));
  const [pluginSchema, mcpSchema] = await Promise.all([
    fetchSchema(pluginSchemaUrl),
    fetchSchema(mcpSchemaUrl),
  ]);
  const errors = [
    ...schemaErrors(pluginSchema, plugin).map((error) => `plugin.json ${error}`),
    ...schemaErrors(mcpSchema, mcp).map((error) => `mcp.json ${error}`),
    ...openaiExtensionErrors(plugin.extensions?.["com.openai"]),
  ];
  return { errors, version: plugin.version };
}

function zipNames(zipPath) {
  const listed = spawnSync("zipinfo", ["-1", zipPath], { encoding: "utf8" });
  if (listed.status !== 0) {
    const unzipped = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
    if (unzipped.status !== 0) fail(["could not list the ZIP"]);
    return unzipped.stdout.split("\n").filter(Boolean);
  }
  return listed.stdout.split("\n").filter(Boolean);
}

export async function buildOpenAiZip({ plugin, folder, out }) {
  const stageParent = path.join(tmpdir(), `tuskway-openai-${process.pid}`);
  rmSync(stageParent, { recursive: true, force: true });
  const destination = folder ? path.join(stageParent, folder) : stageParent;
  mkdirSync(destination, { recursive: true });
  try {
    const copyProblems = copyPackage(plugin, destination);
    if (copyProblems.length > 0) return { errors: copyProblems };
    const problems = [
      ...contentErrors(destination),
      ...(await manifestErrors(destination)).errors,
    ];
    if (problems.length > 0) return { errors: problems };
    const version = JSON.parse(readFileSync(path.join(destination, "plugin.json"), "utf8")).version;
    const zipPath = out || defaultZipPath(repoRoot, version);
    mkdirSync(path.dirname(zipPath), { recursive: true });
    rmSync(zipPath, { force: true });
    const packed = spawnSync("zip", ["-r", "-X", "-q", zipPath, folder || "plugin.json", ...(folder ? [] : ["mcp.json", "skills", "assets"])], {
      cwd: stageParent,
    });
    if (packed.status !== 0) return { errors: ["zip failed"] };
    const layout = zipLayoutErrors(zipNames(zipPath));
    if (layout.length > 0) {
      rmSync(zipPath, { force: true });
      return { errors: layout };
    }
    return { errors: [], zipPath, version };
  } finally {
    rmSync(stageParent, { recursive: true, force: true });
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const parsed = args(process.argv);
  const result = await buildOpenAiZip(parsed);
  if (result.errors.length > 0) fail(result.errors);
  console.log(JSON.stringify({
    ok: true,
    zip: path.relative(repoRoot, result.zipPath),
    version: result.version,
    folder: parsed.folder || null,
  }));
}
