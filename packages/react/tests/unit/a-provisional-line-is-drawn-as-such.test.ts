import { createSchema, defineNode, KEEP_LINK, Store } from "@graview/core";
import { edgeSelectionId } from "@graview/layout";
import { PROVISIONAL_DASH, CONNECTOR_DASH } from "@graview/render";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { provisionalLines } from "../../src/scene-lines.js";

/**
 * A PROVISIONAL LINE IS DRAWN AS SUCH (FR-172). The scene's lines read which
 * links are provisional by the id a line is picked by, each with the sentence
 * its hover says; none, and the lines are handed nothing. The dash it is
 * drawn in is its own, never one a relation's kind could take.
 */
const lease = defineNode("lease", { fields: z.object({ label: z.string() }), edges: { about: { to: ["property"], description: "what it is about" } } });
const property = defineNode("property", { fields: z.object({ label: z.string() }) });
const schema = createSchema([lease, property]);
const edge = { kind: "about", from: "lease", to: "harbor" };

const storeOf = () => {
  const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "lease", kind: "lease", label: "Harbor lease" }, { id: "harbor", kind: "property", label: "12 Harbor Street" }] as never, edges: [] } });
  store.append([{ primitives: [{ op: "add-edge", edge }], author: { kind: "agent", id: "tidying", name: "Graview, tidying" }, intent: "Link the lease", lineage: { basis: "Both name 12 Harbor Street", confidence: 0.6 } }]);
  return store;
};

describe("a provisional line", () => {
  it("is known by the id the line is picked by, with what its hover says", () => {
    expect(provisionalLines(storeOf())).toEqual(new Map([[edgeSelectionId("about", "lease", "harbor"), "Not yet kept by a person. Graview, tidying made it, based on “Both name 12 Harbor Street” · 60% sure."]]));
  });

  it("is ordinary once a person keeps it, and the lines are handed nothing", () => {
    const store = storeOf();
    store.apply({ name: KEEP_LINK, args: edge }, { author: { kind: "human", id: "nick" } });
    expect(provisionalLines(store)).toBeUndefined();
  });

  it("is dashed in a pattern no relation's kind is drawn in", () => {
    expect(Object.values(CONNECTOR_DASH)).not.toContain(PROVISIONAL_DASH);
  });
});
