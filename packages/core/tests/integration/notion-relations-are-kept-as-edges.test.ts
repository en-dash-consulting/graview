import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, scriptedNotion, sharedLinks, type SyncReport } from "../../src/sync/index.js";

/**
 * SEVERAL NOTION TABLES JOINED BY RELATIONS, KEPT AS EDGES (Roadmap
 * f-notion-several-tables): one connection per table, each to its own kind,
 * and a relation property mapped to one of the kind's relations. A link in
 * Notion is a link here and one made here is written to Notion; a page a
 * relation reaches that is not linked yet is held and linked once its table
 * is read, whichever order the connections run in; both sides of a dual
 * relation converge with nothing sent; a read-only connection refuses a
 * link made here; and the checker refuses a relation it could not keep.
 */

const SECRET = "secret_scriptedNotionIntegrationSecret0001";

/** Reindeer and their health checks: a check is of one reindeer, a reindeer has many checks. */
const document = (connections: Record<string, unknown>, options: { checksEdge?: boolean; reindeerTo?: unknown } = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "North Pole",
  kinds: {
    reindeer: {
      fields: { name: { type: "string", required: true } },
      ...(options.checksEdge ? { edges: { checks: { to: ["check"] } } } : {}),
    },
    check: {
      fields: { name: { type: "string", required: true }, notes: { type: "text" } },
      edges: { reindeer: { to: options.reindeerTo ?? ["reindeer"], cardinality: "one" } },
    },
  },
  acts: { "add-reindeer": { creates: "reindeer" }, "add-check": { creates: "check" } },
  connections,
});

const fleet = (extra: Record<string, unknown> = {}) => ({ system: "notion", database: "0".repeat(31) + "1", kind: "reindeer", properties: { name: "Name" }, direction: "both", ...extra });
const checks = (extra: Record<string, unknown> = {}) => ({ system: "notion", database: "0".repeat(31) + "2", kind: "check", properties: { name: "Name", notes: "Notes", reindeer: "Reindeer Fleet" }, direction: "both", ...extra });

const codes = (raw: unknown, severity = "error") =>
  compileDocument(raw)
    .findings.filter((finding) => finding.severity === severity)
    .map((finding) => `${finding.code} ${finding.path}`);

/** Two tables in a scripted Notion, linked by a dual relation, and the app's two connections over one set of links. */
function opened(options: { dual?: boolean; fleet?: Record<string, unknown>; checks?: Record<string, unknown> } = {}) {
  const compiled = compileDocument(document({ fleet: fleet(options.fleet), checks: checks(options.checks) }, { checksEdge: options.dual }));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const stub = scriptedNotion({ secret: SECRET });
  const fleetDb = stub.database({ title: "Reindeer Fleet", properties: { Name: "title" } });
  const checksDb = stub.database({ title: "Reindeer Health Checks", properties: { Name: "title", Notes: "rich_text", "Reindeer Fleet": "relation" }, relations: { "Reindeer Fleet": { to: fleetDb, dual: "Health Checks" } } });
  const said: string[] = [];
  const links = sharedLinks();
  const open = (name: "fleet" | "checks", databaseId: string) =>
    connection({ name, declaration: app.connections![name]!, app, store, databaseId, token: () => SECRET, fetch: stub.fetch, links, say: (line) => said.push(`${name}: ${line}`) }).engine;
  const engines = { fleet: open("fleet", fleetDb), checks: open("checks", checksDb) };
  /** One pass of every connection in the order given, then what each held linked, as `runConnections` does. */
  const pass = async (order: readonly ("fleet" | "checks")[] = ["fleet", "checks"], settle = true): Promise<SyncReport[]> => {
    const reports: SyncReport[] = [];
    for (const name of order) reports.push(await engines[name].run());
    if (settle) for (const name of order) engines[name].resolveHeld();
    return reports;
  };
  const quiet = (reports: readonly SyncReport[]) => reports.every((report) => report.pushed.length === 0 && report.applied.length === 0 && report.refused.length === 0 && !report.offline);
  const as = { author: { kind: "human" as const, id: "nick" }, intent: "by hand" };
  const linked = (from: string, edge: string) => store.graph.out(from, edge).map((node) => node.id).sort();
  const kindOf = (kind: string) => store.graph.allNodes().filter((node) => node.kind === kind) as unknown as Record<string, unknown>[];
  const idOf = (kind: string, name: string) => String(kindOf(kind).find((node) => node["name"] === name)?.["id"]);
  const relation = (pageId: string, property: string) => (((stub.page(pageId)!["properties"] as Record<string, Record<string, unknown>>)[property]!["relation"] as { id: string }[]) ?? []).map((one) => one.id).sort();
  return { app, store, stub, fleetDb, checksDb, engines, pass, quiet, as, linked, kindOf, idOf, relation, said, links };
}

describe("a Notion relation kept as an edge", () => {
  it("brings a link made in Notion here as an edge, credited to Notion, and the next pass sends nothing", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, store, linked, idOf } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    const first = await pass();
    expect(first.flatMap((report) => report.refused)).toEqual([]);
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([idOf("reindeer", "Comet")]);
    const linking = store.log.all().find((op) => op.primitives.some((primitive) => primitive.op === "add-edge"));
    expect(linking?.author).toEqual({ kind: "system", id: "notion" });
    expect(quiet(await pass())).toBe(true);
  });

  it("holds a page its table has not read yet, and links it once it has, whichever connection runs first", async () => {
    const { stub, fleetDb, checksDb, engines, pass, quiet, linked, idOf } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    // The checks first, and nothing settled after: the reindeer is not here yet.
    const [held] = await pass(["checks"], false);
    expect(held!.pushed).toEqual([]);
    const hooves = idOf("check", "Hooves");
    expect(linked(hooves, "reindeer")).toEqual([]);
    expect(engines.checks.snapshot.unresolved).toEqual({ [hooves]: { reindeer: [String(comet["id"])] } });
    // The fleet next: the reindeer is made, and the checks' next pass links it, sending nothing.
    await pass(["fleet"], false);
    const [linkedNow] = await pass(["checks"], false);
    expect(linked(hooves, "reindeer")).toEqual([idOf("reindeer", "Comet")]);
    expect(linkedNow!.pushed).toEqual([]);
    expect(engines.checks.snapshot.unresolved).toBeUndefined();
    expect(quiet(await pass(["checks", "fleet"]))).toBe(true);
  });

  it("links within one pass when the host settles what was held after it", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, linked, idOf } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    await pass(["checks", "fleet"]);
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([idOf("reindeer", "Comet")]);
    expect(quiet(await pass(["checks", "fleet"]))).toBe(true);
  });

  it("writes a link made here to Notion as the whole relation, and does not take it back as news", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, store, as, linked, idOf, links, relation } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    const hooves = stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    await pass();
    // A reindeer made here, and the check moved to it: the reindeer becomes a page, then the check's relation names it.
    store.apply({ name: "add-reindeer", args: { id: "reindeer:dasher", name: "Dasher" } }, as);
    store.apply({ name: "connect-check-reindeer", args: { id: idOf("check", "Hooves"), to: "reindeer:dasher" } }, as);
    const sent = await pass();
    expect(sent.flatMap((report) => report.pushed).sort()).toEqual([idOf("check", "Hooves"), "reindeer:dasher"].sort());
    const dasher = links.remoteId("reindeer:dasher")!;
    expect(relation(String(hooves["id"]), "Reindeer Fleet")).toEqual([dasher]);
    // Notion's twin on the reindeer's side moved with it.
    expect(relation(dasher, "Health Checks")).toEqual([String(hooves["id"])]);
    expect(relation(String(comet["id"]), "Health Checks")).toEqual([]);
    expect(quiet(await pass())).toBe(true);

    store.apply({ name: "disconnect-check-reindeer", args: { id: idOf("check", "Hooves"), to: "reindeer:dasher" } }, as);
    await pass();
    expect(relation(String(hooves["id"]), "Reindeer Fleet")).toEqual([]);
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([]);
    expect(quiet(await pass())).toBe(true);
  });

  it("writes a link to a record made here once that record is a page, in the order the connections run", async () => {
    const { stub, checksDb, pass, quiet, store, as, links, relation, idOf } = opened();
    const hooves = stub.add(checksDb, { Name: "Hooves" });
    await pass();
    store.apply({ name: "add-reindeer", args: { id: "reindeer:vixen", name: "Vixen" } }, as);
    store.apply({ name: "connect-check-reindeer", args: { id: idOf("check", "Hooves"), to: "reindeer:vixen" } }, as);
    // The checks run first: Vixen has no page yet, so nothing is sent for the link until she has one.
    const [first] = await pass(["checks", "fleet"]);
    expect(first!.pushed).toEqual([]);
    await pass(["checks", "fleet"]);
    expect(relation(String(hooves["id"]), "Reindeer Fleet")).toEqual([links.remoteId("reindeer:vixen")]);
    expect(quiet(await pass(["checks", "fleet"]))).toBe(true);
  });

  it("takes a link away here when it is taken away in Notion", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, linked, idOf } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    const hooves = stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    await pass();
    stub.tick(60_000);
    stub.edit(String(hooves["id"]), { "Reindeer Fleet": [] });
    const [, taken] = await pass();
    expect(taken!.applied).toEqual([idOf("check", "Hooves")]);
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([]);
    expect(quiet(await pass())).toBe(true);
  });

  it("keeps the first page of a relation of one, and says the rest once", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, linked, idOf, said } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    const cupid = stub.add(fleetDb, { Name: "Cupid" });
    stub.add(checksDb, { Name: "Antlers", "Reindeer Fleet": [String(comet["id"]), String(cupid["id"])] });
    await pass();
    expect(linked(idOf("check", "Antlers"), "reindeer")).toEqual([idOf("reindeer", "Comet")]);
    expect(said.filter((line) => /links one page, and a page in Notion links 2/.test(line))).toHaveLength(1);
    // Notion keeps both: nothing is sent to take the second away.
    expect(quiet(await pass())).toBe(true);
  });

  it("holds a relation both sides changed, and sends and takes neither until somebody chooses", async () => {
    const { stub, fleetDb, checksDb, engines, pass, store, as, linked, idOf, relation } = opened();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    const cupid = stub.add(fleetDb, { Name: "Cupid" });
    const blitzen = stub.add(fleetDb, { Name: "Blitzen" });
    const hooves = stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    await pass();
    store.apply({ name: "connect-check-reindeer", args: { id: idOf("check", "Hooves"), to: idOf("reindeer", "Cupid") } }, as);
    stub.tick(60_000);
    stub.edit(String(hooves["id"]), { "Reindeer Fleet": [String(blitzen["id"])] });
    const [, held] = await pass();
    expect(held!.conflicts).toEqual([expect.objectContaining({ localId: idOf("check", "Hooves"), field: "reindeer", ours: [String(cupid["id"])], theirs: [String(blitzen["id"])] })]);
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([idOf("reindeer", "Cupid")]);
    expect(relation(String(hooves["id"]), "Reindeer Fleet")).toEqual([String(blitzen["id"])]);
    engines.checks.resolve(held!.conflicts[0]!, "theirs");
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([idOf("reindeer", "Blitzen")]);
    const after = await pass();
    expect(after.flatMap((report) => report.pushed)).toEqual([]);
  });

  it("follows a relation past the 25 pages Notion lists on a page", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, linked, idOf } = opened({ dual: true, fleet: { properties: { name: "Name", checks: "Health Checks" } } });
    const comet = stub.add(fleetDb, { Name: "Comet" });
    for (let n = 1; n <= 30; n++) stub.add(checksDb, { Name: `Check ${n}`, "Reindeer Fleet": [String(comet["id"])] });
    await pass();
    expect(linked(idOf("reindeer", "Comet"), "checks")).toHaveLength(30);
    expect(stub.requests.some((request) => request.method === "GET" && /^\/pages\/[^/]+\/properties\//.test(request.path))).toBe(true);
    expect(quiet(await pass())).toBe(true);
  });
});

describe("both sides of a dual relation", () => {
  const both = () => opened({ dual: true, fleet: { properties: { name: "Name", checks: "Health Checks" } } });

  it("arrive as a link on each side, and converge with nothing sent", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, linked, idOf } = both();
    const comet = stub.add(fleetDb, { Name: "Comet" });
    stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    const first = await pass();
    expect(first.flatMap((report) => report.pushed)).toEqual([]);
    expect(linked(idOf("check", "Hooves"), "reindeer")).toEqual([idOf("reindeer", "Comet")]);
    expect(linked(idOf("reindeer", "Comet"), "checks")).toEqual([idOf("check", "Hooves")]);
    expect(quiet(await pass())).toBe(true);
    expect(quiet(await pass(["checks", "fleet"]))).toBe(true);
  });

  it("send a link made here on one side once, take Notion's twin on the other, and then send nothing", async () => {
    const { stub, fleetDb, checksDb, pass, quiet, store, as, linked, idOf } = both();
    stub.add(fleetDb, { Name: "Comet" });
    stub.add(checksDb, { Name: "Hooves" });
    await pass();
    stub.tick(60_000);
    store.apply({ name: "connect-check-reindeer", args: { id: idOf("check", "Hooves"), to: idOf("reindeer", "Comet") } }, as);
    const sent = await pass(["checks", "fleet"]);
    expect(sent.flatMap((report) => report.pushed)).toEqual([idOf("check", "Hooves")]);
    // The fleet's pass took the twin Notion set on the reindeer's page: the link, from its side.
    expect(linked(idOf("reindeer", "Comet"), "checks")).toEqual([idOf("check", "Hooves")]);
    expect(quiet(await pass())).toBe(true);
    expect(quiet(await pass(["checks", "fleet"]))).toBe(true);
  });
});

describe("a read-only connection's relation", () => {
  it("is brought here from Notion, and a link made or taken away here is refused, saying where to change it", async () => {
    const { stub, fleetDb, checksDb, pass, store, as, linked, idOf } = opened({ checks: { direction: "read" } });
    const comet = stub.add(fleetDb, { Name: "Comet" });
    stub.add(checksDb, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    await pass();
    const hooves = idOf("check", "Hooves");
    expect(linked(hooves, "reindeer")).toEqual([idOf("reindeer", "Comet")]);
    store.apply({ name: "add-reindeer", args: { id: "reindeer:dasher", name: "Dasher" } }, as);
    expect(() => store.apply({ name: "connect-check-reindeer", args: { id: hooves, to: "reindeer:dasher" } }, as)).toThrow(/comes from a Notion database this app only reads/);
    expect(() => store.apply({ name: "disconnect-check-reindeer", args: { id: hooves, to: idOf("reindeer", "Comet") } }, as)).toThrow(/only reads/);
    expect(store.permits({ name: "connect-check-reindeer", args: { id: hooves, to: "reindeer:dasher" } }, { kind: "human", id: "nick" }).ok).toBe(false);
  });
});

describe("graview check judges a Notion relation", () => {
  it("passes a relation to a kind another Notion connection keeps, named or typed", () => {
    expect(codes(document({ fleet: fleet(), checks: checks() }))).toEqual([]);
    expect(codes(document({ fleet: fleet(), checks: checks({ properties: { name: "Name", reindeer: { name: "Reindeer Fleet", type: "relation" } } }) }))).toEqual([]);
    expect(codes(document({ fleet: fleet({ properties: undefined }), checks: checks({ properties: undefined }) }))).toEqual([]);
  });

  it("refuses a relation to a kind no Notion connection keeps, or to any kind", () => {
    expect(codes(document({ checks: checks() }))).toEqual(["connection-relation-target connections.checks.properties.reindeer"]);
    expect(codes(document({ fleet: fleet(), checks: checks() }, { reindeerTo: "*" }))).toEqual(["connection-relation-target connections.checks.properties.reindeer"]);
  });

  it("refuses a relation property mapped to a field, and a property of another type mapped to a relation", () => {
    expect(codes(document({ fleet: fleet(), checks: checks({ properties: { name: "Name", notes: { name: "Reindeer Fleet", type: "relation" } } }) }))).toEqual(["connection-relation connections.checks.properties.notes"]);
    expect(codes(document({ fleet: fleet(), checks: checks({ properties: { name: "Name", reindeer: { name: "Notes", type: "rich_text" } } }) }))).toEqual(["connection-relation connections.checks.properties.reindeer"]);
    expect(codes(document({ fleet: fleet(), checks: checks({ properties: { name: "Name", herd: "Reindeer Fleet" } }) }))).toEqual(["connection-field connections.checks.properties.herd"]);
  });
});
