// Deterministic drift gate. It does not write notes and it does not approve an edit.

const LINE = /^Tuskway:\s*(.+?)\s+[—–-]\s+(https?:\S+)\s*$/gm;

export function tuskwayLines(body) {
  const lines = [];
  for (const match of String(body ?? "").matchAll(LINE)) {
    lines.push({ title: match[1].trim(), url: match[2] });
  }
  return lines;
}

export function decisionConflict(notes, id, replacement) {
  const line = String(notes ?? "")
    .split("\n")
    .find((item) => item.includes(`${id}:`));
  if (!line) return false;
  const current = line.slice(line.indexOf(":") + 1).trim();
  return current.length > 0 && replacement.trim() !== current;
}

export function matchPulls({ tickets, pulls, explicitNumber }) {
  const merged = (pulls ?? []).filter((pull) => pull.merged === true);
  if (explicitNumber != null) {
    const named = (pulls ?? []).find((pull) => pull.number === explicitNumber);
    if (!named) return { matches: [], missing: [{ reason: "named pull request was not in the list" }] };
    if (named.merged !== true) {
      return { matches: [], missing: [{ number: named.number, reason: "named pull request is not merged" }] };
    }
    const lines = tuskwayLines(named.body);
    if (lines.length === 0) {
      return { matches: [], missing: [{ number: named.number, reason: "named pull request has no Tuskway line" }] };
    }
    return {
      matches: lines.map((line) => ({ url: line.url, title: line.title, pr: named, how: "named" })),
      missing: [],
    };
  }
  const matches = [];
  const missing = [];
  for (const ticket of tickets ?? []) {
    const byUrl = merged.filter((pull) =>
      tuskwayLines(pull.body).some((line) => line.url === ticket.url),
    );
    if (byUrl.length > 0) {
      for (const pull of byUrl) {
        matches.push({ key: ticket.key, url: ticket.url, pr: pull, how: "url" });
      }
      continue;
    }
    const byFallback = merged.filter(
      (pull) =>
        String(pull.branch ?? "").includes(ticket.key) ||
        String(pull.title ?? "").includes(ticket.key),
    );
    if (byFallback.length > 0) {
      for (const pull of byFallback) {
        matches.push({ key: ticket.key, url: ticket.url, pr: pull, how: "fallback" });
      }
      continue;
    }
    missing.push({ key: ticket.key, url: ticket.url, reason: "no merged pull request" });
  }
  return { matches, missing };
}

const UNTRUSTED = [/ignore the (note|design|brief)/i, /\brm\s+-rf\b/i, /switch the epic/i];

function unsafe(text) {
  return UNTRUSTED.some((pattern) => pattern.test(text));
}

export function proposal(input) {
  const review = String(input.reviewText ?? "");
  const shown = input.shown === true && String(input.edit ?? "").length > 0;
  const reviewCopied = unsafe(review) && input.edit.includes(review);
  if (!shown || input.approved !== true || unsafe(input.edit) || reviewCopied) {
    return { writes: [] };
  }
  if (input.role !== "editor") {
    return {
      writes: [{ tool: "suggest_change", path: input.path, message: input.edit }],
    };
  }
  if (!input.sha) return { writes: [] };
  if (input.contradicts === true) {
    const text = `Open question after PR #${input.prNumber}: ${input.edit}`;
    if (unsafe(text)) return { writes: [] };
    return {
      writes: [{
        tool: "notes_edit",
        path: "notes.md",
        kind: "question",
        expectedSha256: input.sha,
        text,
      }],
    };
  }
  const text = `${input.edit}\n\nUpdated after PR #${input.prNumber}`;
  if (unsafe(text)) return { writes: [] };
  return {
    writes: [{
      tool: "notes_edit",
      path: input.path,
      kind: "update",
      expectedSha256: input.sha,
      text,
    }],
  };
}
