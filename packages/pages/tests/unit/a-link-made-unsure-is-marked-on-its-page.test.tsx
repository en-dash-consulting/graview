import { createSchema, defineNode, KEEP_LINK, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * A LINK MADE UNSURE IS MARKED ON ITS PAGE (FR-172). A record page marks a
 * link a less-than-sure op made, and not yet kept by a person, "unsure", the
 * mark saying who made it and what it was based on; its history line says
 * the basis of each change that gave one, and the record says what it was
 * made on. Kept by a person, the mark is gone.
 */
const lease = defineNode("lease", { fields: z.object({ label: z.string() }), plural: "Leases", edges: { about: { to: ["property"], description: "what it is about", inverse: "its leases" } } });
const property = defineNode("property", { fields: z.object({ label: z.string() }), plural: "Properties" });
const schema = createSchema([lease, property]);
const tidying = { kind: "agent" as const, id: "tidying", name: "Graview, tidying" };

const storeOf = () => {
  const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "harbor", kind: "property", label: "12 Harbor Street" }] as never, edges: [] } });
  store.append([
    { primitives: [{ op: "add-node", node: { id: "lease", kind: "lease", label: "Harbor lease" } }], author: tidying, intent: "Bring in the Harbor lease", lineage: { basis: "Attached to the March email", confidence: 0.9 } },
    { primitives: [{ op: "add-edge", edge: { kind: "about", from: "lease", to: "harbor" } }], author: tidying, intent: "Link the lease to 12 Harbor Street", lineage: { basis: "Both name 12 Harbor Street", confidence: 0.6, model: "jev-1" } },
  ]);
  return store;
};

describe("a record page", () => {
  it("marks a link made unsure, says its basis, and says each change's basis on the history line and what the record was made on", () => {
    const markup = renderToStaticMarkup(<PagesApp context={{ store: storeOf() }} initialPath="/leases/lease" />);
    expect(markup).toContain("data-graview-provisional");
    expect(markup).toContain("Not yet kept by a person. Graview, tidying made it, based on “Both name 12 Harbor Street” · 60% sure · jev-1.");
    expect(markup).toContain("based on “Attached to the March email” · 90% sure");
    expect(markup).toContain('data-testid="record-lineage"');
  });

  it("marks it from the far end too", () => {
    expect(renderToStaticMarkup(<PagesApp context={{ store: storeOf() }} initialPath="/properties/harbor" />)).toContain("data-graview-provisional");
  });

  it("marks it no more once a person keeps it", () => {
    const store = storeOf();
    store.apply({ name: KEEP_LINK, args: { kind: "about", from: "lease", to: "harbor" } }, { author: { kind: "human", id: "nick" } });
    const markup = renderToStaticMarkup(<PagesApp context={{ store }} initialPath="/leases/lease" />);
    expect(markup).not.toContain("data-graview-provisional");
    expect(markup).toContain("Keep the link from Harbor lease to 12 Harbor Street");
  });
});
