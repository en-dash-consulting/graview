#!/usr/bin/env node
/**
 * THE NOTION CONNECTION, AGAINST NOTION ITSELF.
 *
 * `@graview/core/sync` is covered against a scripted Notion; this runs a
 * declared connection (`connections.<name>` with `system: "notion"`) against
 * a real workspace and writes what happened to docs/notion.json as named
 * claims: a page made in Notion arriving with every property type, a record
 * made here becoming a page, our own write not echoed back, an edit each way,
 * a conflict held, long words in 2000-character pieces, every page of a query
 * followed, Notion's rate limit waited out, a refused secret and an unshared
 * database said as sentences, a whole read that loses and duplicates
 * nothing, an archive each way, the secret kept nowhere, two tables joined
 * by a dual relation kept as links both ways and converging with nothing
 * sent, a table whose kind other acts make and write — a page landing
 * through the act that fits it, a status a named step moves changed in
 * Notion, a blank row said once and arriving once filled — a record set
 * aside here keeping its page (what changes there landing, the same page's
 * when brought back, made again once when the page was deleted meanwhile,
 * and only a removal deleting), what Notion does with a page in the trash
 * inside a relation — and everything the run made archived again.
 *
 * WHAT TO SET UP, ONCE:
 *
 *   1. An internal integration: notion.so/profile/integrations → New
 *      integration, type Internal, in the test workspace. Under
 *      Capabilities tick Read content, Update content and Insert content
 *      (user information is optional: without it, people are read by id).
 *      Copy its Internal Integration Secret.
 *   2. A page for the harness to work in (an empty "Graview harness" page
 *      is best), shared with the integration: the page's ••• menu →
 *      Connections → add the integration.
 *   3. ~/.graview-notion-test.env (or the file GRAVIEW_NOTION_ENV names),
 *      chmod 600, holding
 *        NOTION_TOKEN=<the Internal Integration Secret>
 *        NOTION_PARENT_PAGE_ID=<the page's id: the 32 characters at the end of its link>
 *
 * The harness makes its own database inside that page each run — "Graview
 * harness <run id>", with a title, rich text, number, select, multi-select,
 * two dates, checkbox, URL, email, phone, people and formula property — so
 * nobody has to build one by hand, and archives it at the end. For the
 * relations it makes two more, "Graview harness <run id> fleet" and
 * "… checks", the second's relation dual to the first, and trashes both;
 * for the records set aside, "… things" and "… notes", trashed the same way.
 * Every page it makes carries the run id in its title, and only those are
 * touched.
 *
 * It needs credentials, so it is NOT in `pnpm verify` or CI; the file is
 * read through scripts/lib/notion-test-env.mjs, which never prints a value.
 * `--stub` runs every claim against the scripted Notion instead (no
 * credentials, nothing reached) and writes docs/notion-stub.json, so the
 * claims are proven wired before a workspace is. Needs `pnpm build`.
 *
 *   node scripts/verify-notion.mjs            against Notion
 *   node scripts/verify-notion.mjs --stub     against the scripted Notion
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../packages/core/dist/index.js";
import { compileDocument } from "../packages/core/dist/check.js";
import { NOTION_API, NOTION_VERSION, connection, notion, notionProperty, scriptedNotion, sharedLinks } from "../packages/core/dist/sync/index.js";
import { requireNotionEnv } from "./lib/notion-test-env.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stubbed = process.argv.includes("--stub");
const run = `gv-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const report = { at: new Date().toISOString(), run, mode: stubbed ? "stub" : "live", checks: {} };
const claim = (name, ok, said = {}) => {
  report.checks[name] = { ...said, ok: Boolean(ok) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"}  ${name}\n`);
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* --------------------------------------------- Notion, or the scripted one */
const stub = stubbed ? scriptedNotion() : undefined;
const env = stubbed ? { NOTION_TOKEN: stub.secret, NOTION_PARENT_PAGE_ID: "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f" } : requireNotionEnv(["NOTION_TOKEN", "NOTION_PARENT_PAGE_ID"]);
const secret = env.NOTION_TOKEN;
const parent = (/([0-9a-f]{32})(?:[?#].*)?$/i.exec(env.NOTION_PARENT_PAGE_ID.replace(/-/g, "")) ?? [])[1];
if (!parent) throw new Error("NOTION_PARENT_PAGE_ID is not a page's id: the 32 characters at the end of the page's link.");
const fetched = stub ? stub.fetch : (url, init) => fetch(url, init);
/** Notion's index of a database lags a write by a moment; the stub's does not. */
const settle = () => (stubbed ? Promise.resolve() : sleep(3000));

/** Notion, as another person in the workspace. Refusals throw, with Notion's own words and never the secret. */
async function api(method, path, body) {
  for (;;) {
    const response = await fetched(`${NOTION_API}${path}`, {
      method,
      headers: { authorization: `Bearer ${secret}`, "notion-version": NOTION_VERSION, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 429) {
      await sleep(Number(response.headers?.get("retry-after") ?? 1) * 1000);
      continue;
    }
    const answer = await response.json();
    if (!response.ok) throw new Error(`Notion answered ${response.status} to ${method} ${path.replace(/[0-9a-f-]{32,36}/g, "<id>")}: ${answer.code ?? ""} ${answer.message ?? ""}`);
    return answer;
  }
}
const textOf = (page, name) => {
  const property = page.properties[name];
  const value = property[property.type];
  return Array.isArray(value) ? value.map((part) => part.plain_text ?? part.name ?? "").join("") : value;
};

/* -------------------------------------------------- the app, declared */
const PROPERTIES = { name: "Name", notes: "Notes", estimate: "Estimate", stage: "Stage", tags: "Tags", due: "Due", at: "At", finished: "Done", link: "Link", email: "Email", phone: "Phone", owner: "Owner" };
const document = (databaseId) => ({
  format: "graview-document",
  formatVersion: 1,
  name: `Notion harness ${run}`,
  kinds: {
    task: {
      fields: {
        name: { type: "string", required: true },
        notes: { type: "text" },
        estimate: { type: "number" },
        stage: { type: "enum", options: ["to-do", "in-progress", "done"] },
        tags: { type: "list", of: "string" },
        due: { type: "date" },
        at: { type: "datetime" },
        finished: { type: "boolean" },
        link: { type: "url" },
        email: { type: "email" },
        phone: { type: "phone" },
        owner: { type: "string" },
      },
    },
  },
  acts: { "add-task": { creates: "task" } },
  connections: { harness: { system: "notion", database: databaseId, kind: "task", properties: PROPERTIES, direction: "both" } },
});

let databaseId;
/** The two tables the relation claims make, trashed whatever happens. */
const linkedTables = [];
try {
  /* ------------------------------------------------ its own database */
  const made = await api("POST", "/databases", {
    parent: { type: "page_id", page_id: parent },
    title: [{ type: "text", text: { content: `Graview harness ${run}` } }],
    initial_data_source: { properties: {
      Name: { title: {} },
      Notes: { rich_text: {} },
      Estimate: { number: { format: "number" } },
      Stage: { select: { options: [{ name: "To do" }, { name: "In progress" }, { name: "Done" }] } },
      Tags: { multi_select: { options: [] } },
      Due: { date: {} },
      At: { date: {} },
      Done: { checkbox: {} },
      Link: { url: {} },
      Email: { email: {} },
      Phone: { phone_number: {} },
      Owner: { people: {} },
      Twice: { formula: { expression: 'prop("Estimate") * 2' } },
    } },
  });
  databaseId = made.id;
  const sourceId = made.data_sources[0].id;

  const compiled = compileDocument(document(databaseId));
  if (!compiled.ok) throw new Error(`the harness's own declaration does not check: ${compiled.findings.map((finding) => finding.message).join("; ")}`);
  const app = compiled.app;
  const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const said = [];
  const open = (state) =>
    connection({ name: "harness", declaration: app.connections.harness, app, store, databaseId, token: () => secret, secretName: "NOTION_TOKEN", fetch: fetched, say: (line) => said.push(line), ...(state ? { state } : {}) });
  let engine = open().engine;
  const as = { author: { kind: "human", id: "harness" }, intent: "by hand" };
  const act = (name, args) => store.apply({ name, args }, as);
  const tasks = () => store.graph.allNodes().filter((node) => node.kind === "task");
  const task = (id) => store.graph.getNode(id);
  /** Passes until `check` holds or the tries run out: Notion's query catches up with a write within seconds. */
  const until = async (check, tries = stubbed ? 1 : 6) => {
    let last;
    for (let at = 0; at < tries; at++) {
      if (at > 0) await settle();
      last = await engine.run();
      if (check(last)) return last;
    }
    return last;
  };
  /** A whole read, as a host that lost its cursor would make: a new engine from what was kept, without the cursor. */
  const whole = () => {
    const { cursor: _cursor, ...kept } = engine.snapshot;
    engine = open(kept).engine;
  };

  /* --------------------------------------------------------- the claims */
  const first = await engine.run();
  claim("theFirstRunReadsTheDatabaseAndSendsNothing", !first.offline && first.applied.length === 0 && first.pushed.length === 0, { offline: first.offline, problem: first.problem ?? null });

  const theirs = await api("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: sourceId },
    properties: {
      Name: notionProperty("title", `Paint the fence ${run}`),
      Notes: notionProperty("rich_text", "Two coats"),
      Estimate: notionProperty("number", 3.5),
      Stage: notionProperty("select", "In progress"),
      Tags: notionProperty("multi_select", ["home", "garden"]),
      Due: notionProperty("date", "2026-11-02"),
      At: notionProperty("date", "2026-11-02T10:00:00.000+02:00"),
      Done: notionProperty("checkbox", true),
      Link: notionProperty("url", "https://example.com/fence"),
      Email: notionProperty("email", "pat@example.com"),
      Phone: notionProperty("phone_number", "+1 555 0100"),
    },
  });
  await settle();
  const arrived = await until(() => tasks().length === 1);
  const fence = tasks()[0];
  const expected = { name: `Paint the fence ${run}`, notes: "Two coats", estimate: 3.5, stage: "in-progress", tags: ["home", "garden"], due: "2026-11-02", at: "2026-11-02T08:00:00Z", finished: true, link: "https://example.com/fence", email: "pat@example.com", phone: "+1 555 0100" };
  const wrong = fence ? Object.entries(expected).filter(([field, value]) => JSON.stringify(fence[field]) !== JSON.stringify(value)).map(([field]) => field) : Object.keys(expected);
  claim("aPageMadeInNotionArrivesWithEveryPropertyType", arrived.applied.length === 1 && wrong.length === 0 && store.log.all().at(-1).author.id === "notion", { wrongFields: wrong });
  claim("aFormulaIsLeftAloneAndSaidOnce", said.filter((line) => line.startsWith("left alone in Notion") && line.includes("Twice (formula")).length === 1, { said: said.filter((line) => line.startsWith("left alone")) });

  act("add-task", { id: "task:mine", name: `Made here ${run}`, stage: "to-do", tags: ["home"], due: "2026-11-03", finished: false });
  const sent = await engine.run();
  const mineId = engine.snapshot.links["task:mine"]?.id;
  const mineThere = mineId ? await api("GET", `/pages/${mineId}`) : undefined;
  claim("aRecordMadeHereBecomesAPage", sent.pushed.includes("task:mine") && mineThere && textOf(mineThere, "Name") === `Made here ${run}` && mineThere.properties.Stage.select?.name === "To do", { pushed: sent.pushed.length, stage: mineThere?.properties.Stage.select?.name ?? null });

  await settle();
  const echo = await engine.run();
  claim("ourOwnWriteIsNotTakenBackAsNews", echo.applied.length === 0 && !echo.offline, { echoes: echo.echoes.length, applied: echo.applied.length });

  await api("PATCH", `/pages/${theirs.id}`, { properties: { Estimate: notionProperty("number", 5), Stage: notionProperty("select", "Done") } });
  await settle();
  const fenceId = fence?.id;
  const edited = await until(() => task(fenceId)?.estimate === 5);
  claim("anEditInNotionArrives", task(fenceId)?.estimate === 5 && task(fenceId)?.stage === "done", { applied: edited.applied.length });

  act("edit-task", { id: "task:mine", notes: "Edited here", finished: true });
  await engine.run();
  const mineAfter = await api("GET", `/pages/${mineId}`);
  claim("anEditHereIsSent", textOf(mineAfter, "Notes") === "Edited here" && mineAfter.properties.Done.checkbox === true, {});

  await settle();
  await engine.run();
  await api("PATCH", `/pages/${mineId}`, { properties: { Notes: notionProperty("rich_text", "Theirs") } });
  act("edit-task", { id: "task:mine", notes: "Ours" });
  await settle();
  const held = await until((one) => one.conflicts.length > 0);
  const mineHeld = await api("GET", `/pages/${mineId}`);
  claim("aFieldBothSidesChangedIsHeld", held.conflicts.some((one) => one.localId === "task:mine" && one.field === "notes") && task("task:mine").notes === "Ours" && textOf(mineHeld, "Notes") === "Theirs", { conflicts: held.conflicts.map((one) => one.field) });
  act("edit-task", { id: "task:mine", notes: "Theirs" });
  await engine.run();

  const long = `${"a".repeat(1999)}😀${"b".repeat(2500)} ${run}`;
  act("add-task", { id: "task:long", name: `Long ${run}`, notes: long });
  const longSent = await engine.run();
  const longId = engine.snapshot.links["task:long"]?.id;
  const longThere = longId ? await api("GET", `/pages/${longId}`) : undefined;
  claim("longWordsGoInPiecesAndComeBackWhole", longSent.refused.length === 0 && longThere && textOf(longThere, "Notes") === long, { pieces: longThere?.properties.Notes.rich_text.map((piece) => piece.plain_text.length) ?? null, refused: longSent.refused.map((one) => one.error) });

  for (let n = 1; n <= 5; n++) await api("POST", "/pages", { parent: { type: "data_source_id", data_source_id: sourceId }, properties: { Name: notionProperty("title", `Page ${n} ${run}`) } });
  await settle();
  const paged = notion({ databaseId, token: () => secret, fetch: fetched, pageSize: 2 });
  let pulled = await paged.pull(undefined);
  for (let tries = 1; !stubbed && tries < 6 && pulled.changes.length < 8; tries++) {
    await settle();
    pulled = await paged.pull(undefined);
  }
  const queries = stub ? stub.requests.filter((request) => request.path.endsWith("/query") && request.body?.page_size === 2).length : undefined;
  claim("everyPageOfAQueryIsFollowed", pulled.changes.length === 8, { pages: pulled.changes.length, ...(queries !== undefined ? { queries } : {}) });
  await until(() => tasks().length === 8);

  let limited = 0;
  const waits = [];
  const once429 = async (url, init) => {
    if (limited < 1) {
      limited += 1;
      return { ok: false, status: 429, json: async () => ({ object: "error", status: 429, code: "rate_limited" }), headers: { get: (name) => (name.toLowerCase() === "retry-after" ? "1" : null) } };
    }
    return fetched(url, init);
  };
  const patient = notion({ databaseId, token: () => secret, fetch: once429, sleep: async (ms) => { waits.push(ms); await sleep(ms); } });
  const afterLimit = await patient.pull(undefined);
  claim("notionsRateLimitIsWaitedOutAsRetryAfterSays", waits.join() === "1000" && afterLimit.changes.length >= 8, { waits });

  const refused = await notion({ databaseId, token: () => "secret_NotTheOneNotionTakes000000000000", secretName: "NOTION_TOKEN", fetch: fetched }).pull(undefined).then(() => "", (error) => error.message);
  claim("aSecretNotionRefusesIsSaidByItsName", /Notion refused NOTION_TOKEN \(HTTP 401\)/.test(refused) && !refused.includes(secret), { said: refused });

  const unshared = await notion({ databaseId: "0123456789abcdef0123456789abcdef", token: () => secret, fetch: fetched }).pull(undefined).then(() => "", (error) => error.message);
  claim("aDatabaseTheIntegrationCannotSeeIsSaidAsOneToShare", /share the database with the integration/.test(unshared), { said: unshared });

  const before = tasks().length;
  whole();
  const resynced = await engine.run();
  claim("aWholeReadLosesAndDuplicatesNothing", resynced.applied.length === 0 && resynced.pushed.length === 0 && resynced.gone.length === 0 && tasks().length === before, { applied: resynced.applied.length, pushed: resynced.pushed.length, gone: resynced.gone.length, records: tasks().length });

  await api("PATCH", `/pages/${theirs.id}`, { in_trash: true });
  await settle();
  let goneThere;
  for (let tries = 0; tries < (stubbed ? 1 : 6); tries++) {
    if (tries > 0) await settle();
    whole();
    goneThere = await engine.run();
    if (!task(fenceId)) break;
  }
  claim("aPageArchivedInNotionIsGoneHere", !task(fenceId) && goneThere.gone.includes(fenceId), { gone: goneThere.gone.length });

  act("remove-task", { id: "task:long" });
  const removed = await engine.run();
  const longAfter = await api("GET", `/pages/${longId}`);
  claim("aRecordRemovedHereIsArchivedInNotion", removed.pushed.includes("task:long") && longAfter.in_trash === true, { inTrash: longAfter.in_trash });

  const kept = JSON.stringify([store.log.all(), store.graph.allNodes(), engine.snapshot, said]);
  claim("theSecretIsKeptNowhere", !kept.includes(secret), {});

  /* ---------------------------------------------- everything it made, archived */
  for (const one of tasks()) act("remove-task", { id: one.id });
  const removedAll = await engine.run();

  /* ------------------------------------ a database of several data sources */
  // Notion's tables under one name: a second source in the run's database. A
  // connection that names none is told which there are; one that names the
  // second, by its name, reads its pages and none of the first's.
  const second = await api("POST", "/data_sources", {
    parent: { type: "database_id", database_id: databaseId },
    title: [{ type: "text", text: { content: "Health checks" } }],
    properties: { Name: { title: {} }, Vet: { rich_text: {} } },
  });
  await api("POST", "/pages", { parent: { type: "data_source_id", data_source_id: second.id }, properties: { Name: notionProperty("title", `Comet ${run}`) } });
  await settle();
  // A connection already running keeps the source it found; one opened now finds two.
  const unnamed = await open(engine.snapshot).engine.run();
  claim("aDatabaseOfSeveralSourcesSaysThemToAConnectionThatNamesNone", unnamed.offline && /holds 2 data sources — .*Health checks — so the connection says which with source/.test(unnamed.problem ?? ""), { said: unnamed.problem ?? null });
  const checks = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: `Notion harness checks ${run}`,
    kinds: { check: { fields: { name: { type: "string", required: true }, vet: { type: "string" } } } },
    acts: { "add-check": { creates: "check" } },
    connections: { checks: { system: "notion", database: databaseId, source: "Health checks", kind: "check", properties: { name: "Name", vet: "Vet" }, direction: "read" } },
  });
  if (!checks.ok) throw new Error(`the harness's second declaration does not check: ${checks.findings.map((finding) => finding.message).join("; ")}`);
  const checksStore = new Store({ schema: checks.app.schema, mutations: checks.app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const named = await connection({ name: "checks", declaration: checks.app.connections.checks, app: checks.app, store: checksStore, databaseId, token: () => secret, fetch: fetched }).engine.run();
  const read = checksStore.graph.allNodes().map((node) => node.name);
  claim("aDatabaseOfSeveralSourcesIsReadThroughTheOneItNames", !named.offline && read.length === 1 && read[0] === `Comet ${run}`, { read, problem: named.problem ?? null });

  /* ------------------------------ two tables joined by a dual relation */
  // A fleet and its health checks, each a database of its own under the page; the checks' relation to the fleet is dual, so Notion keeps a twin on the fleet's side.
  const table = async (suffix, properties) => {
    const one = await api("POST", "/databases", { parent: { type: "page_id", page_id: parent }, title: [{ type: "text", text: { content: `Graview harness ${run} ${suffix}` } }], initial_data_source: { properties } });
    linkedTables.push(one.id);
    return one;
  };
  const fleetTable = await table("fleet", { Name: { title: {} } });
  const fleetSource = fleetTable.data_sources[0].id;
  const checksTable = await table("checks", { Name: { title: {} }, Reindeer: { relation: { data_source_id: fleetSource, type: "dual_property", dual_property: {} } } });
  const checksSource = checksTable.data_sources[0].id;
  // The twin's name is Notion's to give: read it from the fleet's side.
  const fleetProperties = (await api("GET", `/data_sources/${fleetSource}`)).properties;
  const twin = Object.values(fleetProperties).find((property) => property.type === "relation")?.name;
  const relationDeclared = (await api("GET", `/data_sources/${checksSource}`)).properties.Reindeer?.relation?.type;
  claim("aDualRelationIsMadeBetweenTwoTables", Boolean(twin) && relationDeclared === "dual_property", { twin: twin ?? null, type: relationDeclared ?? null });

  const linkedApp = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: `Notion harness relations ${run}`,
    kinds: {
      reindeer: { fields: { name: { type: "string", required: true } }, edges: { checks: { to: ["check"] } } },
      check: { fields: { name: { type: "string", required: true } }, edges: { reindeer: { to: ["reindeer"], cardinality: "one" } } },
    },
    acts: { "add-reindeer": { creates: "reindeer" }, "add-check": { creates: "check" } },
    connections: {
      checks: { system: "notion", database: checksTable.id, kind: "check", properties: { name: "Name", reindeer: "Reindeer" }, direction: "both" },
      fleet: { system: "notion", database: fleetTable.id, kind: "reindeer", properties: { name: "Name", checks: twin ?? "Checks" }, direction: "both" },
    },
  });
  if (!linkedApp.ok) throw new Error(`the harness's relation declaration does not check: ${linkedApp.findings.map((finding) => finding.message).join("; ")}`);
  const herd = new Store({ schema: linkedApp.app.schema, mutations: linkedApp.app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const links = sharedLinks();
  const linkedSaid = [];
  const engines = ["checks", "fleet"].map((name) =>
    connection({ name, declaration: linkedApp.app.connections[name], app: linkedApp.app, store: herd, databaseId: linkedApp.app.connections[name].database, token: () => secret, fetch: fetched, links, say: (line) => linkedSaid.push(`${name}: ${line}`) }).engine,
  );
  /** One pass of both, the checks first, then what each held linked, as `graview serve` runs them. */
  const both = async () => {
    const reports = [];
    for (const one of engines) reports.push(await one.run());
    for (const one of engines) one.resolveHeld();
    return reports;
  };
  const untilBoth = async (check, tries = stubbed ? 2 : 8) => {
    let last;
    for (let at = 0; at < tries; at++) {
      if (at > 0) await settle();
      last = await both();
      if (check(last)) return last;
    }
    return last;
  };
  const inHerd = (kind, name) => herd.graph.allNodes().find((node) => node.kind === kind && node.name === name)?.id;
  const out = (from, edge) => (from ? herd.graph.out(from, edge).map((node) => node.id) : []);
  const relationOf = async (pageId, property) => ((await api("GET", `/pages/${pageId}`)).properties[property]?.relation ?? []).map((one) => one.id);
  const quietly = (reports) => reports.every((one) => !one.offline && one.pushed.length === 0 && one.applied.length === 0 && one.refused.length === 0);

  const comet = await api("POST", "/pages", { parent: { type: "data_source_id", data_source_id: fleetSource }, properties: { Name: notionProperty("title", `Comet ${run}`) } });
  const hooves = await api("POST", "/pages", { parent: { type: "data_source_id", data_source_id: checksSource }, properties: { Name: notionProperty("title", `Hooves ${run}`), Reindeer: notionProperty("relation", [comet.id]) } });
  await settle();
  const arrivedLinks = await untilBoth(() => out(inHerd("check", `Hooves ${run}`), "reindeer").length === 1 && out(inHerd("reindeer", `Comet ${run}`), "checks").length === 1);
  const hoovesId = inHerd("check", `Hooves ${run}`);
  const cometId = inHerd("reindeer", `Comet ${run}`);
  claim(
    "aLinkMadeInNotionArrivesAsALinkOnBothSides",
    out(hoovesId, "reindeer").join() === (cometId ?? "-") && out(cometId, "checks").join() === (hoovesId ?? "-") && arrivedLinks.every((one) => one.pushed.length === 0),
    { checkToReindeer: out(hoovesId, "reindeer").length, reindeerToCheck: out(cometId, "checks").length, pushed: arrivedLinks.map((one) => one.pushed.length), refused: arrivedLinks.flatMap((one) => one.refused.map((refusal) => refusal.error)) },
  );
  await settle();
  const settledLinks = await both();
  claim("bothSidesOfADualRelationConvergeWithNothingSent", quietly(settledLinks), { pushed: settledLinks.map((one) => one.pushed.length), applied: settledLinks.map((one) => one.applied.length) });

  const herdAs = { author: { kind: "human", id: "harness" }, intent: "by hand" };
  herd.apply({ name: "add-reindeer", args: { id: "reindeer:dasher", name: `Dasher ${run}` } }, herdAs);
  if (hoovesId) herd.apply({ name: "connect-check-reindeer", args: { id: hoovesId, to: "reindeer:dasher" } }, herdAs);
  // The checks run first, so the check's relation names Dasher on the pass after the fleet makes her page.
  await both();
  await both();
  const dasherPage = links.remoteId("reindeer:dasher");
  const hoovesThere = await relationOf(hooves.id, "Reindeer");
  claim("aLinkMadeHereIsWrittenToNotion", Boolean(dasherPage) && hoovesThere.length === 1 && hoovesThere[0] === dasherPage, { relation: hoovesThere.length, dasherHasAPage: Boolean(dasherPage) });
  await settle();
  const twinArrived = await untilBoth(() => out("reindeer:dasher", "checks").length === 1 && out(cometId, "checks").length === 0);
  const twinThere = dasherPage && twin ? await relationOf(dasherPage, twin) : [];
  claim(
    "notionsTwinOfALinkMadeHereArrivesOnTheOtherSide",
    out("reindeer:dasher", "checks").join() === (hoovesId ?? "-") && out(cometId, "checks").length === 0 && twinThere.length === 1,
    { dasherChecks: out("reindeer:dasher", "checks").length, cometChecks: out(cometId, "checks").length, twinInNotion: twinThere.length, pushed: twinArrived.map((one) => one.pushed.length) },
  );
  await settle();
  let converged;
  for (let tries = 0; tries < (stubbed ? 1 : 4); tries++) {
    if (tries > 0) await settle();
    converged = await both();
    if (quietly(converged)) break;
  }
  const once = await both();
  claim("aLinkMadeHereConvergesWithNothingMoreSent", quietly(converged) && quietly(once), { pushed: [...converged, ...once].map((one) => one.pushed.length), applied: [...converged, ...once].map((one) => one.applied.length) });
  claim("theSecretIsKeptNowhereByTheLinkedTables", !JSON.stringify([herd.log.all(), engines.map((one) => one.snapshot), linkedSaid]).includes(secret), {});

  const trashed = [];
  for (const id of linkedTables.splice(0)) {
    await api("DELETE", `/blocks/${id}`);
    trashed.push((await api("GET", `/databases/${id}`).then((one) => one.in_trash === true, () => true)));
  }
  claim("theLinkedTablesAreTrashed", trashed.length === 2 && trashed.every(Boolean), { trashed: trashed.filter(Boolean).length });

  /* ------------------- the acts a change lands through, in an app that declares more */
  // A workshop whose first act that makes a toy logs one on a reindeer, whose status a named step moves and whose count an act adds to.
  const toyTable = await table("toys", { Name: { title: {} }, Status: { select: { options: [{ name: "Not Started" }, { name: "In Progress" }, { name: "Complete" }] } }, Made: { number: { format: "number" } } });
  const workshop = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: `Notion harness workshop ${run}`,
    kinds: {
      reindeer: { fields: { name: { type: "string", required: true } } },
      toy: { fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["Not Started", "In Progress", "Complete"], required: true }, completed: { type: "integer", min: 0 } } },
    },
    acts: {
      "add-reindeer": { creates: "reindeer" },
      "log-toy": { on: "reindeer", creates: "toy" },
      "make-toy": { creates: "toy" },
      "set-toy-status": { on: "toy", writes: ["status"] },
      "add-made": { on: "toy", args: { more: { type: "integer", required: true, min: 1 } }, sets: { completed: { expr: "either(completed, 0) + more" } } },
    },
    connections: { toys: { system: "notion", database: toyTable.id, kind: "toy", properties: { name: "Name", status: "Status", completed: "Made" }, direction: "both" } },
  });
  claim("theCheckerPassesAConnectionWhoseFieldsAnotherActWrites", workshop.ok && workshop.findings.every((finding) => finding.severity !== "error"), { errors: workshop.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} ${finding.path}`) });
  if (!workshop.ok) throw new Error(`the harness's workshop declaration does not check: ${workshop.findings.map((finding) => finding.message).join("; ")}`);
  const shop = new Store({ schema: workshop.app.schema, mutations: workshop.app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const toyEngine = connection({ name: "toys", declaration: workshop.app.connections.toys, app: workshop.app, store: shop, databaseId: toyTable.id, token: () => secret, fetch: fetched }).engine;
  const toys = () => shop.graph.allNodes().filter((node) => node.kind === "toy");
  const toyRefusals = [];
  const untilShop = async (check, tries = stubbed ? 1 : 6) => {
    for (let at = 0; at < tries; at++) {
      if (at > 0) await settle();
      const one = await toyEngine.run();
      toyRefusals.push(...one.refused);
      if (check(one)) return one;
    }
    return undefined;
  };
  const lastAct = () => shop.log.all().at(-1)?.mutation?.name;

  const horse = await api("POST", "/pages", { parent: { type: "data_source_id", data_source_id: toyTable.data_sources[0].id }, properties: { Name: notionProperty("title", `Rocking horse ${run}`), Status: notionProperty("select", "Not Started") } });
  await settle();
  await untilShop(() => toys().length === 1);
  claim("aPageMadeInNotionLandsThroughAnActThatFitsIt", toys().length === 1 && lastAct() === "make-toy" && toyRefusals.length === 0, { act: lastAct() ?? null, refused: toyRefusals.map((one) => one.error) });

  await api("PATCH", `/pages/${horse.id}`, { properties: { Status: notionProperty("select", "In Progress"), Made: notionProperty("number", 12) } });
  await settle();
  await untilShop(() => toys()[0]?.status === "In Progress");
  claim("aChangeInNotionToAFieldAnotherActWritesLands", toys()[0]?.status === "In Progress" && toys()[0]?.completed === 12 && lastAct() === "edit-toy" && shop.log.all().at(-1)?.author.id === "notion", { status: toys()[0]?.status ?? null, completed: toys()[0]?.completed ?? null, act: lastAct() ?? null });

  const blank = await api("POST", "/pages", { parent: { type: "data_source_id", data_source_id: toyTable.data_sources[0].id }, properties: {} });
  toyRefusals.length = 0;
  for (let pass = 0; pass < 3; pass++) {
    await settle();
    toyRefusals.push(...(await toyEngine.run()).refused);
  }
  const saidOfBlank = toyRefusals.filter((one) => one.id === blank.id).length;
  await api("PATCH", `/pages/${blank.id}`, { properties: { Name: notionProperty("title", `Spinning top ${run}`), Status: notionProperty("select", "Not Started") } });
  await settle();
  await untilShop(() => toys().some((toy) => toy.name === `Spinning top ${run}`));
  claim("aBlankPageIsSaidOnceAndArrivesOnceFilled", saidOfBlank === 1 && toys().some((toy) => toy.name === `Spinning top ${run}`) && toyEngine.snapshot.skipped === undefined, { saidOfBlank, arrived: toys().some((toy) => toy.name === `Spinning top ${run}`) });

  for (const id of linkedTables.splice(0)) await api("DELETE", `/blocks/${id}`);

  /* ------------------------------------------------ a record set aside here */
  // Things and the notes about them, a table each: a thing set aside keeps its page, and what becomes of a page in the trash inside a relation is recorded as Notion does it.
  const thingTable = await table("things", { Name: { title: {} }, Notes: { rich_text: {} } });
  const thingSource = thingTable.data_sources[0].id;
  const noteTable = await table("notes", { Name: { title: {} }, About: { relation: { data_source_id: thingSource, type: "single_property", single_property: {} } } });
  const shelf = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: `Notion harness set aside ${run}`,
    kinds: {
      thing: { fields: { name: { type: "string", required: true }, notes: { type: "text" } } },
      note: { fields: { name: { type: "string", required: true } }, edges: { about: { to: ["thing"] } } },
    },
    acts: { "add-thing": { creates: "thing" }, "add-note": { creates: "note" } },
    connections: {
      things: { system: "notion", database: thingTable.id, kind: "thing", properties: { name: "Name", notes: "Notes" }, direction: "both" },
      notes: { system: "notion", database: noteTable.id, kind: "note", properties: { name: "Name", about: "About" }, direction: "both" },
    },
  });
  if (!shelf.ok) throw new Error(`the harness's set-aside declaration does not check: ${shelf.findings.map((finding) => finding.message).join("; ")}`);
  const shelfStore = new Store({ schema: shelf.app.schema, mutations: shelf.app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const shelfAct = (name, args) => shelfStore.apply({ name, args }, as);
  const shelved = (id) => shelfStore.graph.getNode(id);
  const aboutHere = (id) => shelfStore.graph.out(id, "about", { archived: "all" }).map((one) => one.id);
  const shelfWrites = [];
  const shelfRefused = [];
  const watched = (url, init) => {
    const { pathname } = new URL(url);
    const method = init?.method ?? "GET";
    if (method === "PATCH" || (method === "POST" && pathname.endsWith("/pages"))) shelfWrites.push(`${method} ${pathname.split("/").at(-1)}`);
    return fetched(url, init);
  };
  /** The two connections, started from what was kept; `whole` drops the cursors, so the next pass reads everything. */
  const openShelf = (states, whole = false) => {
    const shared = sharedLinks();
    return ["things", "notes"].map((name, at) => {
      const { cursor, ...kept } = states?.[at] ?? {};
      const state = states ? { ...structuredClone(kept), ...(whole || cursor === undefined ? {} : { cursor }) } : undefined;
      return connection({ name, declaration: shelf.app.connections[name], app: shelf.app, store: shelfStore, databaseId: shelf.app.connections[name].database, token: () => secret, fetch: watched, links: shared, ...(state ? { state } : {}) }).engine;
    });
  };
  let shelfEngines = openShelf();
  const restartShelf = (whole = false) => void (shelfEngines = openShelf(shelfEngines.map((one) => one.snapshot), whole));
  const shelfSaid = [];
  const shelfPass = async () => {
    const reports = [];
    for (const one of shelfEngines) reports.push(await one.run());
    for (const one of shelfEngines) one.resolveHeld();
    const away = reports.find((one) => one.offline);
    if (away) throw new Error(`the set-aside connection could not reach Notion: ${away.problem ?? ""}`);
    shelfSaid.push(...reports.flatMap((one) => one.said ?? []));
    shelfRefused.push(...reports.flatMap((one) => one.refused.map((refusal) => refusal.error)));
    return reports;
  };
  /** Whole reads until `check` holds: Notion's query catches up with a write within seconds. */
  const untilShelf = async (check, tries = stubbed ? 1 : 8) => {
    for (let at = 0; at < tries; at++) {
      await settle();
      restartShelf(true);
      await shelfPass();
      if (check()) return;
    }
  };
  const thingsThere = async (name) => (await api("POST", `/data_sources/${thingSource}/query`, { page_size: 100 })).results.filter((page) => !page.in_trash && textOf(page, "Name") === name);
  const aboutThere = async (id) => ((await api("GET", `/pages/${id}`)).properties.About?.relation ?? []).map((one) => one.id);

  for (const [id, name] of [["lamp", "Lamp"], ["chair", "Chair"]]) shelfAct("add-thing", { id: `thing:${id}`, name: `${name} ${run}` });
  for (const id of ["lamp", "chair"]) {
    shelfAct("add-note", { id: `note:${id}`, name: `About the ${id} ${run}` });
    shelfAct("connect-note-about", { id: `note:${id}`, to: `thing:${id}` });
  }
  await shelfPass();
  await shelfPass();
  const lampId = shelfEngines[0].linkOf("thing:lamp");
  const chairId = shelfEngines[0].linkOf("thing:chair");
  const noteLampId = shelfEngines[1].linkOf("note:lamp");
  const noteChairId = shelfEngines[1].linkOf("note:chair");
  if (!lampId || !chairId || !noteLampId || !noteChairId) throw new Error("the records made to be set aside did not become pages");
  await settle();
  await shelfPass();

  shelfWrites.length = 0;
  for (const id of ["lamp", "chair"]) shelfAct("archive-thing", { id: `thing:${id}` });
  await shelfPass();
  restartShelf();
  await shelfPass();
  const lampKept = await api("GET", `/pages/${lampId}`);
  const lampNamed = await aboutThere(noteLampId);
  claim("aRecordSetAsideKeepsItsPageAndItsPlaceInARelation", shelfWrites.length === 0 && lampKept.in_trash !== true && lampNamed.join() === lampId && aboutHere("note:lamp").join() === "thing:lamp", { sent: shelfWrites.length, inTrash: lampKept.in_trash ?? null, relation: lampNamed.length });

  await api("PATCH", `/pages/${lampId}`, { properties: { Notes: notionProperty("rich_text", "Bright") } });
  for (let at = 0; at < (stubbed ? 1 : 8) && shelved("thing:lamp")?.notes !== "Bright"; at++) {
    await settle();
    await shelfPass();
  }
  claim("anEditInNotionToThePageOfARecordSetAsideLandsHere", shelved("thing:lamp")?.notes === "Bright" && shelved("thing:lamp")?.$archived === true && shelfWrites.length === 0 && shelfRefused.length === 0, { notes: shelved("thing:lamp")?.notes ?? null, stillAside: shelved("thing:lamp")?.$archived === true, sent: shelfWrites.length, refused: [...shelfRefused] });

  shelfAct("unarchive-thing", { id: "thing:lamp" });
  restartShelf();
  await shelfPass();
  const sentOnReturn = shelfWrites.length;
  shelfAct("edit-thing", { id: "thing:lamp", notes: "Brighter" });
  await shelfPass();
  const lampEdited = await api("GET", `/pages/${lampId}`);
  claim("aRecordBroughtBackIsTheSamePagesAndAnEditHereGoes", sentOnReturn === 0 && shelfEngines[0].linkOf("thing:lamp") === lampId && textOf(lampEdited, "Notes") === "Brighter", { sentOnReturn, samePage: shelfEngines[0].linkOf("thing:lamp") === lampId });

  await api("PATCH", `/pages/${chairId}`, { in_trash: true });
  const deletedSaid = () => shelfSaid.filter((line) => /its page was deleted in Notion: it is kept here/.test(line)).length;
  await untilShelf(() => deletedSaid() > 0);
  // WHAT NOTION DOES with a page in the trash inside another page's relation: whether it still lists it, and whether it takes it written again.
  const listedInTrash = await aboutThere(noteChairId);
  const linkedHere = aboutHere("note:chair");
  const rewritten = await api("PATCH", `/pages/${noteChairId}`, { properties: { About: notionProperty("relation", [chairId]) } }).then(
    () => "taken",
    (error) => `refused: ${error.message}`.replaceAll(chairId, "<page>").replaceAll(chairId.replace(/-/g, ""), "<page>"),
  );
  const listedAfterRewrite = await aboutThere(noteChairId);
  await settle();
  await shelfPass();
  // Edited here, the note that links it still goes, whatever Notion makes of the page in the trash.
  shelfRefused.length = 0;
  shelfAct("edit-note", { id: "note:chair", name: `About the old chair ${run}` });
  await shelfPass();
  const noteEdited = await api("GET", `/pages/${noteChairId}`);
  claim("aPageInTheTrashInsideARelationHoldsUpNoEditOfThePageThatLinksIt", shelfRefused.length === 0 && textOf(noteEdited, "Name") === `About the old chair ${run}`, {
    whatNotionDoes: { listsThePageInTheTrash: listedInTrash.includes(chairId), relationLists: listedInTrash.length, writtenAgain: rewritten, listsItAfterThat: listedAfterRewrite.includes(chairId) },
    linkKeptHere: linkedHere.includes("thing:chair"),
    linkHereAfterwards: aboutHere("note:chair").includes("thing:chair"),
    refused: [...shelfRefused],
  });

  const keptAside = shelved("thing:chair")?.$archived === true;
  restartShelf(true);
  await shelfPass();
  const saidOnce = deletedSaid() === 1;
  shelfWrites.length = 0;
  shelfAct("unarchive-thing", { id: "thing:chair" });
  restartShelf();
  await shelfPass();
  const newChairId = shelfEngines[0].linkOf("thing:chair");
  const madeAgain = shelfWrites.filter((one) => one === "POST pages").length;
  for (let at = 0; at < (stubbed ? 1 : 4); at++) {
    await settle();
    await shelfPass();
  }
  const chairsThere = await thingsThere(`Chair ${run}`);
  const oldChair = await api("GET", `/pages/${chairId}`);
  claim(
    "aPageDeletedWhileItsRecordIsAsideIsMadeOnceAgainWhenItIsBroughtBackAndSaid",
    keptAside && saidOnce && madeAgain === 1 && newChairId !== chairId && chairsThere.length === 1 && chairsThere[0].id === newChairId && oldChair.in_trash === true && shelfSaid.filter((line) => /so a new one was made/.test(line)).length === 1,
    { keptAside, saidOnce, madeAgain, pagesThere: chairsThere.length, oldInTrash: oldChair.in_trash ?? null, said: shelfSaid.filter((line) => /set aside|brought back/.test(line)).map((line) => line.replaceAll(run, "<run id>")), relationAfterwards: (await aboutThere(noteChairId)).includes(newChairId ?? "-") },
  );

  shelfAct("archive-thing", { id: "thing:lamp" });
  await shelfPass();
  for (const id of ["lamp", "chair"]) {
    shelfAct("remove-note", { id: `note:${id}` });
    shelfAct("remove-thing", { id: `thing:${id}` });
  }
  shelfRefused.length = 0;
  await shelfPass();
  const trashedThings = [];
  for (const id of [lampId, newChairId, noteLampId, noteChairId]) trashedThings.push(id ? (await api("GET", `/pages/${id}`)).in_trash === true : false);
  claim("onlyRemovingTheRecordPutsItsPageInTheTrash", trashedThings.every(Boolean) && shelfRefused.length === 0, { inTrash: trashedThings, refused: [...shelfRefused] });
  claim("theSecretIsKeptNowhereByTheRecordsSetAside", !JSON.stringify([shelfStore.log.all(), shelfEngines.map((one) => one.snapshot), shelfSaid]).includes(secret), {});

  for (const id of [...linkedTables]) {
    await api("DELETE", `/blocks/${id}`);
    linkedTables.splice(linkedTables.indexOf(id), 1);
  }

  for (const source of [sourceId, second.id]) {
    for (const page of (await api("POST", `/data_sources/${source}/query`, { page_size: 100 })).results) {
      if (textOf(page, "Name").includes(run)) await api("PATCH", `/pages/${page.id}`, { in_trash: true });
    }
  }
  await settle();
  const left = (await api("POST", `/data_sources/${sourceId}/query`, { page_size: 100 })).results.filter((page) => !page.in_trash);
  claim("everythingTheRunMadeIsArchived", removedAll.refused.length === 0 && left.length === 0 && tasks().length === 0, { refused: removedAll.refused.map((one) => one.error), leftInNotion: left.length });

  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = (error instanceof Error ? error.message : String(error)).replaceAll(secret, "<secret>");
  report.passed = false;
} finally {
  // The relation claims' tables, when a claim stopped before they were trashed.
  for (const id of linkedTables) {
    try {
      await api("DELETE", `/blocks/${id}`);
    } catch (error) {
      report.cleanup = (error instanceof Error ? error.message : String(error)).replaceAll(secret, "<secret>");
    }
  }
  // Whatever happened, the run's database goes to the trash: it, and every page in it, carried the run id.
  if (databaseId) {
    try {
      await api("DELETE", `/blocks/${databaseId}`);
    } catch (error) {
      report.cleanup = (error instanceof Error ? error.message : String(error)).replaceAll(secret, "<secret>");
    }
  }
}

const out = stubbed ? "docs/notion-stub.json" : "docs/notion.json";
writeFileSync(resolve(repoRoot, out), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\n${report.passed ? "passed" : `failed${report.error ? `: ${report.error}` : ""}`} (run ${run}, ${report.mode}); wrote ${out}\n`);
process.exit(report.passed ? 0 : 1);
