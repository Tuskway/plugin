import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_FILES = 512;
export const MAX_NON_IMAGE_BYTES = 256 * 1024;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"]);

export function treeErrors(rootDir, limits = {}) {
  const maxFiles = limits.maxFiles ?? MAX_FILES;
  const maxBytes = limits.maxBytes ?? MAX_NON_IMAGE_BYTES;
  const errors = [];
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const stat = lstatSync(full);
      const relative = path.relative(rootDir, full);
      if (stat.isSymbolicLink()) {
        errors.push(`symlink ${relative}`);
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!stat.isFile()) {
        errors.push(`special file ${relative}`);
        continue;
      }
      count += 1;
      const extension = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension) && stat.size > maxBytes) {
        errors.push(`non-image over 256 KiB ${relative}`);
      }
    }
  };
  walk(rootDir);
  if (count > maxFiles) errors.push(`file count ${count} exceeds ${maxFiles}`);
  return errors;
}

export function submoduleErrors(lsFilesOutput) {
  const errors = [];
  for (const line of String(lsFilesOutput).split("\n")) {
    if (line.startsWith("160000 ")) errors.push(`submodule ${line.trim()}`);
  }
  return errors;
}

function gitmodulesMention(root, pluginRelative) {
  const gitmodules = path.join(root, ".gitmodules");
  if (!existsSync(gitmodules)) return [];
  const text = readFileSync(gitmodules, "utf8");
  if (text.includes(pluginRelative)) return ["gitmodules lists the plugin folder"];
  return [];
}

export function pluginLimitErrors(repoRoot, pluginRelative = "plugins/tuskway") {
  const pluginDir = path.join(repoRoot, pluginRelative);
  const errors = treeErrors(pluginDir);
  errors.push(...gitmodulesMention(repoRoot, pluginRelative));
  const listed = spawnSync("git", ["ls-files", "-s", "--", pluginRelative], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (listed.status !== 0) {
    errors.push("git ls-files failed");
    return errors;
  }
  errors.push(...submoduleErrors(listed.stdout));
  return errors;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const errors = pluginLimitErrors(repoRoot);
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, root: "plugins/tuskway" }));
}
