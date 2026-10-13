import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, deriveAffordances } from "../../src/index.js";

/**
 * AN AGENT'S FIND TAKES `archived` (FR-173). An archived record is set
 * aside: the agent's search_graph and get_graph reach the live records by
 * default, and the archived ones when asked (`true`, or `"all"` for both);
 * get_node on one says it is archived, and the acts offered on it are
 * "Bring it back", never archive or merge again.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-vendor", {
  title: "Add a vendor",
  creates: ["vendor"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "vendor"), kind: "vendor", label: args.label });
  },
});
const shop = () => {
  const store = new Store({
    schema,
    mutations: [add],
    snapshot: {
      nodes: [
        { id: "v-bloom", kind: "vendor", label: "Bloom florist" },
        { id: "v-petal", kind: "vendor", label: "Petal florist" },
      ] as never,
      edges: [],
    },
  });
  store.apply({ name: "archive-vendor", args: { id: "v-petal" } });
  return store;
};
const ids = (data: unknown): string[] => JSON.stringify(data).match(/v-(bloom|petal)/g)?.filter((id, at, all) => all.indexOf(id) === at) ?? [];

describe("an agent's find", () => {
  it("reaches the live records unless it asks for the archived", async () => {
    const tools = createToolRuntime(shop(), {});
    const live = await tools.call("search_graph", { query: "florist" });
    expect(live.ok && ids(live.data)).toEqual(["v-bloom"]);
    const every = await tools.call("search_graph", { query: "florist", archived: "all" });
    expect(every.ok && ids(every.data)).toEqual(["v-bloom", "v-petal"]);
    const archived = await tools.call("search_graph", { query: "florist", archived: true });
    expect(archived.ok && ids(archived.data)).toEqual(["v-petal"]);
    const graph = await tools.call("get_graph", {});
    expect(graph.ok && ids(graph.data)).toEqual(["v-bloom"]);
    const whole = await tools.call("get_graph", { archived: "all" });
    expect(whole.ok && ids(whole.data)).toEqual(["v-bloom", "v-petal"]);
  });

  it("reads an archived record by its id, said archived, and is offered only the way back", async () => {
    const store = shop();
    const tools = createToolRuntime(store, {});
    const read = await tools.call("get_node", { id: "v-petal" });
    expect(read.ok && (read.data as { archived?: boolean }).archived).toBe(true);
    const offered = deriveAffordances(store, ["v-petal"]).affordances.map((affordance) => affordance.mutation);
    expect(offered).toContain("unarchive-vendor");
    expect(offered).not.toContain("archive-vendor");
    expect(offered).not.toContain("merge-vendor");
    const back = await tools.call("unarchive-vendor", { id: "Petal florist" });
    expect(back.ok).toBe(true);
    expect(store.graph.isArchived("v-petal")).toBe(false);
  });
});
