import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const requiredSkills = [
  "comments-tuskway",
  "draft-tickets-tuskway",
  "plan-tuskway",
  "setup-tuskway",
  "start-epic-tuskway",
  "tackle-ticket-tuskway",
  "tracker-changes-tuskway",
  "write-design-tuskway",
];

export const optionalSkills = ["sync-design-tuskway"];

const versionFiles = [
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
    rows.push({
      path: relativePath,
      version: versionAt(readJson(root, relativePath), relativePath) ?? null,
      missing: false,
    });
  }
  const canonical = rows.find((row) => row.path === "plugins/tuskway/plugin.json");
  const drift = rows.filter(
    (row) => row.missing || row.version !== canonical?.version,
  );
  return {
    canonical: canonical?.version ?? null,
    rows,
    drift,
    unversioned: unversionedManifests,
  };
}
