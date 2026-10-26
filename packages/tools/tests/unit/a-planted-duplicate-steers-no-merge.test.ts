import { bindSchema, createSchema, defineNode, isArchived, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "@graview/core";
import { suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { dream, TIDYING_ACTOR } from "../../src/tidy.js";

/*
 * A PLANTED DUPLICATE STEERS NO MERGE. A member may add vendors and tasks,
 * and may not merge or archive the owner's vendor. Were the record that
 * stays the one with the most links, the member could add a vendor of the
 * same name, link two tasks of their own to it, and have the app's own
 * actor — a system author no policy refuses — merge the owner's vendor
 * into theirs, archiving it and moving the owner's task over. The record
 * that stays is the one made first; a merge of records two people made is
 * a person's to accept, never applied on its own; and where the two have
 * one name, the sentence says which is which.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
const task = defineNode("task", { fields: z.object({ label: z.string() }), edges: { vendor: { to: ["vendor"], cardinality: "one" } } });
const schema = createSchema([vendor, task]);
const { defineMutation } = bindSchema(schema);
const addVendor = defineMutation("add-vendor", {
  title: "Add a vendor",
  creates: ["vendor"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "vendor"), kind: "vendor", label: args.label });
  },
});
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string(), vendor: nodeRef(["vendor"]) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label });
    ctx.addEdge({ kind: "vendor", from: id, to: args.vendor });
  },
});
const policy = { roles: ["owner", "member"], grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["member"], mutations: ["add-vendor", "add-task"] }] } as unknown as Policy;
const owner: Principal = { kind: "human", id: "person:o", roles: ["owner"] };
const member: Principal = { kind: "human", id: "person:m", roles: ["member"] };
const LATER = "2026-10-03T09:00:00.000Z";

function world(planter: Principal = member) {
  const store = new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [addVendor, addTask] as never,
    policy,
    now: () => "2026-10-01T09:00:00.000Z",
    snapshot: { nodes: [{ id: "vendor:owner", kind: "vendor", label: "Northwind Parts" }, { id: "task:o1", kind: "task", label: "Owner order" }] as never, edges: [{ kind: "vendor", from: "task:o1", to: "vendor:owner" }] as never },
  });
  store.apply({ name: "add-vendor", args: { label: "Northwind Parts" } } as never, { author: planter });
  const planted = (store.graph.nodesOfKind("vendor" as never) as unknown as { id: string }[]).find((one) => one.id !== "vendor:owner")!.id;
  store.apply({ name: "add-task", args: { label: "x1", vendor: planted } } as never, { author: planter });
  store.apply({ name: "add-task", args: { label: "x2", vendor: planted } } as never, { author: planter });
  return { store, planted };
}
const vendorOf = (store: Store<AnySchema>, id: string) => (store.graph.out(id, "vendor" as never) as unknown as { id: string }[]).map((one) => one.id);

describe("a duplicate a member planted with more links", () => {
  it("is the one proposed to merge away: the record made first stays", async () => {
    const { store, planted } = world();
    await dream(store, { now: LATER });
    expect(suggestions(store).map((one) => one.calls)).toEqual([[{ name: "merge-vendor", args: { id: planted, into: "vendor:owner" } }]]);
  });

  it("is not merged on its own, even where the host lets the actor apply what it is sure of: two people made the two", async () => {
    const { store, planted } = world();
    const report = await dream(store, { principal: TIDYING_ACTOR, now: LATER, applyAtLeast: 0.9 });
    expect(report.outcomes.map((one) => one.outcome)).toEqual(["suggested"]);
    expect(isArchived(store.graph.getNode("vendor:owner") as never)).toBe(false);
    expect(isArchived(store.graph.getNode(planted) as never)).toBe(false);
    expect(vendorOf(store, "task:o1")).toEqual(["vendor:owner"]);
  });

  it("says, where the two have one name, which is merged into which", async () => {
    const { store, planted } = world();
    await dream(store, { now: LATER });
    const [merge] = suggestions(store);
    expect(merge!.intent).toContain(planted);
    expect(merge!.intent).toContain("vendor:owner");
    expect(merge!.intent.indexOf(planted)).toBeLessThan(merge!.intent.indexOf("vendor:owner"));
  });
});

describe("two duplicates one person made", () => {
  it("are merged on its own where the host lets the actor apply what it is sure of", async () => {
    const store = new Store<AnySchema>({ schema: schema as unknown as AnySchema, mutations: [addVendor, addTask] as never, policy, now: () => "2026-10-01T09:00:00.000Z" });
    store.apply({ name: "add-vendor", args: { label: "Northwind Parts" } } as never, { author: owner });
    store.apply({ name: "add-vendor", args: { label: "Northwind Parts" } } as never, { author: owner });
    const report = await dream(store, { principal: TIDYING_ACTOR, now: LATER, applyAtLeast: 0.9 });
    expect(report.outcomes.map((one) => one.outcome)).toEqual(["applied"]);
  });
});
