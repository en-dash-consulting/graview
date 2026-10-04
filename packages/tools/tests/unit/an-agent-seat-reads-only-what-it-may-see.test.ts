import { bindSchema, createSchema, defineNode, nodeRef, Store, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime } from "../../src/index.js";

/**
 * AN AGENT SEAT'S TOOLS LIST AND READ ONLY WHAT ITS PRINCIPAL MAY SEE
 * (FR-02). The read tools went through `seenBy`, but two did not: the
 * affordances for a selection were derived from the whole store, so asking
 * about a record the seat may not see answered with its acts and its name;
 * and an undo refused by a later change quoted that change, whoever it was
 * hidden from.
 */
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string(), note: z.string().optional() }),
  plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" } },
});
const schema = createSchema([shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const compare = defineMutation("compare", {
  title: "Compare",
  subject: { kinds: ["enquiry"], arg: "id" },
  writes: ["note"],
  input: z.object({ id: nodeRef(["enquiry"]), other: nodeRef(["shopper"]) }),
  describe: (args, graph) => `Compare with ${(graph.getNode(args.other) as { label?: string } | undefined)?.label ?? args.other}`,
  apply(ctx, args) {
    ctx.graph.getNode(args.other);
    ctx.patchNode(args.id, { note: "compared" });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: "*" }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
    { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true },
  ],
};
const seat: Principal = { kind: "agent", id: "helper", onBehalfOf: { kind: "human", id: "shopper:bethan", roles: ["shopper"] } };
const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

function showroom() {
  const store = new Store({
    schema,
    mutations: [ask, compare],
    policy,
    snapshot: {
      nodes: [
        { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo" },
        { id: "shopper:freya", kind: "shopper", label: "Freya Davies" },
      ] as never,
      edges: [],
    },
  });
  store.apply({ name: "ask", args: { shopperId: "shopper:freya", label: "Finance on the Golf" } }, { author: { kind: "human", id: "shopper:freya", roles: ["shopper"] } });
  const mine = store.apply({ name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there" } }, { author: seat });
  store.apply({ name: "compare", args: { id: "enquiry:is-it-still-there", other: "shopper:freya" } }, { author: staff });
  return { store, mine };
}
const SECRETS = ["shopper:freya", "Freya", "Finance", "finance-on-the-golf"];

describe("an agent seat over graview mcp", () => {
  it("lists and reads only the records its principal may see", async () => {
    const { store } = showroom();
    const tools = createToolRuntime(store, { author: seat });
    for (const [name, args] of [
      ["get_graph", {}],
      ["search_graph", { query: "f" }],
      ["get_violations", {}],
    ] as const) {
      const result = await tools.call(name, args);
      expect(result.ok, name).toBe(true);
      for (const secret of SECRETS) expect(JSON.stringify(result), name).not.toContain(secret);
    }
  });

  it("derives no affordances on a record it may not see", async () => {
    const { store } = showroom();
    const result = await createToolRuntime(store, { author: seat }).call("get_affordances", { selection: ["enquiry:finance-on-the-golf"] });
    for (const secret of SECRETS) expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("refuses an undo blocked by a change it cannot see without quoting that change", async () => {
    const { store, mine } = showroom();
    const result = await createToolRuntime(store, { author: seat }).call("undo_batch", { batch: mine.batch });
    expect(result.ok).toBe(false);
    const error = !result.ok ? result.error : "";
    expect(error).toContain("a later change you cannot see");
    for (const secret of [...SECRETS, "Compare"]) expect(error).not.toContain(secret);
  });

  it("refuses a write naming a record it may not see", async () => {
    const { store } = showroom();
    const result = await createToolRuntime(store, { author: seat }).call("compare", { id: "enquiry:finance-on-the-golf", other: "shopper:bethan" });
    expect(result.ok).toBe(false);
    expect(store.graph.getNode("enquiry:finance-on-the-golf")).not.toHaveProperty("note");
    expect(() => store.apply({ name: "compare", args: { id: "enquiry:finance-on-the-golf", other: "shopper:bethan" } }, { author: seat })).toThrow(
      "“Compare” names a record that is not there.",
    );
  });
});
