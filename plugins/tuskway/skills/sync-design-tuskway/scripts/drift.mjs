// Deterministic drift gate. It does not write notes and it does not approve an edit.

const LINE = /^Tuskway:\s*(.+?)\s+[—–-]\s+(https?:\S+)\s*$/gm;
const UNSAFE_EDIT = [
  /ignore the (?:note|design|brief|instructions)/i,
  /\brm\s+-rf\b/i,
  /switch the (?:epic|workspace)/i,
];
const INSTRUCTION = /ignore (?:the |previous )?(?:instructions|note|design|brief)|switch (?:the )?(?:epic|workspace)|\brm\s+-rf\b|\b(?:call|run|use)\s+`?(?:ticket_update|tracker_sync|notes_write)`?|\b(?:ticket_update|tracker_sync)\b[^.\n]{0,48}\b(?:status|done)\b/i;
const SECRET_SOURCE = String.raw`(?:sk-[A-Za-z0-9][A-Za-z0-9-]{7,}|ghp_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+)`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasToken(text, token) {
  if (!token) return false;
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(token)}(?=$|[^A-Za-z0-9])`);
  return pattern.test(String(text ?? ""));
}

export function tuskwayLines(body) {
  const lines = [];
  for (const match of String(body ?? "").matchAll(LINE)) {
    lines.push({ title: match[1].trim(), url: match[2] });
  }
  return lines;
}

function decisionLine(notes, id) {
  return String(notes ?? "")
    .split("\n")
    .find((item) => hasToken(item, id) && item.includes(`${id}:`));
}

export function decisionConflict(notes, id, replacement) {
  const line = decisionLine(notes, id);
  if (!line) return false;
  const needle = `${id}:`;
  const current = line.slice(line.indexOf(needle) + needle.length).trim();
  return current.length > 0 && replacement.trim() !== current;
}

function tokensFor(ticket) {
  return [ticket?.key, ticket?.trackerKey, ticket?.trackerExternalId]
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function repoName(value) {
  const text = String(value ?? "").trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!text) return "";
  const ssh = text.match(/^git@[^:]+:(.+)$/i);
  if (ssh) return ssh[1].toLowerCase();
  const https = text.match(/^https?:\/\/[^/]+\/(.+)$/i);
  if (https) return https[1].toLowerCase();
  return text.toLowerCase();
}

function ticketRepos(ticket) {
  return [ticket?.repo, ticket?.trackerRepo].map(repoName).filter((item) => item.length > 0);
}

function repoDisagrees(ticket, pull) {
  const want = ticketRepos(ticket);
  const got = repoName(pull?.repo || pull?.baseRepo);
  if (want.length === 0 || !got) return false;
  return !want.includes(got);
}

function tokenPulls(merged, ticket) {
  const tokens = tokensFor(ticket);
  if (tokens.length === 0) return [];
  return merged.filter((pull) =>
    tokens.some((token) => hasToken(pull.branch, token) || hasToken(pull.title, token)),
  );
}

function none(extra) {
  return { matches: [], missing: [], ambiguous: [], candidates: [], ...extra };
}

export function matchPulls({ tickets, pulls, explicitNumber } = {}) {
  const merged = (pulls ?? []).filter((pull) => pull.merged === true);
  if (explicitNumber != null) {
    const named = (pulls ?? []).find((pull) => pull.number === explicitNumber);
    if (!named) return none({ missing: [{ reason: "named pull request was not in the list" }] });
    if (named.merged !== true) {
      return none({ missing: [{ number: named.number, reason: "named pull request is not merged" }] });
    }
    const lines = tuskwayLines(named.body);
    if (lines.length === 0) {
      return none({
        matches: [{ pr: named, how: "named", title: named.title }],
      });
    }
    return none({
      matches: lines.map((line) => ({ url: line.url, title: line.title, pr: named, how: "named" })),
    });
  }
  const matches = [];
  const missing = [];
  const ambiguous = [];
  const candidates = [];
  for (const ticket of tickets ?? []) {
    const linked = merged.filter((pull) =>
      tuskwayLines(pull.body).some((line) => line.url === ticket.url),
    );
    const byUrl = linked.filter((pull) => !repoDisagrees(ticket, pull));
    const otherRepo = linked.filter((pull) => repoDisagrees(ticket, pull));
    if (byUrl.length > 1) {
      ambiguous.push({
        key: ticket.key,
        url: ticket.url,
        reason: "more than one merged pull request contains the ticket url",
        numbers: byUrl.map((pull) => pull.number),
      });
      continue;
    }
    if (byUrl.length === 1) {
      matches.push({ key: ticket.key, url: ticket.url, pr: byUrl[0], how: "url" });
      continue;
    }
    if (otherRepo.length > 0) {
      candidates.push({
        key: ticket.key,
        url: ticket.url,
        reason: "pull request repo does not match the ticket repo",
        numbers: otherRepo.map((pull) => pull.number),
      });
      continue;
    }
    const byToken = tokenPulls(merged, ticket);
    if (byToken.length > 0) {
      candidates.push({
        key: ticket.key,
        url: ticket.url,
        reason: "a ticket token is not corroboration; name the pull request",
        numbers: byToken.map((pull) => pull.number),
      });
      if (byToken.length > 1) {
        ambiguous.push({
          key: ticket.key,
          url: ticket.url,
          reason: "more than one merged pull request matches the key",
          numbers: byToken.map((pull) => pull.number),
        });
      }
      continue;
    }
    missing.push({ key: ticket.key, url: ticket.url, reason: "no merged pull request" });
  }
  return { matches, missing, ambiguous, candidates };
}

function untrustedParts(input) {
  return [input.reviewText, input.commentText, input.pullBody, input.diffText]
    .filter((item) => item != null && String(item).length > 0)
    .map((item) => String(item));
}

function copiesUntrusted(edit, input) {
  if (UNSAFE_EDIT.some((pattern) => pattern.test(edit))) return true;
  const secrets = edit.match(new RegExp(SECRET_SOURCE, "gi")) ?? [];
  for (const part of untrustedParts(input)) {
    if (secrets.some((secret) => part.includes(secret))) return true;
    for (const line of part.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length < 12 || !INSTRUCTION.test(trimmed)) continue;
      if (edit.includes(trimmed)) return true;
    }
  }
  return false;
}

function pullNumber(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9]\d{0,8}$/.test(value)) return Number(value);
  return null;
}

function canWrite(input) {
  if (input.canEdit === false) return false;
  if (input.canEdit === true) return true;
  return input.role === "editor";
}

export function proposal(input) {
  const edit = input.edit;
  const shownEdit = input.shownEdit;
  const exact = input.shown === true
    && input.approved === true
    && typeof edit === "string"
    && typeof shownEdit === "string"
    && shownEdit === edit
    && edit.trim().length > 0;
  if (!exact || copiesUntrusted(edit, input)) return { writes: [] };
  const pr = pullNumber(input.prNumber);
  if (pr == null) return { writes: [] };
  const conflict = input.contradicts === true
    || (input.notes != null && input.decisionId && decisionConflict(input.notes, input.decisionId, edit));
  const attribution = `(from PR #${pr})`;
  let text;
  let path;
  let kind;
  if (conflict) {
    text = `Open question after PR #${pr}: ${edit}`;
    path = "notes.md";
    kind = "question";
  } else if (input.newDecision === true) {
    const trimmed = edit.trim();
    const ending = trimmed.match(/\(from PR #(\d+)\)\s*$/);
    if (ending && ending[1] !== String(pr)) return { writes: [] };
    text = ending ? trimmed : `${trimmed} ${attribution}`;
    if (!text.endsWith(attribution)) return { writes: [] };
    if (/\(from PR #\d+\)/.test(text.slice(0, -attribution.length))) return { writes: [] };
    path = "notes.md";
    kind = "decision";
  } else {
    text = `${edit}\n\nUpdated after PR #${pr}`;
    path = input.path;
    kind = "update";
  }
  if (copiesUntrusted(text, input)) return { writes: [] };
  if (!canWrite(input)) {
    return { writes: [{ tool: "suggest_change", path, kind, message: text }] };
  }
  if (typeof input.sha !== "string" || input.sha.length === 0) return { writes: [] };
  return {
    writes: [{
      tool: "notes_edit",
      path,
      kind,
      expectedSha256: input.sha,
      text,
    }],
  };
}
