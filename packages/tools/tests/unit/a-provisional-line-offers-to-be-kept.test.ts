import { createSchema, defineNode, KEEP_LINK, Store } from "@graview/core";
import { isProvisional } from "@graview/core/provenance";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyAffordance, deriveAffordances } from "../../src/index.js";

/**
 * A LINE MADE LESS THAN SURE OFFERS TO BE KEPT (FR-172). Selected, a
 * provisional link's first act is "Keep this link", one press, its reason
 * the basis its maker gave; pressed by a person, the link is ordinary and
 * the offer is gone. An ordinary line never offers it.
 */
const lease = defineNode("lease", { fields: z.object({ label: z.string() }), edges: { about: { to: ["property"], description: "what it is about" } } });
const property = defineNode("property", { fields: z.object({ label: z.string() }) });
const schema = createSchema([lease, property]);
const edge = { kind: "about", from: "lease:harbor", to: "property:harbor" };

const storeOf = () => {
  const store = new Store({
    schema,
    mutations: [],
    snapshot: { nodes: [{ id: "lease:harbor", kind: "lease", label: "Harbor lease" }, { id: "property:harbor", kind: "property", label: "12 Harbor Street" }] as never, edges: [] },
  });
  store.append([{ primitives: [{ op: "add-edge", edge }], author: { kind: "agent", id: "tidying", name: "Graview, tidying" }, intent: "Link the lease", lineage: { basis: "Both name 12 Harbor Street", confidence: 0.6 } }]);
  return store;
};

describe("a provisional line", () => {
  it("offers to be kept first, with its basis as the reason", () => {
    const store = storeOf();
    const derived = deriveAffordances(store, [], { edgeSelection: [edge] });
    const keep = derived.affordances[0]!;
    expect(keep).toMatchObject({ label: "Keep this link", mutation: KEEP_LINK, args: edge, open: [] });
    expect(keep.why).toBe("Not yet kept by a person. Graview, tidying made it, based on “Both name 12 Harbor Street” · 60% sure.");
  });

  it("is ordinary once a person keeps it, and offers it no more", () => {
    const store = storeOf();
    const keep = deriveAffordances(store, [], { edgeSelection: [edge] }).affordances[0]!;
    applyAffordance(store, keep, {}, { author: { kind: "human", id: "nick" } });
    expect(isProvisional(store, edge)).toBe(false);
    expect(deriveAffordances(store, [], { edgeSelection: [edge] }).affordances.map((one) => one.mutation)).not.toContain(KEEP_LINK);
  });
});
