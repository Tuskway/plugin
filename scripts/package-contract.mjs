import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export const requiredSkills = [
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

export const optionalSkills = [];

export const versionFiles = [
  "plugins/tuskway/plugin.json",
  "plugins/tuskway/.claude-plugin/plugin.json",
  "plugins/tuskway/.cursor-plugin/plugin.json",
  "plugins/tuskway/.codex-plugin/plugin.json",
  ".grok-plugin/plugin.json",
  "package.json",
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
];

export const unversionedManifests = [".agents/plugins/marketplace.json"];

export function skillSetErrors(found) {
  const allowed = new Set([...requiredSkills, ...optionalSkills]);
  const errors = [];
  for (const name of requiredSkills) {
    if (!found.includes(name)) errors.push(`missing ${name}`);
  }
  for (const name of found) {
    if (!allowed.has(name)) errors.push(`unexpected ${name}`);
  }
  return errors;
}

export function skillNames(root) {
  const skillsDir = path.join(root, "plugins/tuskway/skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function versionAt(json, relativePath) {
  if (relativePath.endsWith("marketplace.json")) return json.plugins?.[0]?.version;
  return json.version;
}

export function versionReport(root) {
  const rows = [];
  for (const relativePath of versionFiles) {
    const full = path.join(root, relativePath);
    if (!existsSync(full)) {
      rows.push({ path: relativePath, version: null, missing: true });
      continue;
    }
    try {
      rows.push({
        path: relativePath,
        version: versionAt(readJson(root, relativePath), relativePath) ?? null,
        missing: false,
      });
    } catch {
      rows.push({ path: relativePath, version: null, missing: false, error: "invalid json" });
    }
  }
  const canonical = rows.find((row) => row.path === "plugins/tuskway/plugin.json");
  const drift = rows.filter(
    (row) => row.missing || row.error || row.version !== canonical?.version,
  );
  return {
    canonical: canonical?.version ?? null,
    rows,
    drift,
    unversioned: unversionedManifests,
  };
}

const hostedRunner = /\b(?:ubuntu-latest|ubuntu-\d+\.\d+|macos-latest|macos-\d+|windows-latest|windows-\d+)\b/;

export function workflowErrors(text) {
  const errors = [];
  if (hostedRunner.test(text)) errors.push("workflow selects a GitHub-hosted runner");
  if (!text.includes("self-hosted") || !/\btuskway\b/.test(text)) {
    errors.push("workflow does not require the self-hosted tuskway runner");
  }
  if (/^\s*(?:push|pull_request|schedule|workflow_call):/m.test(text)) {
    errors.push("workflow is not manual");
  }
  if (!/^\s*workflow_dispatch:/m.test(text)) errors.push("workflow has no manual dispatch");
  return errors;
}

function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

function frontmatter(text) {
  if (!text.startsWith("---\n")) return { error: "frontmatter must start with ---" };
  const end = text.indexOf("\n---\n", 4);
  if (end <= 4) return { error: "frontmatter is not closed" };
  const data = {};
  const lines = text.slice(4, end).split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.startsWith(" ")) continue;
    const match = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(line);
    if (!match) return { error: `frontmatter line is not a field: ${line}` };
    if (match[2] === "") {
      const nested = {};
      while (lines[i + 1]?.startsWith("  ")) {
        i += 1;
        const child = /^  ([A-Za-z0-9-]+):\s*(.*)$/.exec(lines[i]);
        if (!child) return { error: `frontmatter line is not a field: ${lines[i]}` };
        nested[child[1]] = unquote(child[2]);
      }
      data[match[1]] = nested;
    } else {
      data[match[1]] = unquote(match[2]);
    }
  }
  if (typeof data.description !== "string") return { error: "description is missing" };
  return { data };
}

function resourceError(skillDir, link) {
  const clean = link.split("#")[0].split("?")[0];
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean)) return null;
  const parts = clean.replaceAll("\\", "/").split("/");
  if (path.isAbsolute(clean) || parts.includes("..")) return `resource escapes the skill: ${link}`;
  const resolved = path.resolve(skillDir, clean);
  if (!existsSync(resolved)) return `missing resource ${link}`;
  const realBase = realpathSync(skillDir);
  const realTarget = realpathSync(resolved);
  if (realTarget !== realBase && !realTarget.startsWith(`${realBase}${path.sep}`)) {
    return `resource escapes the skill: ${link}`;
  }
  return null;
}

function skillTextErrors(name, skillDir, text) {
  const errors = [];
  if (text.includes("\r")) errors.push(`${name} must use LF`);
  if (Buffer.byteLength(text) >= 8000) errors.push(`${name} main file is ${Buffer.byteLength(text)} bytes`);
  if (text.includes("${")) errors.push(`${name} interpolates a template`);
  if (/generated-from|body-sha256/i.test(text)) errors.push(`${name} uses a generated-body marker`);
  if (/\bTODO\b|\bTBD\b|lorem ipsum|<placeholder>/i.test(text)) errors.push(`${name} contains a placeholder`);
  const parsed = frontmatter(text);
  if (parsed.error) {
    errors.push(`${name} ${parsed.error}`);
    return errors;
  }
  const { description } = parsed.data;
  if (parsed.data.name !== name) errors.push(`${name} frontmatter name is ${parsed.data.name ?? "missing"}`);
  if (description.length === 0 || description.length > 1024) errors.push(`${name} description length is ${description.length}`);
  if (!/Use when/.test(description) || !/not for/i.test(description)) {
    errors.push(`${name} description does not say when to use it and what it is not for`);
  }
  for (const link of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const problem = resourceError(skillDir, link[1]);
    if (problem) errors.push(`${name} ${problem}`);
  }
  return errors;
}

function scriptErrors(name, skillDir) {
  const dir = path.join(skillDir, "scripts");
  if (!existsSync(dir)) return [];
  const errors = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".mjs") && !entry.endsWith(".js")) continue;
    const body = readFileSync(path.join(dir, entry), "utf8");
    if (body.trim().length < 40 || !/\b(?:export|function)\b/.test(body)) {
      errors.push(`${name} script ${entry} has no behavior`);
    }
  }
  return errors;
}

export function packageContentErrors(root) {
  const names = skillNames(root);
  const errors = skillSetErrors(names);
  const skillsDir = path.join(root, "plugins/tuskway/skills");
  for (const name of names) {
    if (!name.endsWith("-tuskway") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      errors.push(`${name} is not a portable skill name`);
    }
    const skillDir = path.join(skillsDir, name);
    const skillPath = path.join(skillDir, "SKILL.md");
    if (!existsSync(skillPath)) {
      errors.push(`${name} is missing SKILL.md`);
      continue;
    }
    const text = readFileSync(skillPath, "utf8");
    errors.push(...skillTextErrors(name, skillDir, text));
    errors.push(...scriptErrors(name, skillDir));
  }
  return errors;
}
