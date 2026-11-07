import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Mock Tuskway server for fixture evals. It is not the hosted product.
// Responses are labeled by this file. Do not point it at tuskway.com.

const TOOLS = new Set([
  "epic_list",
  "epic_get",
  "epic_create",
  "notes_read",
  "notes_list",
  "notes_search",
  "notes_write",
  "notes_edit",
  "design_get",
  "ticket_list",
  "ticket_get",
  "ticket_plan",
  "ticket_draft",
  "ticket_update",
  "note_comment",
  "suggest_change",
  "tracker_changes",
  "tracker_sync",
]);

function usage() {
  return `usage: node evals/mock-tuskway.mjs --fixture DIR --state DIR --log FILE TOOL --args JSON

This is a fixture mock. It never calls https://tuskway.com.`;
}

function parseArgs(argv) {
  const out = { args: {} };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === "--fixture") out.fixture = argv[++i];
    else if (item === "--state") out.state = argv[++i];
    else if (item === "--log") out.log = argv[++i];
    else if (item === "--args") out.args = JSON.parse(argv[++i]);
    else if (!item.startsWith("--") && !out.tool) out.tool = item;
    else throw new Error(`unknown argument ${item}`);
  }
  if (!out.fixture || !out.state || !out.log || !out.tool) throw new Error(usage());
  return out;
}

function sha256(body) {
  return createHash("sha256").update(body).digest("hex");
}

function epicKey(workspace, epic) {
  return `${workspace}/${epic}`;
}

function noteUrl(workspace, epic, notePath) {
  return `https://tuskway.example/w/${workspace}/epics/${epic}/files?path=${encodeURIComponent(notePath)}`;
}

function publicEpic(epic, { phaseDetail = false } = {}) {
  const phase = phaseDetail
    ? {
        current: epic.phase.current,
        nextStep: epic.phase.nextStep,
        attention: [],
        phases: {},
      }
    : { current: epic.phase.current, nextStep: epic.phase.nextStep };
  return {
    slug: epic.slug,
    title: epic.title,
    status: epic.status,
    workspace: epic.workspace,
    trackerProvider: epic.trackerProvider,
    trackerExternalId: epic.trackerExternalId,
    trackerRepo: epic.trackerRepo,
    trackerGroup: epic.trackerGroup,
    phase,
    url: epic.url,
  };
}

function loadState(fixture, stateDir) {
  const statePath = path.join(stateDir, "state.json");
  if (existsSync(statePath)) return JSON.parse(readFileSync(statePath, "utf8"));
  const server = JSON.parse(readFileSync(path.join(fixture, "mock-server.json"), "utf8"));
  const notes = {};
  for (const [key, files] of Object.entries(server.noteFiles ?? {})) {
    notes[key] = {};
    for (const [notePath, relative] of Object.entries(files)) {
      notes[key][notePath] = readFileSync(path.join(fixture, relative), "utf8");
    }
  }
  const state = {
    policy: server.policy,
    workspaces: server.workspaces,
    epics: server.epics,
    notes,
    tickets: server.tickets ?? {},
    comments: server.comments ?? [],
    trackerChanges: server.trackerChanges ?? [],
    suggestions: [],
    planOverride: server.planOverride ?? null,
  };
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function saveState(stateDir, state) {
  writeFileSync(path.join(stateDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

function findEpic(state, workspace, epic) {
  return state.epics.find((item) => item.workspace === workspace && item.slug === epic);
}

function ticketsFor(state, workspace, epic) {
  return state.tickets[epicKey(workspace, epic)] ?? [];
}

function briefBody(ticket, epic) {
  return `---\ntitle: ${JSON.stringify(ticket.title)}\nticket: ${ticket.key}\nepic: ${epic}\n---\n\n## Goal\n\n${ticket.goal}\n\n## Scope\n\n${ticket.scope}\n\n## Acceptance criteria\n\n${ticket.acceptance}\n\n## Files\n\n${ticket.files}\n`;
}

function commentsFor(state, epic, notePath) {
  return state.comments
    .filter((comment) => comment.epic === epic && comment.path === notePath && comment.status !== "resolved")
    .map((comment) => ({
      id: comment.id,
      path: comment.path,
      startLine: comment.startLine,
      endLine: comment.endLine,
      status: comment.status,
      author: comment.author,
      body: comment.body,
      replies: comment.replies ?? [],
    }));
}

function requireFields(args, fields) {
  for (const field of fields) {
    if (args[field] === undefined || args[field] === "") {
      return { error: `missing ${field}`, mock: true };
    }
  }
  return null;
}

function indexRows(body) {
  const rows = [];
  for (const line of body.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4) continue;
    if (cells[0] === "Title" || /^-+$/.test(cells[0].replaceAll(":", ""))) continue;
    rows.push({
      title: cells[0],
      file: cells[1],
      ticket: cells[2],
      tracker: cells[3],
    });
  }
  return rows;
}

function ticketView(state, epic, ticket) {
  const notes = state.notes[epicKey(epic.workspace, epic.slug)] ?? {};
  const sectionBody = ticket.sectionPath ? notes[ticket.sectionPath] : null;
  const brief = briefBody(ticket, epic.slug);
  return {
    key: ticket.key,
    title: ticket.title,
    status: ticket.status,
    goal: ticket.goal,
    scope: ticket.scope,
    acceptance: ticket.acceptance,
    files: ticket.files,
    body: brief,
    sha: sha256(brief),
    workspace: epic.workspace,
    epic: epic.slug,
    url: noteUrl(epic.workspace, epic.slug, `tickets/${ticket.key}.md`),
    trackerProvider: epic.trackerProvider,
    trackerExternalId: epic.trackerExternalId,
    dependsOn: (ticket.dependsOn ?? []).map((key) => ({
      key,
      epic: epic.slug,
      title: key,
      status: "unknown",
    })),
    areas: ticket.areas ?? [],
    plan: {
      ready: ticket.ready === true,
      waitingOn: ticket.waitingOn ?? [],
      heldBy: ticket.heldBy ?? null,
    },
    openComments: commentsFor(state, epic.slug, ticket.sectionPath ?? `tickets/${ticket.key}.md`),
    section: ticket.sectionPath
      ? {
          title: ticket.sectionTitle,
          path: ticket.sectionPath,
          content: sectionBody,
          openComments: commentsFor(state, epic.slug, ticket.sectionPath),
        }
      : null,
    pendingTrackerChanges: { count: 0, ids: [] },
    mock: true,
  };
}

function derivePlan(state, epic) {
  const tickets = ticketsFor(state, epic.workspace, epic.slug);
  const ready = tickets
    .filter((ticket) => ticket.ready && epic.status !== "archived" && !ticket.heldBy)
    .map((ticket) => ({
      key: ticket.key,
      title: ticket.title,
      url: noteUrl(epic.workspace, epic.slug, `tickets/${ticket.key}.md`),
    }));
  const active = tickets
    .filter((ticket) => ticket.status === "in_progress")
    .map((ticket) => ({
      key: ticket.key,
      title: ticket.title,
      areas: ticket.areas ?? [],
      url: noteUrl(epic.workspace, epic.slug, `tickets/${ticket.key}.md`),
    }));
  const waiting = tickets
    .filter((ticket) => (ticket.waitingOn ?? []).length > 0)
    .map((ticket) => ({
      key: ticket.key,
      title: ticket.title,
      waitingOn: ticket.waitingOn,
      url: noteUrl(epic.workspace, epic.slug, `tickets/${ticket.key}.md`),
    }));
  const held = tickets
    .filter((ticket) => ticket.heldBy)
    .map((ticket) => ({
      key: ticket.key,
      heldBy: ticket.heldBy,
      area: (ticket.areas ?? [])[0] ?? null,
      url: noteUrl(epic.workspace, epic.slug, `tickets/${ticket.key}.md`),
    }));
  return {
    ready,
    active,
    waiting,
    waves: [{ number: 1, keys: ready.map((ticket) => ticket.key) }],
    held,
    warnings: [],
    suggestedSharedPaths: [],
    cycles: [],
    summary: `${ready.length} ready, ${waiting.length} waiting, ${active.length} active`,
    mock: true,
  };
}

function dispatch(state, tool, args) {
  const missing = (fields) => requireFields(args, fields);
  if (tool === "epic_list") {
    if (!args.workspace) return state.workspaces;
    return state.epics
      .filter((epic) => epic.workspace === args.workspace)
      .filter((epic) => args.includeArchived || epic.status !== "archived")
      .map((epic) => publicEpic(epic));
  }
  if (tool === "epic_get") {
    const error = missing(["workspace", "epic"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    return {
      ...publicEpic(epic, { phaseDetail: true }),
      permissions: epic.permissions,
      pendingTrackerChanges: { count: 0, ids: [] },
      openComments: [],
      mock: true,
    };
  }
  if (tool === "epic_create") {
    const error = missing(["workspace", "slug", "title"]);
    if (error) return error;
    if (findEpic(state, args.workspace, args.slug)) {
      return { error: "epic already exists", mock: true };
    }
    state.epics.push({
      workspace: args.workspace,
      slug: args.slug,
      title: args.title,
      status: "draft",
      trackerProvider: null,
      trackerExternalId: null,
      trackerRepo: null,
      trackerGroup: null,
      permissions: {
        canRead: true,
        canEdit: true,
        canSuggest: true,
        canManageInbox: true,
        isLead: true,
        canArchive: true,
        canShare: true,
      },
      phase: { current: "discovery", nextStep: "Write intake notes" },
      url: `https://tuskway.example/w/${args.workspace}/epics/${args.slug}`,
    });
    state.notes[epicKey(args.workspace, args.slug)] = {
      "notes.md": `# ${args.title}\n`,
      "tech-design/INDEX.md": "| Title | File | Ticket | Tracker |\n|---|---|---|---|\n",
    };
    state.tickets[epicKey(args.workspace, args.slug)] = [];
    return { slug: args.slug, title: args.title, mock: true };
  }
  if (tool === "notes_list") {
    const error = missing(["workspace", "epic"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (epic.status === "archived" && !args.includeArchived) {
      return { error: "archived epic omitted", mock: true };
    }
    const notes = state.notes[epicKey(args.workspace, args.epic)] ?? {};
    return Object.keys(notes)
      .filter((notePath) => !args.prefix || notePath.startsWith(args.prefix))
      .map((notePath) => ({
        path: notePath,
        openCommentCount: commentsFor(state, args.epic, notePath).length,
      }));
  }
  if (tool === "notes_read") {
    const error = missing(["workspace", "epic", "path"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    const notes = state.notes[epicKey(args.workspace, args.epic)] ?? {};
    let body = notes[args.path];
    if (body === undefined && args.path.startsWith("tickets/")) {
      const key = path.basename(args.path, ".md");
      const ticket = ticketsFor(state, args.workspace, args.epic).find((item) => item.key === key);
      if (ticket) body = briefBody(ticket, args.epic);
    }
    if (body === undefined) return { error: "note not found", path: args.path, mock: true };
    return {
      path: args.path,
      body,
      sha256: sha256(body),
      revision: 1,
      openComments: commentsFor(state, args.epic, args.path),
      url: noteUrl(args.workspace, args.epic, args.path),
      mock: true,
    };
  }
  if (tool === "notes_search") {
    const error = missing(["workspace", "epic", "query"]);
    if (error) return error;
    const notes = state.notes[epicKey(args.workspace, args.epic)] ?? {};
    const words = args.query.split(/\s+/).filter(Boolean).map((word) => word.toLowerCase());
    const matches = [];
    for (const [notePath, body] of Object.entries(notes)) {
      if (args.pathPrefix && !notePath.startsWith(args.pathPrefix)) continue;
      const lines = body.split("\n");
      const hits = [];
      lines.forEach((line, index) => {
        const lower = line.toLowerCase();
        if (words.some((word) => lower.includes(word))) hits.push({ line: index + 1, text: line });
      });
      if (hits.length > 0) matches.push({ path: notePath, hits });
    }
    return { matches, boostTicket: args.boostTicket ?? null, mock: true };
  }
  if (tool === "notes_write") {
    const error = missing(["workspace", "epic", "path", "body"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (epic.status === "archived" || !epic.permissions.canEdit) {
      return { error: "write refused", mock: true };
    }
    const notes = (state.notes[epicKey(args.workspace, args.epic)] ??= {});
    if (args.expectedSha256 && notes[args.path] !== undefined && sha256(notes[args.path]) !== args.expectedSha256) {
      return { error: "stale sha256", mock: true };
    }
    notes[args.path] = args.body;
    return {
      path: args.path,
      sha256: sha256(args.body),
      url: noteUrl(args.workspace, args.epic, args.path),
      mock: true,
    };
  }
  if (tool === "notes_edit") {
    const error = missing(["workspace", "epic", "path", "oldString", "newString", "expectedSha256"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (epic.status === "archived" || !epic.permissions.canEdit) {
      return { error: "edit refused", mock: true };
    }
    const notes = state.notes[epicKey(args.workspace, args.epic)] ?? {};
    const body = notes[args.path];
    if (body === undefined) return { error: "note not found", mock: true };
    if (sha256(body) !== args.expectedSha256) return { error: "stale sha256", mock: true };
    const count = body.split(args.oldString).length - 1;
    if (count === 0) return { error: "oldString not found", mock: true };
    if (count > 1 && !args.replaceAll) return { error: "oldString matched more than once", mock: true };
    const next = args.replaceAll
      ? body.replaceAll(args.oldString, args.newString)
      : body.replace(args.oldString, args.newString);
    notes[args.path] = next;
    return { path: args.path, sha256: sha256(next), mock: true };
  }
  if (tool === "design_get") {
    const error = missing(["workspace", "epic"]);
    if (error) return error;
    const notes = state.notes[epicKey(args.workspace, args.epic)] ?? {};
    const index = notes["tech-design/INDEX.md"];
    if (index === undefined) return { sections: [], warning: "INDEX.md missing", mock: true };
    return { sections: indexRows(index), mock: true };
  }
  if (tool === "ticket_list") {
    const error = missing(["workspace", "epic"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (epic.status === "archived" && !args.includeArchived) return [];
    return ticketsFor(state, args.workspace, args.epic)
      .filter((ticket) => !args.status || ticket.status === args.status)
      .filter((ticket) => args.ready !== true || ticket.ready === true)
      .map((ticket) => ({
        key: ticket.key,
        title: ticket.title,
        status: ticket.status,
        ready: ticket.ready === true,
        dependsOn: ticket.dependsOn ?? [],
        areas: ticket.areas ?? [],
        url: noteUrl(args.workspace, args.epic, `tickets/${ticket.key}.md`),
        openCommentCount: commentsFor(state, args.epic, ticket.sectionPath ?? "").length,
      }));
  }
  if (tool === "ticket_get") {
    const error = missing(["workspace", "epic", "key"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    const ticket = ticketsFor(state, args.workspace, args.epic).find((item) => item.key === args.key);
    if (!ticket) return { error: "ticket not found", mock: true };
    return ticketView(state, epic, ticket);
  }
  if (tool === "ticket_plan") {
    const error = missing(["workspace", "epic"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    return derivePlan(state, epic);
  }
  if (tool === "ticket_update") {
    const error = missing(["workspace", "epic", "key", "status"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (epic.status === "archived" || !epic.permissions.canEdit) {
      return { error: "status change refused", mock: true };
    }
    const allowed = state.policy.ticketUpdateStatuses;
    if (allowed && !allowed.includes(args.status)) {
      return { error: `status ${args.status} refused by fixture policy`, mock: true };
    }
    const ticket = ticketsFor(state, args.workspace, args.epic).find((item) => item.key === args.key);
    if (!ticket) return { error: "ticket not found", mock: true };
    ticket.status = args.status;
    if (args.status === "in_progress") ticket.ready = false;
    return {
      key: ticket.key,
      status: ticket.status,
      url: noteUrl(args.workspace, args.epic, `tickets/${ticket.key}.md`),
      mock: true,
    };
  }
  if (tool === "ticket_draft") {
    const error = missing(["workspace", "epic", "key", "title"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic || epic.status === "archived" || !epic.permissions.canEdit) {
      return { error: "draft refused", mock: true };
    }
    const list = (state.tickets[epicKey(args.workspace, args.epic)] ??= []);
    const existing = list.find((item) => item.key === args.key);
    const next = existing ?? {
      key: args.key,
      status: "todo",
      ready: false,
      waitingOn: [],
      heldBy: null,
    };
    next.title = args.title;
    next.goal = args.goal ?? next.goal ?? "";
    next.scope = args.scope ?? next.scope ?? "";
    next.acceptance = args.acceptance ?? next.acceptance ?? "";
    next.files = args.files ?? next.files ?? "";
    if (args.dependsOn) next.dependsOn = args.dependsOn;
    if (args.areas) next.areas = args.areas;
    if (!existing) list.push(next);
    return { key: next.key, path: `tickets/${next.key}.md`, mock: true };
  }
  if (tool === "note_comment") {
    const error = missing(["workspace", "epic", "action"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (args.action === "list") {
      return state.comments.filter((comment) => comment.epic === args.epic);
    }
    if (args.action === "resolve") {
      if (!epic.permissions.canManageInbox || epic.status === "archived") {
        return { error: "resolve refused", mock: true };
      }
      const comment = state.comments.find((item) => item.id === args.id);
      if (!comment) return { error: "comment not found", mock: true };
      comment.status = "resolved";
      comment.resolutionNote = args.resolutionNote ?? "";
      return { id: comment.id, status: comment.status, mock: true };
    }
    return { error: `unsupported comment action ${args.action}`, mock: true };
  }
  if (tool === "suggest_change") {
    const error = missing(["workspace", "epic", "path", "message"]);
    if (error) return error;
    const epic = findEpic(state, args.workspace, args.epic);
    if (!epic) return { error: "epic not found", mock: true };
    if (epic.status === "archived" || !epic.permissions.canSuggest) {
      return { error: "suggest refused", mock: true };
    }
    state.suggestions.push({
      path: args.path,
      message: args.message,
      proposedBody: args.proposedBody ?? null,
    });
    return { path: args.path, status: "suggested", mock: true };
  }
  if (tool === "tracker_changes") {
    const error = missing(["workspace", "epic", "action"]);
    if (error) return error;
    if (args.action === "list") {
      return state.trackerChanges.filter((change) => !args.status || change.status === args.status);
    }
    if (args.action === "get") {
      const change = state.trackerChanges.find((item) => item.id === args.id);
      if (!change) return { error: "tracker change not found", mock: true };
      return { ...change, mock: true };
    }
    if (args.action === "resolve") {
      const epic = findEpic(state, args.workspace, args.epic);
      if (!epic || !epic.permissions.canManageInbox || epic.status === "archived") {
        return { error: "resolve refused", mock: true };
      }
      const change = state.trackerChanges.find((item) => item.id === args.id);
      if (!change) return { error: "tracker change not found", mock: true };
      if (change.status !== "pending") return { error: "tracker change is not pending", mock: true };
      change.status = args.outcome;
      change.resolutionNote = args.resolutionNote ?? "";
      return { id: change.id, status: change.status, mock: true };
    }
    return { error: `unsupported tracker action ${args.action}`, mock: true };
  }
  if (tool === "tracker_sync") {
    return { error: "publish is not authorized by this fixture", mock: true };
  }
  return { error: `unhandled tool ${tool}`, mock: true };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!TOOLS.has(parsed.tool)) {
    console.error(`unknown tool ${parsed.tool}`);
    process.exit(1);
  }
  const state = loadState(path.resolve(parsed.fixture), path.resolve(parsed.state));
  const allowed = new Set(state.policy?.allow ?? []);
  const refused = !allowed.has(parsed.tool);
  let result;
  if (refused) {
    result = { error: "fixture policy refused this tool", tool: parsed.tool, mock: true };
  } else if (parsed.tool === "epic_list" && state.policy?.epicListError) {
    result = { error: state.policy.epicListError, mock: true };
  } else if (parsed.tool === "ticket_plan" && state.planOverride) {
    result = { ...state.planOverride, mock: true };
  } else {
    result = dispatch(state, parsed.tool, parsed.args);
  }
  if (!refused) saveState(path.resolve(parsed.state), state);
  mkdirSync(path.dirname(path.resolve(parsed.log)), { recursive: true });
  appendFileSync(
    path.resolve(parsed.log),
    `${JSON.stringify({
      at: new Date().toISOString(),
      tool: parsed.tool,
      args: parsed.args,
      refused,
      error: result.error ?? null,
    })}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
}

main();
