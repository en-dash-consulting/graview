import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { ARCHIVED, repairPlan, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { connection, type Fetcher } from "../../src/sync/index.js";

/**
 * Roadmap f-keep-linked. A RECORD THAT FOLLOWS ANOTHER. Homeflow's events
 * are copies of its plan items: renaming a plan item to "Costco" left the
 * event, and the Google event, as "Huguenot Park & Costco". An event now
 * says it derives from its plan item — `"derives": { "from": "plan-item",
 * "via": "source", "set": { … } }` — and the store keeps the two in step in
 * the same change as either one's edit: forward from the item, back from a
 * field set from one of the item's own, flagged where it cannot go back,
 * archived with it. A computed field may be sent to a connection, read-only
 * on the way out.
 */
const HOMEFLOW = {
  format: "graview-document",
  formatVersion: 1,
  name: "Homeflow",
  roles: ["planner", "viewer"],
  kinds: {
    "plan-item": { fields: { name: { type: "string", required: true }, date: { type: "date" }, place: { type: "string" } } },
    event: {
      fields: { title: { type: "string", required: true }, start: { type: "date" }, end: { type: "date" }, note: { type: "string" }, where: { type: "string" } },
      edges: { source: { to: ["plan-item"], cardinality: "one" } },
      computed: { heading: "concat(title, ' at ', where)" },
      derives: {
        from: "plan-item",
        via: "source",
        set: { title: { expr: "name" }, start: { expr: "date" }, end: { expr: "date" }, where: { expr: "concat(place, '')" } },
      },
    },
  },
  acts: {
    "add-plan-item": { creates: "plan-item" },
    "add-event": { creates: "event" },
  },
};

const SEED = {
  nodes: [
    { id: "i1", kind: "plan-item", name: "Huguenot Park & Costco", date: "2026-11-01", place: "Jacksonville" },
    { id: "e1", kind: "event", title: "Huguenot Park & Costco", start: "2026-11-01", end: "2026-11-01", where: "Jacksonville" },
    { id: "e2", kind: "event", title: "Huguenot Park & Costco", start: "2026-11-01", end: "2026-11-01", where: "Jacksonville" },
    { id: "i2", kind: "plan-item", name: "Dentist", date: "2026-11-03", place: "Riverside" },
    { id: "e3", kind: "event", title: "Something else", start: "2026-10-01" },
  ],
  edges: [
    { kind: "source", from: "e1", to: "i1" },
    { kind: "source", from: "e2", to: "i1" },
  ],
};

function compiled(doc: unknown = HOMEFLOW): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-28" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>, policy?: unknown) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(policy ? { policy: policy as never } : {}), snapshot: structuredClone(SEED) as never });
const node = (store: Store<AnySchema>, id: string) => store.graph.getNode(id) as unknown as Record<string, unknown>;
const errors = (raw: unknown) =>
  compileDocument(raw)
    .findings.filter((f) => f.severity === "error")
    .map((f) => `${f.code} ${f.path}`);
const withEvent = (patch: Record<string, unknown>) => ({ ...HOMEFLOW, kinds: { ...HOMEFLOW.kinds, event: { ...HOMEFLOW.kinds.event, ...patch } } });
const derivesOf = (derives: Record<string, unknown>) => withEvent({ derives: { ...HOMEFLOW.kinds.event.derives, ...derives } });

describe("the declaration", () => {
  it("compiles with no error, and describe says the event follows its plan item", () => {
    expect(errors(HOMEFLOW)).toEqual([]);
    const said = describeApp(compiled());
    expect(said).toContain("## Kept in step with another record");
    expect(said).toMatch(/Each event follows its plan item through source.*a change to its title, start and end goes back to the plan item; archiving or removing the plan item archives it\./);
  });

  it("says a kind, a relation, a field, a value and a name it cannot follow by, each at its place", () => {
    expect(errors(derivesOf({ from: "chore" }))).toEqual(["derives-kind kinds.event.derives.from"]);
    expect(errors(derivesOf({ from: "event" }))).toEqual(["derives-kind kinds.event.derives.from"]);
    expect(errors(derivesOf({ via: "owner" }))).toEqual(["derives-relation kinds.event.derives.via"]);
    expect(errors(derivesOf({ set: { length: { expr: "name" } } }))).toEqual(["derives-field kinds.event.derives.set.length"]);
    expect(errors(derivesOf({ set: { heading: { expr: "name" } } }))).toEqual(["computed-written kinds.event.derives.set.heading"]);
    expect(errors(derivesOf({ set: { title: "$name" } }))).toEqual(["derives-value kinds.event.derives.set.title"]);
    expect(errors(derivesOf({ set: { title: { expr: "nmae" } } }))).toEqual(["derives-name kinds.event.derives.set.title"]);
    expect(errors(derivesOf({ set: { title: { expr: "name +" } } }))[0]).toMatch(/^expression kinds\.event\.derives\.set\.title/);
    const relation = compileDocument(derivesOf({ via: "owner" })).findings.find((f) => f.code === "derives-relation")!;
    expect(relation.message).toBe('"owner" does not join event to plan item, so no event has plan item to follow');
    expect(relation.fix).toBe("name the relation that does: source");
  });

  it("follows through a relation declared on the source too, pointing at the kind that follows it", () => {
    const flipped = {
      ...HOMEFLOW,
      kinds: {
        "plan-item": { ...HOMEFLOW.kinds["plan-item"], edges: { events: { to: ["event"] } } },
        event: { ...HOMEFLOW.kinds.event, edges: undefined, derives: { from: "plan-item", via: "events", set: { title: { expr: "name" } } } },
      },
    };
    expect(errors(flipped)).toEqual([]);
    const app = compiled(flipped);
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: SEED.nodes, edges: [{ kind: "events", from: "i1", to: "e1" }] } as never });
    store.apply({ name: "edit-plan-item", args: { id: "i1", name: "Costco" } });
    expect(node(store, "e1")["title"]).toBe("Costco");
  });
});

describe("the event follows its plan item", () => {
  it("renaming a plan item renames its events in the same change, and one undo takes both back", () => {
    const store = storeOf(compiled());
    const result = store.apply({ name: "edit-plan-item", args: { id: "i1", name: "Costco", date: "2026-11-02" } });
    expect(result.ops).toHaveLength(1);
    expect([node(store, "e1")["title"], node(store, "e1")["start"], node(store, "e1")["end"]]).toEqual(["Costco", "2026-11-02", "2026-11-02"]);
    expect(node(store, "e2")["title"]).toBe("Costco");
    // A record that follows nothing is left alone.
    expect(node(store, "e3")["title"]).toBe("Something else");
    expect([...result.writes].sort()).toEqual(["e1", "e2", "i1"]);
    store.undo(result.batch);
    expect([node(store, "i1")["name"], node(store, "e1")["title"], node(store, "e2")["title"]]).toEqual(["Huguenot Park & Costco", "Huguenot Park & Costco", "Huguenot Park & Costco"]);
  });

  it("a preview says what would follow, and keeps none of it", () => {
    const store = storeOf(compiled());
    const preview = store.preview({ name: "edit-plan-item", args: { id: "i1", name: "Costco" } });
    expect(preview.primitives.filter((p) => p.op === "patch-node").map((p) => (p as { id: string }).id)).toEqual(["i1", "e1", "e2"]);
    expect(node(store, "e1")["title"]).toBe("Huguenot Park & Costco");
    expect(store.previewAll([{ name: "edit-plan-item", args: { id: "i1", name: "Costco" } }]).writes).toEqual(expect.arrayContaining(["e1", "e2"]));
  });

  it("a record linked to a plan item takes its values when the link is made", () => {
    const store = storeOf(compiled());
    store.apply({ name: "connect-event-source", args: { id: "e3", to: "i2" } });
    expect([node(store, "e3")["title"], node(store, "e3")["start"], node(store, "e3")["where"]]).toEqual(["Dentist", "2026-11-03", "Riverside"]);
  });

  it("a title changed on the event goes back to its plan item, and on to the item's other events", () => {
    const store = storeOf(compiled());
    const result = store.apply({ name: "edit-event", args: { id: "e1", title: "Costco run" } });
    expect(result.ops).toHaveLength(1);
    expect([node(store, "i1")["name"], node(store, "e2")["title"]]).toEqual(["Costco run", "Costco run"]);
    store.undo(result.batch);
    expect([node(store, "i1")["name"], node(store, "e1")["title"], node(store, "e2")["title"]]).toEqual(["Huguenot Park & Costco", "Huguenot Park & Costco", "Huguenot Park & Costco"]);
  });

  it("a field worked out otherwise stays as it was changed, and the app says it is out of step, with the repair that sets it again", () => {
    const store = storeOf(compiled());
    expect(store.findings()).toEqual([]);
    store.apply({ name: "edit-event", args: { id: "e1", where: "The beach" } });
    expect([node(store, "e1")["where"], node(store, "i1")["place"]]).toEqual(["The beach", "Jacksonville"]);
    const findings = store.findings();
    expect(findings.map((f) => [f.code, f.id, f.detail])).toEqual([["derived-out-of-step", "e1", "where"]]);
    expect(findings[0]!.message).toBe('Huguenot Park & Costco: Where says "The beach", and it follows Huguenot Park & Costco, which works it out as "Jacksonville"');
    const plan = repairPlan(findings);
    expect(plan.said).toEqual(["1 field of a record that follows another would be set again from its source"]);
    store.applyPrimitives(plan.primitives);
    expect(node(store, "e1")["where"]).toBe("Jacksonville");
    expect(store.findings()).toEqual([]);
  });

  it("the person's own edit on the event is kept when only what went back moved its plan item", () => {
    const store = storeOf(compiled());
    store.apply({ name: "edit-event", args: { id: "e1", title: "Costco", where: "Atlantic Blvd" } });
    expect([node(store, "e1")["title"], node(store, "e1")["where"], node(store, "i1")["name"], node(store, "e2")["where"]]).toEqual(["Costco", "Atlantic Blvd", "Costco", "Jacksonville"]);
  });

  it("a change goes back only when whoever made it may change the plan item", () => {
    const app = compiled({ ...HOMEFLOW, policy: { grants: [{ roles: ["planner"], mutations: "*" }, { roles: ["viewer"], mutations: ["edit-event"] }] } });
    const store = storeOf(app, app.policy);
    const viewer: Principal = { kind: "human", id: "vic", roles: ["viewer"] };
    store.apply({ name: "edit-event", args: { id: "e1", title: "Mine" } }, { author: viewer });
    expect([node(store, "e1")["title"], node(store, "i1")["name"]]).toEqual(["Mine", "Huguenot Park & Costco"]);
    expect(store.findings().map((f) => [f.code, f.detail])).toEqual([["derived-out-of-step", "title"]]);
    const planner: Principal = { kind: "human", id: "pat", roles: ["planner"] };
    store.apply({ name: "edit-event", args: { id: "e2", title: "Theirs" } }, { author: planner });
    expect(node(store, "i1")["name"]).toBe("Theirs");
  });

  it("archiving the plan item archives its events, bringing it back brings them back, and removing it archives them", () => {
    const store = storeOf(compiled());
    store.apply({ name: "archive-plan-item", args: { id: "i1" } });
    expect([node(store, "e1")[ARCHIVED], node(store, "e2")[ARCHIVED]]).toEqual([true, true]);
    store.apply({ name: "unarchive-plan-item", args: { id: "i1" } });
    expect([node(store, "e1")[ARCHIVED], node(store, "e2")[ARCHIVED]]).toEqual([undefined, undefined]);
    const removed = store.apply({ name: "remove-plan-item", args: { id: "i1" } });
    expect(removed.ops).toHaveLength(1);
    expect([node(store, "e1")[ARCHIVED], node(store, "e2")[ARCHIVED], node(store, "e1")["title"]]).toEqual([true, true, "Huguenot Park & Costco"]);
    store.undo(removed.batch);
    expect([node(store, "i1")["name"], node(store, "e1")[ARCHIVED]]).toEqual(["Huguenot Park & Costco", undefined]);
  });

  it("a host's own change keeps them in step too", () => {
    const store = storeOf(compiled());
    store.applyPrimitives([{ op: "patch-node", id: "i1", before: { name: "Huguenot Park & Costco" }, after: { name: "Costco" } }]);
    expect(node(store, "e1")["title"]).toBe("Costco");
  });
});

/* -------------------------------------------------- a scripted Google */

type Event = Record<string, unknown> & { id: string; etag: string; seq: number };

function google() {
  const events = new Map<string, Event>();
  const sent: Record<string, unknown>[] = [];
  let seq = 0;
  let next = 0;
  const touch = (event: Record<string, unknown>) => {
    seq += 1;
    const stamped = { ...event, etag: `"e${seq}"`, seq } as Event;
    events.set(stamped.id, stamped);
    return stamped;
  };
  const answer = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body });
  const fetch: Fetcher = async (url, init) => {
    const at = new URL(url);
    const id = decodeURIComponent(at.pathname.split("/events")[1]?.slice(1) ?? "");
    const method = init?.method ?? "GET";
    if (method === "GET") {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      return answer(200, { items: [...events.values()].filter((event) => event.seq > since).map(({ seq: _seq, ...event }) => event), nextSyncToken: String(seq) });
    }
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    sent.push({ method, id, ...body });
    if (method === "POST") {
      next += 1;
      const { seq: _seq, ...made } = touch({ id: `evt${next}`, ...body });
      return answer(200, made);
    }
    const was = events.get(id);
    if (!was) return answer(404, {});
    const { seq: _seq, ...patched } = touch({ ...was, ...body });
    return answer(200, patched);
  };
  return { fetch, events, sent, change: (id: string, patch: Record<string, unknown>) => touch({ ...events.get(id)!, ...patch }) };
}

const CALENDAR = { system: "google-calendar", calendar: "family@example.com", kind: "event", fields: { summary: "title", start: "start", end: "end", description: "heading" }, direction: "both", conflicts: "theirs" };

function synced(declared: Record<string, unknown> = CALENDAR) {
  const app = compiled({ ...HOMEFLOW, connections: { family: declared } });
  const store = storeOf(app);
  const remote = google();
  const made = connection({ name: "family", declaration: app.connections!["family"]!, app, store, calendarId: "family@example.com", token: () => "t", fetch: remote.fetch });
  return { store, remote, engine: made.engine };
}

describe("Homeflow's calendar", () => {
  it("renaming a plan item renames its event in the same change, and the next pass sends the new title", async () => {
    const { store, remote, engine } = synced();
    await engine.run();
    const e1 = [...remote.events.values()].find((event) => event["summary"] === "Huguenot Park & Costco")!;
    remote.sent.length = 0;
    store.apply({ name: "edit-plan-item", args: { id: "i1", name: "Costco" } });
    const report = await engine.run();
    expect(report.pushed).toEqual(expect.arrayContaining(["e1", "e2"]));
    expect(remote.events.get(e1.id)!["summary"]).toBe("Costco");
    expect(remote.sent.filter((write) => write["method"] === "PATCH").map((write) => write["summary"])).toEqual(["Costco", "Costco"]);
  });

  it("a computed field is sent, worked out, and a change to it in the calendar is never read back", async () => {
    const { store, remote, engine } = synced();
    await engine.run();
    const e1 = [...remote.events.values()].find((event) => event["summary"] === "Huguenot Park & Costco")!;
    expect(e1["description"]).toBe("Huguenot Park & Costco at Jacksonville");
    store.apply({ name: "edit-plan-item", args: { id: "i1", place: "Atlantic Beach" } });
    await engine.run();
    expect(remote.events.get(e1.id)!["description"]).toBe("Huguenot Park & Costco at Atlantic Beach");
    // Somebody types over it in the calendar: nothing here is worked out from that.
    remote.change(e1.id, { description: "typed in Google" });
    const report = await engine.run();
    expect(report.conflicts).toEqual([]);
    expect(node(store, "e1")["heading"]).toBeUndefined();
  });

  it("a title changed in the calendar lands on the event and goes back to its plan item", async () => {
    const { store, remote, engine } = synced();
    await engine.run();
    const e1 = [...remote.events.values()].find((event) => event["summary"] === "Huguenot Park & Costco")!;
    remote.change(e1.id, { summary: "Costco only" });
    await engine.run();
    expect(node(store, "i1")["name"]).toBe("Costco only");
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "google-calendar" });
  });

  it("graview check takes a computed field mapped into a connection that sends, and refuses it in one that only reads", () => {
    expect(errors({ ...HOMEFLOW, connections: { family: CALENDAR } })).toEqual([]);
    expect(errors({ ...HOMEFLOW, connections: { family: { ...CALENDAR, direction: "read" } } })).toContain("connection-computed-read connections.family.fields.description");
    const notion = { system: "notion", database: "0123456789abcdef0123456789abcdef", kind: "event", properties: { title: "Name", heading: { name: "Heading", type: "rich_text" } }, direction: "both" };
    expect(errors({ ...HOMEFLOW, connections: { board: notion } })).toEqual([]);
    expect(errors({ ...HOMEFLOW, connections: { board: { ...notion, direction: "read" } } })).toContain("connection-computed-read connections.board.properties.heading");
  });
});

describe("the edit vocabulary", () => {
  const plain = { ...HOMEFLOW, kinds: { ...HOMEFLOW.kinds, event: { ...HOMEFLOW.kinds.event, derives: undefined } } } as unknown as GraviewDocument;
  const edit = (doc: GraviewDocument, ...edits: Record<string, unknown>[]) => {
    const outcome = editDocument(doc, edits);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    return outcome;
  };

  it("set-derives says what a kind follows, and null takes it away; the diff says each", () => {
    const added = edit(plain, { op: "set-derives", kind: "event", derives: { from: "plan-item", via: "source", set: { title: { expr: "name" }, start: { expr: "date" } } } });
    expect(added.said).toEqual(['Each event follows its plan item through "source": title and start kept in step.']);
    expect(diffDocuments(plain, added.document).sentences).toContain('Each event follows its plan item through "source": title and start kept in step.');
    const gone = edit(added.document, { op: "set-derives", kind: "event", derives: null });
    expect(gone.said).toEqual(["Each event no longer follows another record; its records keep the values they hold."]);
    expect(gone.document.kinds["event"]!.derives).toBeUndefined();
    const refused = editDocument(plain, [{ op: "set-derives", kind: "event", derives: { from: "plan-item", via: "owner", set: { title: { expr: "name" } } } }]);
    expect(refused.ok).toBe(false);
  });

  it("a renamed kind, relation or field is followed, and a removed one takes what read it", () => {
    const doc = HOMEFLOW as unknown as GraviewDocument;
    expect(edit(doc, { op: "rename-kind", kind: "plan-item", to: "plan" }).document.kinds["event"]!.derives!.from).toBe("plan");
    expect(edit(doc, { op: "rename-relation", kind: "event", relation: "source", to: "item" }).document.kinds["event"]!.derives!.via).toBe("item");
    expect(edit(doc, { op: "rename-field", kind: "plan-item", field: "name", to: "label" }).document.kinds["event"]!.derives!.set["title"]).toEqual({ expr: "label" });
    expect(Object.keys(edit(doc, { op: "rename-field", kind: "event", field: "title", to: "summary" }).document.kinds["event"]!.derives!.set)).toContain("summary");
    expect(Object.keys(edit(doc, { op: "remove-field", kind: "plan-item", field: "place" }).document.kinds["event"]!.derives!.set)).toEqual(["title", "start", "end"]);
    expect(edit(doc, { op: "remove-relation", kind: "event", relation: "source" }).document.kinds["event"]!.derives).toBeUndefined();
  });
});
