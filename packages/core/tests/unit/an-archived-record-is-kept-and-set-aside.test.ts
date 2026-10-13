import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument } from "../../src/check.js";
import { computedValues, factValues } from "../../src/blocks.js";
import { arrange, formatArrangement, parseArrangement } from "../../src/arrange.js";
import { actsOn, search } from "../../src/search.js";
import {
  ARCHIVED,
  bindSchema,
  createSchema,
  defineNode,
  deriveArchiveMutations,
  Graph,
  isArchived,
  nodeRef,
  PermissionDeniedError,
  Store,
  type AnySchema,
  type ApplyOptions,
  type GraviewApp,
  type Policy,
  type Principal,
} from "../../src/index.js";

/**
 * AN ARCHIVED STATE ON RECORDS (FR-173). A record was present or removed,
 * so tidying an app meant losing things. Archive keeps a record — its
 * fields, its links, its history — and takes it out of lists, counts,
 * computed fields and rules by default; a read by id, search and its own
 * page still find it. Merge is two records that are one: the kept one
 * takes the links, the other is archived with `mergedInto` on its op.
 */

const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }).strict(), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }).strict() });
const schema = createSchema([list, task]);
const { defineMutation, defineGraphInvariant } = bindSchema(schema);

const addTask = defineMutation("add-task", {
  title: "Add a task",
  subject: { kinds: ["list"], arg: "listId" },
  creates: ["task"],
  input: z.object({ listId: nodeRef(["list"]), label: z.string().min(1) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label, done: false });
    ctx.addEdge({ kind: "holds", from: args.listId, to: id });
  },
});
const addList = defineMutation("add-list", {
  title: "Add a list",
  creates: ["list"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "list"), kind: "list", label: args.label });
  },
});
const howMany = defineGraphInvariant("at-most-two-open", {
  evaluate: ({ graph }) =>
    graph.nodesOfKind("task").filter((t) => !t.done).length > 2
      ? [{ invariant: "at-most-two-open", label: "At most two open", message: "More than two tasks are open.", nodeIds: [], repairs: [] }]
      : [],
});
const everOpened = defineGraphInvariant("never-more-than-three", {
  evaluate: ({ graph }) =>
    graph.nodesOfKind("task", { archived: "all" }).length > 3
      ? [{ invariant: "never-more-than-three", label: "Never more than three", message: "More than three tasks were ever made.", nodeIds: [], repairs: [] }]
      : [],
});

const seed = {
  nodes: [
    { id: "today", kind: "list", label: "Today" },
    { id: "later", kind: "list", label: "Later" },
    { id: "t-milk", kind: "task", label: "Buy milk", done: false },
    { id: "t-milk-2", kind: "task", label: "Milk", done: false },
    { id: "t-van", kind: "task", label: "Book the van", done: false },
    { id: "t-box", kind: "task", label: "Order boxes", done: false },
  ],
  edges: [
    { kind: "holds", from: "today", to: "t-milk" },
    { kind: "holds", from: "later", to: "t-milk-2" },
    { kind: "holds", from: "today", to: "t-van" },
    { kind: "holds", from: "today", to: "t-box" },
  ],
};
// A host archives through the kind's derived act, as any act is run.
type Held = Store<typeof schema>;
const on = (act: string, store: Held, id: string, args: Record<string, unknown>, options: ApplyOptions) =>
  store.apply({ name: `${act}-${store.graph.getNode(id)!.kind}`, args: { id, ...args } }, options);
const archive = (store: Held, id: string, options: ApplyOptions = {}) => on("archive", store, id, {}, options);
const unarchive = (store: Held, id: string, options: ApplyOptions = {}) => on("unarchive", store, id, {}, options);
const merge = (store: Held, id: string, into: string, options: ApplyOptions = {}) => on("merge", store, id, { into }, options);

const storeOf = (options: { policy?: Policy } = {}) =>
  new Store({ schema, mutations: [addTask, addList], invariants: [howMany, everOpened], snapshot: structuredClone(seed) as never, ...options });

describe("archive and unarchive", () => {
  it("are derived acts on every kind, not destructive, permitted through the acts that make the kind", () => {
    const derived = deriveArchiveMutations(schema, [addTask, addList]);
    expect(derived.map((m) => m.name)).toEqual(["archive-list", "unarchive-list", "merge-list", "archive-task", "unarchive-task", "merge-task"]);
    expect(derived.find((m) => m.name === "unarchive-task")?.title).toBe("Bring it back");
    expect(derived.every((m) => !m.destructive)).toBe(true);
    expect(storeOf().allMutations().map((m) => m.name)).toEqual(expect.arrayContaining(["archive-task", "unarchive-task", "merge-task"]));
  });

  it("keep the record, its fields and its links, and take it out of every list and count", () => {
    const store = storeOf();
    const result = store.apply({ name: "archive-task", args: { id: "t-van" } });
    expect(result.intent).toBe("Archive Book the van");
    const van = store.graph.getNode("t-van");
    expect(van).toMatchObject({ label: "Book the van", done: false, [ARCHIVED]: true });
    expect(isArchived(van)).toBe(true);
    expect(store.graph.isArchived("t-van")).toBe(true);
    expect(store.graph.has("t-van")).toBe(true);
    // Out of lists, counts and walks.
    expect(store.graph.nodesOfKind("task").map((n) => n.id)).toEqual(["t-milk", "t-milk-2", "t-box"]);
    expect(store.graph.allNodes().map((n) => n.id)).not.toContain("t-van");
    expect(store.graph.count("task")).toBe(3);
    expect(store.graph.out("today", "holds").map((n) => n.id)).toEqual(["t-milk", "t-box"]);
    expect(store.graph.allEdges().some((e) => e.to === "t-van")).toBe(false);
    // Kept, and reached when asked for.
    expect(store.graph.outEdges("today").map((e) => e.to)).toContain("t-van");
    expect(store.graph.nodesOfKind("task", { archived: true }).map((n) => n.id)).toEqual(["t-van"]);
    expect(store.graph.nodesOfKind("task", { archived: "all" })).toHaveLength(4);
    expect(store.graph.count("task", { archived: true })).toBe(1);
    expect(store.graph.count("task", { archived: "all" })).toBe(4);
    expect(store.graph.out("today", "holds", { archived: "all" }).map((n) => n.id)).toEqual(["t-milk", "t-van", "t-box"]);
    expect(store.graph.allEdges({ archived: true }).map((e) => e.to)).toEqual(["t-van"]);
    // What is stored holds it, marked.
    expect(store.snapshot().nodes.find((n) => n.id === "t-van")).toMatchObject({ [ARCHIVED]: true });
  });

  it("is said by the archived record's own links: a walk from it reaches what it is tied to", () => {
    const store = storeOf();
    archive(store, "t-van");
    expect(store.graph.in("t-van", "holds").map((n) => n.id)).toEqual(["today"]);
  });

  it("brings it back as it was, and is undone like any act", () => {
    const store = storeOf();
    const archived = archive(store, "t-van");
    store.undo(archived.batch);
    expect(store.graph.isArchived("t-van")).toBe(false);
    expect(store.graph.getNode("t-van")).not.toHaveProperty(ARCHIVED);
    archive(store, "t-van");
    const back = unarchive(store, "t-van");
    expect(back.intent).toBe("Bring back Book the van");
    expect(store.graph.out("today", "holds").map((n) => n.id)).toEqual(["t-milk", "t-van", "t-box"]);
    expect(store.graph.getNode("t-van")).not.toHaveProperty(ARCHIVED);
  });

  it("changes nothing when there is nothing to change, so it is not offered there", () => {
    const store = storeOf();
    expect(store.wouldChange({ name: "unarchive-task", args: { id: "t-van" } })).toBe(false);
    expect(store.wouldChange({ name: "archive-task", args: { id: "t-van" } })).toBe(true);
    archive(store, "t-van");
    expect(store.wouldChange({ name: "archive-task", args: { id: "t-van" } })).toBe(false);
    expect(store.wouldChange({ name: "unarchive-task", args: { id: "t-van" } })).toBe(true);
  });

  it("survives being stored and loaded, and a graph that judges writes against a strict kind", () => {
    const store = storeOf();
    archive(store, "t-van");
    const again = new Store({ schema, mutations: [addTask], snapshot: store.snapshot(), log: store.log.all() });
    expect(again.graph.isArchived("t-van")).toBe(true);
    expect(again.graph.count("task")).toBe(3);
    expect(store.verify().ok).toBe(true);
    // An archived record written fresh fits its kind: the mark is not a field.
    const graph = new Graph(schema);
    graph.applyPrimitives([{ op: "add-node", node: { id: "x", kind: "task", label: "Kept", done: true, [ARCHIVED]: true } }]);
    expect(graph.isArchived("x")).toBe(true);
    expect(again.findings()).toEqual([]);
  });

  it("leaves the rules: an archived record is judged by none that does not ask for it", () => {
    const store = storeOf();
    store.apply({ name: "add-task", args: { listId: "later", label: "Pack" } });
    const names = () => store.violations().map((v) => v.invariant).sort();
    expect(names()).toEqual(["at-most-two-open", "never-more-than-three"]);
    archive(store, "t-milk-2");
    archive(store, "t-box");
    archive(store, "t-van");
    // Two open tasks are live; five were made, and the rule that asks counts them.
    expect(names()).toEqual(["never-more-than-three"]);
  });
});

describe("merge", () => {
  it("moves the duplicate's links to the kept record, archives the duplicate, and says mergedInto on its op", () => {
    const store = storeOf();
    const result = merge(store, "t-milk-2", "t-milk");
    expect(result.intent).toBe("Merge Milk into Buy milk");
    expect(result.ops[0]?.mergedInto).toBe("t-milk");
    expect(store.graph.isArchived("t-milk-2")).toBe(true);
    expect(store.graph.getNode("t-milk-2")).toMatchObject({ label: "Milk" });
    expect(store.graph.in("t-milk", "holds").map((n) => n.id).sort()).toEqual(["later", "today"]);
    expect(store.graph.inEdges("t-milk-2")).toEqual([]);
    // Both histories kept: the duplicate's ops are still in the log.
    expect(store.log.all().some((op) => op.writes.includes("t-milk-2"))).toBe(true);
  });

  it("is undone as one", () => {
    const store = storeOf();
    const result = merge(store, "t-milk-2", "t-milk");
    store.undo(result.batch);
    expect(store.graph.isArchived("t-milk-2")).toBe(false);
    expect(store.graph.in("t-milk", "holds").map((n) => n.id)).toEqual(["today"]);
    expect(store.graph.in("t-milk-2", "holds").map((n) => n.id)).toEqual(["later"]);
  });

  it("does not merge a record into itself, or into an archived one", () => {
    const store = storeOf();
    expect(() => merge(store, "t-milk", "t-milk")).toThrow(/into itself/);
    archive(store, "t-box");
    expect(() => merge(store, "t-milk", "t-box")).toThrow(/archived record/);
  });
});

describe("archive under the policy and the seat's sight", () => {
  const policy: Policy = {
    roles: ["keeper", "maker", "reader"],
    grants: [
      { roles: ["keeper"], mutations: ["archive-task", "unarchive-task"] },
      { roles: ["maker"], mutations: ["add-task"] },
    ],
    sees: [
      { roles: ["keeper", "maker"], kinds: ["list", "task"] },
      { roles: ["reader"], kinds: ["list"] },
    ],
  };
  const keeper: Principal = { kind: "human", id: "k", roles: ["keeper"] };
  const maker: Principal = { kind: "human", id: "m", roles: ["maker"] };
  const reader: Principal = { kind: "human", id: "r", roles: ["reader"] };

  it("lets a grant name archive-<kind> on its own", () => {
    const store = storeOf({ policy });
    archive(store, "t-van", { author: keeper });
    expect(store.graph.isArchived("t-van")).toBe(true);
    // Nobody granted merge-task to a keeper.
    expect(() => merge(store, "t-milk-2", "t-milk", { author: keeper })).toThrow(PermissionDeniedError);
  });

  it("rides the acts that make the kind, as remove does", () => {
    const store = storeOf({ policy });
    expect(store.permittedMutations(maker).map((m) => m.name)).toEqual(expect.arrayContaining(["archive-task", "unarchive-task", "merge-task"]));
    expect(store.permittedMutations(maker).map((m) => m.name)).not.toContain("archive-list");
  });

  it("does not reach a record the seat may not see", () => {
    const open: Policy = { ...policy, grants: [{ roles: "*", mutations: "*" }] };
    const store = storeOf({ policy: open });
    expect(() => archive(store, "t-van", { author: reader })).toThrow();
    expect(store.graph.isArchived("t-van")).toBe(false);
  });

  it("is served to a seat as the graph is: out of its lists, found by its id", () => {
    const store = storeOf({ policy });
    archive(store, "t-van", { author: keeper });
    const seen = store.seenBy(maker);
    expect(seen.graph.nodesOfKind("task").map((n) => n.id)).not.toContain("t-van");
    expect(seen.graph.nodesOfKind("task", { archived: true }).map((n) => n.id)).toEqual(["t-van"]);
    expect(seen.graph.getNode("t-van")).toMatchObject({ [ARCHIVED]: true });
  });
});

describe("a document's computed fields and rules", () => {
  const doc = {
    format: "graview-document",
    formatVersion: 1,
    name: "Moves",
    kinds: {
      box: {
        fields: { title: { type: "string", required: true } },
        computed: { setAside: "archived()" },
      },
    },
    computed: {
      boxes: "count(all('box'))",
      everyBox: "count(all('box', 'all'))",
      archivedBoxes: "count(all('box', true))",
      asked: "count(all('box', 'all') where archived())",
    },
    rules: {
      "few-boxes": { over: "graph", require: "count(all('box')) < 3", says: "Too many boxes" },
    },
    policy: { grants: [{ roles: "*", mutations: "*" }] },
  };
  const compiled = compileDocument(doc);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = () =>
    new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      invariants: app.invariants ?? [],
      ...(app.policy ? { policy: app.policy } : {}),
      snapshot: {
        nodes: [
          { id: "b1", kind: "box", title: "Books" },
          { id: "b2", kind: "box", title: "Plates" },
          { id: "b3", kind: "box", title: "Lamps" },
        ],
        edges: [],
      } as never,
    });

  it("count only live records, unless they ask", () => {
    const moves = store();
    expect(moves.violations().map((v) => v.invariant)).toEqual(["few-boxes"]);
    moves.apply({ name: "archive-box", args: { id: "b3" } });
    expect(moves.violations()).toEqual([]);
    expect(factValues(moves.schema, moves.graph).values).toEqual({ boxes: 2, everyBox: 3, archivedBoxes: 1, asked: 1 });
    expect(computedValues(moves.schema, moves.graph, moves.graph.getNode("b3")!).values).toEqual({ setAside: true });
    expect(computedValues(moves.schema, moves.graph, moves.graph.getNode("b1")!).values).toEqual({ setAside: false });
  });

  it("let a grant name the derived acts", () => {
    const granted = compileDocument({ ...doc, roles: ["mover"], policy: { grants: [{ roles: ["mover"], mutations: ["archive-box", "unarchive-box", "merge-box"] }] } });
    expect(granted.ok).toBe(true);
  });
});

describe("search and lenses", () => {
  it("search still finds an archived record, marked, after the live ones; asked for live only, it does not", () => {
    const store = storeOf();
    archive(store, "t-milk-2");
    const hits = search(store, "milk").hits.filter((hit) => hit.about === "node");
    expect(hits.map((hit) => hit.about === "node" && [hit.id, hit.archived ?? false])).toEqual([
      ["t-milk", false],
      ["t-milk-2", true],
    ]);
    expect(search(store, "milk", { archived: false }).hits.map((hit) => hit.about === "node" && hit.id)).toEqual(["t-milk"]);
    expect(search(store, "is:archived").hits.map((hit) => hit.about === "node" && hit.id)).toEqual(["t-milk-2"]);
    // On the archived record, "Bring it back" is offered and archive and merge are not.
    const acts = actsOn(store, "t-milk-2", "").map((hit) => hit.name);
    expect(acts).toContain("unarchive-task");
    expect(acts).not.toContain("archive-task");
    expect(acts).not.toContain("merge-task");
  });

  it("an arrangement says which records, and carries it as a word", () => {
    const store = storeOf();
    archive(store, "t-van");
    const ctx = { schema: store.schema as AnySchema, graph: store.graph as never };
    const all = store.graph.nodesOfKind("task", { archived: "all" });
    expect(arrange(all, { archived: true }, ctx).nodes.map((n) => n.id)).toEqual(["t-van"]);
    expect(arrange(all, { archived: false }, ctx).nodes.map((n) => n.id)).toEqual(["t-milk", "t-milk-2", "t-box"]);
    expect(arrange(all, { archived: "all" }, ctx).nodes).toHaveLength(4);
    expect(formatArrangement({ archived: "all" })).toEqual({ archived: "all" });
    expect(parseArrangement({ archived: "true" })).toEqual({ archived: true });
    expect(parseArrangement({ archived: "nonsense" })).toEqual({});
  });
});
