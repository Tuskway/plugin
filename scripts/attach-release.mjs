import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultZipPath } from "./build-openai-zip.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function releaseTagError(tag, version) {
  if (tag !== `v${version}`) return `tag ${tag} does not match manifest version v${version}`;
  return null;
}

async function github(url, token, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: "response was not json" };
    }
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${body.message ?? "request failed"}`);
  }
  return body;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const tag = process.env.GITHUB_REF_NAME;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) {
    console.error("GITHUB_TOKEN is missing");
    process.exit(1);
  }
  if (!tag || !repository) {
    console.error("GITHUB_REF_NAME and GITHUB_REPOSITORY are required");
    process.exit(1);
  }
  const plugin = JSON.parse(readFileSync(path.join(repoRoot, "plugins/tuskway/plugin.json"), "utf8"));
  const mismatch = releaseTagError(tag, plugin.version);
  if (mismatch) {
    console.error(mismatch);
    process.exit(1);
  }
  const zipPath = defaultZipPath(repoRoot, plugin.version);
  const zip = readFileSync(zipPath);
  const notes = plugin.extensions?.["com.openai"]?.publication?.release_notes ?? "";
  const release = await github(`https://api.github.com/repos/${repository}/releases`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: notes,
      draft: false,
      prerelease: false,
    }),
  });
  const assetName = path.basename(zipPath);
  await github(
    `https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: zip,
    },
  );
  console.log(JSON.stringify({ ok: true, tag, asset: assetName }));
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await main();
}
