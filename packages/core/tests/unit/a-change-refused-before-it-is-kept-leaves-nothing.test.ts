import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, Store, z, type AnySchema, type PlannedChange } from "../../src/index.js";

/**
 * A CHANGE REFUSED BEFORE IT IS KEPT LEAVES NOTHING.
 *
 * `applyAll` compiles and applies each call in turn, so the second can read
 * what the first made. A batch refused part way put the graph back and left
 * the first call's op in the log — a log that no longer folded to the graph,
 * and an op a host would flush and push for a change nobody made. Now the
 * log is cut back with the graph. And a host can refuse a change by what it
 * would do (`ApplyOptions.admit`): asked once the calls are compiled and
 * applied, before anything is kept, with the store's own plan of them — the
 * ops, the primitives, the records and links added, removed and changed,
 * and how many the store would hold. Whatever it throws goes on up, and the
 * graph, the log and the subscribers are as if the change was never asked.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), edges: { after: { to: ["task"], cardinality: "many" } } });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add",
  creates: ["task"],
  input: z.object({ id: z.string(), after: z.string().optional() }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.id });
    if (args.after) ctx.addEdge({ kind: "after", from: args.id, to: args.after });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: z.string(), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const drop = defineMutation("drop", {
  title: "Drop",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: z.string() }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const aStore = () =>
  new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [add, rename, drop] as never,
    snapshot: { nodes: [{ id: "a", kind: "task", label: "A" }, { id: "b", kind: "task", label: "B" }], edges: [{ kind: "after", from: "b", to: "a" }] } as never,
  });
const NO = new Error("Not admitted.");

describe("a change refused before it is kept leaves nothing", () => {
  it("cuts the log back with the graph when a batch is refused part way", () => {
    const store = aStore();
    const before = store.snapshot();
    expect(() => store.applyAll([{ name: "add", args: { id: "c" } }, { name: "rename", args: { id: "nope", label: "N" } }])).toThrow();
    expect(store.log.length).toBe(0);
    expect(store.snapshot()).toEqual(before);
  });

  it("asks admit with the store's own plan, and keeps nothing it refuses", () => {
    const store = aStore();
    const before = store.snapshot();
    const told: unknown[] = [];
    store.subscribe((change) => told.push(change));
    const planned: PlannedChange[] = [];
    const admit = (plan: PlannedChange) => {
      planned.push(plan);
      throw NO;
    };
    expect(() => store.applyAll([{ name: "add", args: { id: "c", after: "a" } }, { name: "rename", args: { id: "a", label: "A2" } }, { name: "drop", args: { id: "b" } }], { admit })).toThrow(NO);
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({ added: { nodes: 1, edges: 1 }, removed: { nodes: 1, edges: 1 }, changed: { nodes: 1 }, nodesAfter: 2, edgesAfter: 1 });
    expect(planned[0]!.ops).toHaveLength(3);
    expect(planned[0]!.primitives.map((primitive) => primitive.op)).toEqual(planned[0]!.ops.flatMap((op) => op.primitives.map((primitive) => primitive.op)));
    expect(store.log.length).toBe(0);
    expect(store.snapshot()).toEqual(before);
    expect(told).toEqual([]);

    // Admitted, it is kept as it was planned.
    const result = store.applyAll([{ name: "add", args: { id: "c", after: "a" } }], { admit: () => undefined });
    expect(result.ops).toHaveLength(1);
    expect(store.log.length).toBe(1);
    expect(told).toHaveLength(1);
  });

  it("asks admit of an undo too, and keeps nothing it refuses", () => {
    const store = aStore();
    const { batch } = store.applyAll([{ name: "add", args: { id: "c" } }, { name: "add", args: { id: "d" } }]);
    const before = store.snapshot();
    const planned: PlannedChange[] = [];
    expect(() =>
      store.undo(batch, {
        admit: (plan) => {
          planned.push(plan);
          throw NO;
        },
      }),
    ).toThrow(NO);
    expect(planned[0]).toMatchObject({ removed: { nodes: 2, edges: 0 }, nodesAfter: 2 });
    expect(store.log.length).toBe(2);
    expect(store.snapshot()).toEqual(before);
  });
});
