const ROOT_ENTRIES = new Set(["plugin.json", "mcp.json", "skills", "assets"]);

function normalize(name) {
  return name.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

export function zipLayoutErrors(names) {
  const files = names.map(normalize).filter((name) => name && !name.endsWith("/"));
  const errors = [];
  for (const name of files) {
    const parts = name.split("/");
    if (parts.includes("..") || parts.includes("apps") || parts.some((part) => part.endsWith(".app.json"))) {
      errors.push(`${name} is not allowed in the ZIP`);
    }
  }

  let root = "";
  if (files.includes("plugin.json")) {
    const nested = files.filter((name) => name !== "plugin.json" && name.endsWith("/plugin.json"));
    if (nested.length > 0) errors.push("ZIP has more than one plugin root");
    for (const name of files) {
      const top = name.split("/")[0];
      if (!ROOT_ENTRIES.has(top)) errors.push(`${name} is outside the plugin root`);
    }
  } else {
    const tops = new Set(files.map((name) => name.split("/")[0]));
    if (tops.size !== 1) {
      errors.push("ZIP must contain exactly one plugin root");
      return errors;
    }
    root = `${[...tops][0]}/`;
    if (!files.includes(`${root}plugin.json`)) errors.push("ZIP plugin root is missing plugin.json");
  }

  const relative = files
    .filter((name) => (root ? name.startsWith(root) : true))
    .map((name) => (root ? name.slice(root.length) : name));
  if (!relative.includes("plugin.json")) errors.push("plugin.json is missing");
  if (!relative.includes("mcp.json")) errors.push("mcp.json is missing");
  if (!relative.some((name) => /^skills\/[^/]+\/SKILL\.md$/.test(name))) {
    errors.push("skills/ is missing a skill");
  }
  if (!relative.some((name) => name.startsWith("assets/") && name.slice("assets/".length).length > 0)) {
    errors.push("assets/ is missing");
  }
  return errors;
}
