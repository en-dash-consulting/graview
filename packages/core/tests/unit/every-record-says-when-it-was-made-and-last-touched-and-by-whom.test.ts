import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { computedValues } from "../../src/blocks.js";
import { arrange, arrangeable } from "../../src/arrange.js";
import { answerJob } from "../../src/jobs.js";
import { importRows } from "../../src/import/index.js";
import { parseTemplate } from "../../src/document/template-parse.js";
import { renderTemplate } from "../../src/document/template.js";
import { shapesOfSchema } from "../../src/document/rules.js";
import { planMigration, type GraviewDocument } from "../../src/document/index.js";
import { readableFields } from "../../src/schema/reading.js";
import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  snapshotHash,
  Store,
  touchedOf,
  type AnySchema,
  type GraviewApp,
  type Policy,
  type Principal,
} from "../../src/index.js";

/**
 * EVERY RECORD SAYS WHEN IT WAS MADE AND LAST TOUCHED, AND BY WHOM (Graview
 * HQ feature:f-record-last-touched). A view's nodes carried no time and no
 * last editor, no expression could read a record's last change, and an app
 * kept a date of its own by hand in fifteen acts, which missed files, links,
 * imports and tidying and read in UTC. Now every op that touches a record
 * stamps `updatedAt` and `updatedBy` on it, a create all four, kept as the
 * record's own and read wherever a field is.
 */

const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }).strict(), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }).strict() });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);

const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false });
  },
});
const putOn = defineMutation("put-on", {
  title: "Put it on a list",
  input: z.object({ listId: nodeRef(["list"]), taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "holds", from: args.listId, to: args.taskId });
  },
});
const takeOff = defineMutation("take-off", {
  title: "Take it off a list",
  input: z.object({ listId: nodeRef(["list"]), taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "holds", from: args.listId, to: args.taskId });
  },
});

const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
const bo: Principal = { kind: "human", id: "bo", roles: ["member"] };
const guest: Principal = { kind: "human", id: "gus", roles: ["guest"] };
const policy: Policy = {
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["member"], kinds: ["list", "task"] },
    { roles: ["guest"], kinds: ["list", "task"], hide: ["updatedBy", "createdBy"] },
  ],
};

/** A clock that moves a minute each time it is read, from noon UTC on Nov 20, 2026. */
function clock(start = Date.UTC(2026, 10, 20, 12, 0)): () => string {
  let at = start;
  return () => new Date((at += 60_000)).toISOString();
}

function opened(options: { now?: () => string; snapshot?: unknown; log?: unknown; horizon?: number } = {}): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    mutations: [addTask, putOn, takeOff],
    policy,
    now: options.now ?? clock(),
    snapshot: (options.snapshot ?? { nodes: [{ id: "today", kind: "list", label: "Today" }], edges: [] }) as never,
    ...(options.log ? { log: options.log as never } : {}),
    ...(options.horizon !== undefined ? { horizon: options.horizon } : {}),
  } as never);
}

const touched = (store: Store<AnySchema>, id: string) => touchedOf(store.graph.getNode(id));

describe("every op that touches a record stamps it", () => {
  it("a create sets all four: when and by whom it was made, and last touched", () => {
    const store = opened();
    const made = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann });
    const id = made.minted![0]!;
    const at = made.ops[0]!.at;
    expect(touched(store, id)).toEqual({ createdAt: at, createdBy: "ann", updatedAt: at, updatedBy: "ann" });
  });

  it("an edit of a field sets updatedAt and updatedBy and leaves when it was made", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const made = touched(store, id);
    const edit = store.apply({ name: "edit-task", args: { id, done: true } }, { author: bo });
    expect(touched(store, id)).toEqual({ createdAt: made.createdAt, createdBy: "ann", updatedAt: edit.ops[0]!.at, updatedBy: "bo" });
  });

  it("a link and an unlink touch the record at either end", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const linked = store.apply({ name: "put-on", args: { listId: "today", taskId: id } }, { author: bo });
    for (const end of ["today", id]) expect(touched(store, end)).toMatchObject({ updatedAt: linked.ops[0]!.at, updatedBy: "bo" });
    const unlinked = store.apply({ name: "take-off", args: { listId: "today", taskId: id } }, { author: ann });
    for (const end of ["today", id]) expect(touched(store, end)).toMatchObject({ updatedAt: unlinked.ops[0]!.at, updatedBy: "ann" });
  });

  it("a touch alone is no change in the diff: a record a link reached says no field changed", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const linked = store.apply({ name: "put-on", args: { listId: "today", taskId: id } }, { author: bo });
    expect(linked.diff.changedNodes).toEqual([]);
    const edit = store.apply({ name: "edit-task", args: { id, done: true } }, { author: bo });
    expect(edit.diff.changedNodes.map((change) => change.fields)).toEqual([["done"]]);
  });

  it("an undo touches what it puts back, now and by whoever took it back, and a record put back keeps when it was made", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const made = touched(store, id);
    const edit = store.apply({ name: "edit-task", args: { id, done: true } }, { author: ann });
    const undone = store.undo(edit.batch, { author: bo });
    expect(store.graph.getNode(id)).toMatchObject({ done: false, updatedAt: undone.ops[0]!.at, updatedBy: "bo", createdAt: made.createdAt, createdBy: "ann" });
    const removed = store.apply({ name: "remove-task", args: { id } }, { author: bo });
    expect(store.graph.getNode(id)).toBeUndefined();
    const back = store.undo(removed.batch, { author: bo });
    expect(touched(store, id)).toEqual({ createdAt: made.createdAt, createdBy: "ann", updatedAt: back.ops[0]!.at, updatedBy: "bo" });
  });

  it("an import stamps each record it makes, by the importer", () => {
    const store = opened();
    const result = importRows(store, "task", [{ Label: "Order boxes", Done: "no" }], { Label: "label", Done: "done" } as never, { by: bo });
    expect(result.made).toBe(1);
    const made = store.graph.nodesOfKind("task")[0]!;
    expect(touchedOf(made)).toMatchObject({ createdBy: "bo", updatedBy: "bo" });
    expect(touchedOf(made).createdAt).toBe(store.log.all().at(-1)!.at);
  });

  it("a host's own ops and the app's own tidying actor stamp what they write, the actor by its kind", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const [op] = store.append([{ author: { kind: "system", automated: true, tidying: true }, intent: "Tidy", primitives: [{ op: "patch-node", id, before: { done: false }, after: { done: true } }] }]);
    expect(touched(store, id)).toMatchObject({ updatedAt: op!.at, updatedBy: "system", createdBy: "ann" });
  });

  it("an agent acting for a person is that person; a seat's profile is the account's and the profile's", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: { kind: "agent", id: "assistant", onBehalfOf: ann } as Principal }).minted![0]!;
    expect(touched(store, id).createdBy).toBe("ann");
    store.apply({ name: "edit-task", args: { id, done: true } }, { author: { ...bo, profile: { id: "prf_mia", name: "Mia" } } as Principal });
    expect(touched(store, id).updatedBy).toBe("bo~prf_mia");
  });

  it("no act, patch or host writes them: what a patch says of them is passed over, and the op's own touch stands", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const made = touched(store, id);
    const result = store.applyPrimitives([{ op: "patch-node", id, before: {}, after: { createdAt: "1999-01-01T00:00:00.000Z", updatedBy: "mallory", done: true } }], { author: bo });
    expect(touched(store, id)).toEqual({ createdAt: made.createdAt, createdBy: "ann", updatedAt: result.ops[0]!.at, updatedBy: "bo" });
    expect(store.graph.getNode(id)).toMatchObject({ done: true });
  });
});

describe("the four are the record's own, so they go wherever it goes", () => {
  function worked(): Store<AnySchema> {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    store.apply({ name: "put-on", args: { listId: "today", taskId: id } }, { author: bo });
    store.apply({ name: "edit-task", args: { id, label: "Book the big van" } }, { author: ann });
    return store;
  }

  it("a store opened on its snapshot and log holds them as they were", () => {
    const store = worked();
    const again = opened({ snapshot: store.snapshot(), log: store.log.all() });
    expect(again.snapshot()).toEqual(store.snapshot());
  });

  it("a log folded again from its beginning stamps every record as the store did", () => {
    const store = worked();
    const folded = store.log.fold(schema, { from: store.log.epochs()[0]! });
    expect(folded.snapshot()).toEqual(store.snapshot());
    // The list was seeded, not made by an op: it says when it was last touched, and nothing of its making.
    expect(Object.keys(touchedOf(folded.getNode("today")))).toEqual(["updatedAt", "updatedBy"]);
  });

  it("survives compaction: the checkpoint's graph keeps them, and a store opened on it after the horizon still says them", () => {
    const store = worked();
    const before = store.snapshot();
    const checkpoint = store.checkpoint({ seq: store.log.length })!;
    expect(checkpoint.base.nodes).toEqual(before.nodes);
    store.compact(checkpoint);
    const reopened = new Store<AnySchema>({ schema, mutations: [addTask, putOn, takeOff], policy, now: clock(), log: store.log.all() as never, epochs: store.log.epochs() as never, horizon: store.log.horizon } as never);
    expect(reopened.snapshot().nodes).toEqual(before.nodes);
  });

  it("leaves the graph's fingerprint as it was: a graph without them hashes the same", () => {
    const store = worked();
    const bare = { nodes: store.snapshot().nodes.map(({ createdAt: _a, createdBy: _b, updatedAt: _c, updatedBy: _d, ...rest }) => rest), edges: store.snapshot().edges };
    expect(snapshotHash(bare as never)).toBe(snapshotHash(store.snapshot() as never));
    expect(store.verify().ok).toBe(true);
  });
});

describe("a store from before them reads with no time made up", () => {
  it("takes when a record was made from the op that made it, where its log still holds that op", () => {
    const store = opened();
    const made = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann });
    const id = made.minted![0]!;
    const edit = store.apply({ name: "edit-task", args: { id, done: true } }, { author: bo });
    const strip = (nodes: readonly object[]) => nodes.map((node) => Object.fromEntries(Object.entries(node).filter(([key]) => !/^(created|updated)(At|By)$/.test(key))));
    const old = opened({ snapshot: { nodes: strip(store.snapshot().nodes), edges: [] }, log: store.log.all() });
    expect(touched(old, id)).toEqual({ createdAt: made.ops[0]!.at, createdBy: "ann", updatedAt: edit.ops[0]!.at, updatedBy: "bo" });
  });

  it("says none of its making where the log no longer holds it, and nothing of a record no op it holds touched", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const edit = store.apply({ name: "edit-task", args: { id, done: true } }, { author: bo });
    const strip = (nodes: readonly object[]) => nodes.map((node) => Object.fromEntries(Object.entries(node).filter(([key]) => !/^(created|updated)(At|By)$/.test(key))));
    const old = opened({ snapshot: { nodes: strip(store.snapshot().nodes), edges: [] }, log: [edit.ops[0]!], horizon: edit.ops[0]!.seq });
    expect(touched(old, id)).toEqual({ updatedAt: edit.ops[0]!.at, updatedBy: "bo" });
    expect(touched(old, "today")).toEqual({});
    expect(touched(opened(), "today")).toEqual({});
  });
});

describe("a seat's view judges them by sight, like any field", () => {
  it("a member sees them; a guest whose sight hides who touched a record sees when, and not who", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    expect(touchedOf(store.seenBy(bo).graph.getNode(id))).toMatchObject({ createdBy: "ann", updatedBy: "ann" });
    const seen = touchedOf(store.seenBy(guest).graph.getNode(id));
    expect(seen.updatedAt).toBeDefined();
    expect(seen.createdAt).toBeDefined();
    expect(seen.updatedBy).toBeUndefined();
    expect(seen.createdBy).toBeUndefined();
  });

  it("graview check takes a sight that names them as naming fields of the kind", () => {
    const app: GraviewApp<AnySchema> = { schema, mutations: [addTask, putOn, takeOff], policy } as never;
    expect(checkApp(app).findings.filter((finding) => finding.code === "sight-names-an-unknown-field")).toEqual([]);
  });
});

describe("a list sorts, filters and groups by them", () => {
  const nodes = [
    { id: "t1", kind: "task", label: "Early", done: false, createdAt: "2026-11-18T15:00:00.000Z", updatedAt: "2026-11-21T03:00:00.000Z" },
    { id: "t2", kind: "task", label: "Late", done: false, createdAt: "2026-11-19T15:00:00.000Z", updatedAt: "2026-11-20T15:00:00.000Z" },
    { id: "t3", kind: "task", label: "Before", done: false },
  ];
  const graph = { getNode: () => undefined, allNodes: () => nodes, out: () => [], in: () => [] } as never;

  it("offers last changed and added as dates every kind may be sorted, filtered and grouped by", () => {
    const offers = arrangeable(schema, "task");
    for (const part of [offers.sorts, offers.filters, offers.groups]) {
      expect(part.filter((offer) => offer.key === "updatedAt" || offer.key === "createdAt").map((offer) => [offer.key, offer.label, offer.type])).toEqual([
        ["updatedAt", "Last changed", "date"],
        ["createdAt", "Added", "date"],
      ]);
    }
  });

  it("sorts the last changed first, a record that says none last", () => {
    const sorted = arrange(nodes as never, { sort: { by: "updatedAt", direction: "desc" } }, { schema, graph });
    expect(sorted.nodes.map((node) => node.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("filters and groups by the day on the app's clock, not UTC's", () => {
    // 03:00 UTC on Nov 21 is the evening of Nov 20 in New York.
    const onThe20th = arrange(nodes as never, { filter: [{ key: "updatedAt", value: "on:2026-11-20" }] }, { schema, graph, timeZone: "America/New_York" });
    expect(onThe20th.nodes.map((node) => node.id)).toEqual(["t1", "t2"]);
    const grouped = arrange(nodes as never, { group: { by: "updatedAt", bucket: "day" } }, { schema, graph, timeZone: "America/New_York" });
    expect(grouped.groups.map((group) => [group.key, group.nodes.map((node) => node.id)])).toEqual([
      ["2026-11-20", ["t1", "t2"]],
      ["", ["t3"]],
    ]);
  });
});

const chores: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Chores",
  brand: { timeZone: "America/New_York" },
  kinds: {
    person: { noun: "person", plural: "people", people: true, fields: { name: { type: "string", required: true } } },
    chore: {
      noun: "chore",
      plural: "chores",
      label: "{title}",
      describe: "Changed {updatedAt | relative}, on {updatedAt | date}",
      fields: { title: { type: "string", required: true }, done: { type: "boolean" } },
      computed: { changedOn: { expr: "format(updatedAt, 'MMM d')" }, lastBy: { expr: "updatedBy" } },
    },
  },
  acts: { "add-chore": { title: "Add a chore", creates: "chore" } },
  rules: {
    "ann-finishes-hers": { title: "Ann finishes what she adds", over: "chore", when: "createdBy == 'ann'", require: "done == true", says: "{title} was added by Ann and is not done" },
  },
  purpose: { for: "A household", jobs: [{ name: "bo-touched", ask: "What did Bo change last?", kind: "chore", where: "updatedBy == 'bo'", sort: "updatedAt" }] },
} as unknown as GraviewDocument;

describe("templates, rules, computed fields and a job's where read them", () => {

  function choreStore(): { store: Store<AnySchema>; app: GraviewApp<AnySchema> } {
    const compiled = compileDocument(chores);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const app = compiled.app as GraviewApp<AnySchema>;
    // 03:30 UTC on Nov 21: still Nov 20 in New York.
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], appTimeZone: "America/New_York", now: clock(Date.UTC(2026, 10, 21, 3, 30)) } as never);
    return { store, app };
  }

  it("compiles a document that reads them in a describe, a computed field, a rule and a job", () => {
    expect(compileDocument(chores).ok).toBe(true);
  });

  it("a template says {updatedAt | relative} and {updatedAt | date} on the app's clock", () => {
    const { store } = choreStore();
    const id = store.apply({ name: "add-chore", args: { title: "Sweep" } }, { author: { kind: "human", id: "ann" } }).minted![0]!;
    const said = renderTemplate(parseTemplate("Changed {updatedAt | relative}, on {updatedAt | date}"), {
      node: store.graph.getNode(id)!,
      kinds: shapesOfSchema(store.schema),
      graph: store.graph as never,
      today: "2026-11-20",
      money: { timeZone: "America/New_York", locale: "en-US" } as never,
    });
    expect(said).toBe("Changed today, on Nov 20, 2026");
  });

  it("a record from before them says none, rather than a time", () => {
    const { store } = choreStore();
    const said = renderTemplate(parseTemplate("Changed {updatedAt | relative}"), { node: { id: "c0", kind: "chore", title: "Old" }, kinds: shapesOfSchema(store.schema), today: "2026-11-20" });
    expect(said).toBe("Changed —");
  });

  it("a computed field reads them, on the app's clock", () => {
    const { store } = choreStore();
    const id = store.apply({ name: "add-chore", args: { title: "Sweep" } }, { author: { kind: "human", id: "bo" } }).minted![0]!;
    const values = computedValues(store.schema, store.graph as never, store.graph.getNode(id) as never, { timeZone: "America/New_York" }).values;
    expect(values).toMatchObject({ changedOn: "Nov 20", lastBy: "bo" });
  });

  it("a rule reads who made a record", () => {
    const { store } = choreStore();
    store.apply({ name: "add-chore", args: { title: "Sweep" } }, { author: { kind: "human", id: "ann" } });
    store.apply({ name: "add-chore", args: { title: "Mop" } }, { author: { kind: "human", id: "bo" } });
    expect(store.violations().map((violation) => violation.message)).toEqual([expect.stringContaining("Sweep was added by Ann and is not done")]);
  });

  it("a job's where reads who last touched a record, and its sort when", () => {
    const { store, app } = choreStore();
    const sweep = store.apply({ name: "add-chore", args: { title: "Sweep" } }, { author: { kind: "human", id: "bo" } }).minted![0]!;
    const mop = store.apply({ name: "add-chore", args: { title: "Mop" } }, { author: { kind: "human", id: "ann" } }).minted![0]!;
    store.apply({ name: "edit-chore", args: { id: mop, done: true } }, { author: { kind: "human", id: "bo" } });
    const job = app.purpose!.jobs![0]!;
    expect(answerJob(store, job, { kind: "human", id: "bo" }).ids).toEqual([sweep, mop]);
  });
});

describe("graview check refuses a kind that declares one of the four", () => {
  it("in TypeScript: a field, a relation or a computed value of one of those names", () => {
    const stamped = defineNode("note", { fields: z.object({ title: z.string(), updatedAt: z.string().optional() }), edges: { createdBy: { to: ["note"] } } });
    const app: GraviewApp<AnySchema> = { schema: createSchema([stamped]), mutations: [] } as never;
    const taken = checkApp(app).findings.filter((finding) => finding.code === "touched-field-taken");
    expect(taken.map((finding) => [finding.severity, finding.where])).toEqual([
      ["error", 'defineNode("note").fields.updatedAt'],
      ["error", 'defineNode("note").edges.createdBy'],
    ]);
  });

  it("in a document, where it is compiled", () => {
    const document = { ...chores, kinds: { ...chores.kinds, chore: { ...chores.kinds["chore"]!, fields: { ...chores.kinds["chore"]!.fields, updatedBy: { type: "string" } } } } } as GraviewDocument;
    const compiled = compileDocument(document);
    expect(compiled.ok).toBe(false);
    expect(compiled.findings.filter((finding) => finding.code === "touched-field-taken").map((finding) => finding.path)).toEqual(["kinds.chore.fields.updatedBy"]);
  });
});

describe("what keeps the four as they were", () => {
  const stamped = { createdAt: "2026-11-01T10:00:00.000Z", createdBy: "ann", updatedAt: "2026-11-02T10:00:00.000Z", updatedBy: "bo" };

  it("a document's migration that changes nothing of a record touches nothing, and a kind renamed keeps when each was made", () => {
    const graph = { nodes: [{ id: "c1", kind: "chore", title: "Sweep", ...stamped }, { id: "p1", kind: "person", name: "Ann", ...stamped }], edges: [] };
    const kinds = chores.kinds as Record<string, { fields: object }>;
    const plusField = { ...chores, kinds: { ...kinds, chore: { ...kinds["chore"]!, fields: { ...kinds["chore"]!.fields, room: { type: "string" } } } } } as unknown as GraviewDocument;
    expect(planMigration(chores, plusField, graph as never).primitives).toEqual([]);
    const { person, ...rest } = kinds;
    const renamed = { ...chores, kinds: { ...rest, member: { ...person!, renamedFrom: "person" } } } as unknown as GraviewDocument;
    const made = planMigration(chores, renamed, graph as never).primitives.find((primitive) => primitive.op === "add-node") as { node: object } | undefined;
    expect(made && touchedOf(made.node)).toEqual(stamped);
  });

  it("a pending change taken back by a rebase takes its touch back with it", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const before = touched(store, id);
    const pending = store.apply({ name: "edit-task", args: { id, done: true } }, { author: bo });
    expect(touched(store, id).updatedBy).toBe("bo");
    store.rebase({ confirmed: [], pending: [], drop: [pending.batch] });
    expect(touched(store, id)).toEqual(before);
  });

  it("a record's page and card say its own fields, not the four, unless the declaration asks for them", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const keys = readableFields(store.graph.getNode(id) as never, schema.tryDefinition("task") as never, {}).map((field) => field.key);
    expect(keys).toContain("done");
    expect(keys.filter((key) => /^(created|updated)(At|By)$/.test(key))).toEqual([]);
  });
});
