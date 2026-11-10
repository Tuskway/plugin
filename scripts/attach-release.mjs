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
  return { ok: response.ok, status: response.status, body };
}

function githubError(result) {
  return new Error(`${result.status} ${result.body.message ?? "request failed"}`);
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
  const assetName = path.basename(zipPath);
  const found = await github(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    token,
    { method: "GET" },
  );
  let release = found.body;
  if (found.status === 404) {
    const created = await github(`https://api.github.com/repos/${repository}/releases`, token, {
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
    if (!created.ok) throw githubError(created);
    release = created.body;
  } else if (!found.ok) {
    throw githubError(found);
  }
  for (const asset of release.assets ?? []) {
    if (asset.name !== assetName) continue;
    const removed = await github(
      `https://api.github.com/repos/${repository}/releases/assets/${asset.id}`,
      token,
      { method: "DELETE" },
    );
    if (!removed.ok && removed.status !== 404) throw githubError(removed);
  }
  const uploaded = await github(
    `https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: zip,
    },
  );
  if (!uploaded.ok) throw githubError(uploaded);
  console.log(JSON.stringify({ ok: true, tag, asset: assetName }));
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
