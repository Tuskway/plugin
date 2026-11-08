import path from "node:path";
import { fileURLToPath } from "node:url";
import { versionReport } from "./package-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function args(argv) {
  const parsed = { check: false, root: repoRoot };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--root") parsed.root = path.resolve(argv[++i]);
    else {
      console.error(`unknown argument ${arg}`);
      process.exit(2);
    }
  }
  return parsed;
}

const parsed = args(process.argv);
if (!parsed.check) {
  console.error("Pass --check. sync.mjs does not rewrite manifests or create a tag.");
  process.exit(2);
}

const report = versionReport(parsed.root);
if (report.drift.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    canonical: report.canonical,
    drift: report.drift,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  version: report.canonical,
  checked: report.rows.map((row) => row.path),
  unversioned: report.unversioned,
}, null, 2));
