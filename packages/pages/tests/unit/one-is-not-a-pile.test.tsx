import { createSchema, defineNode, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * ONE IS NOT A PILE. A deal has one buyer by declaration, and its record
 * offered "Sort and filter who is buying →" under the one name — a link to
 * a list that can only hold the name above it. The far end, which may be
 * many, keeps its link.
 */
const customer = defineNode("customer", { fields: z.object({ label: z.string() }), plural: "Customers" });
const deal = defineNode("deal", {
  fields: z.object({ label: z.string() }),
  plural: "Deals",
  edges: { buyer: { to: ["customer"], cardinality: "one", description: "who is buying", inverse: "their deals" } },
});
const schema = createSchema([customer, deal]);
const draw = (path: string) => {
  const store = new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "chloe", kind: "customer", label: "Chloé Patel" },
        { id: "d1", kind: "deal", label: "Chloé · Highlander" },
        { id: "d2", kind: "deal", label: "Chloé · RAV4" },
      ] as never,
      edges: [
        { kind: "buyer", from: "d1", to: "chloe" },
        { kind: "buyer", from: "d2", to: "chloe" },
      ],
    },
  });
  const context: PageContext<typeof schema> = { store };
  return renderToStaticMarkup(<PagesApp context={context} initialPath={path} />);
};

describe("the other way round, on a record", () => {
  it("is not offered for a relation that holds one by declaration", () => {
    const page = draw("/deals/d1");
    expect(page).toContain("Chloé Patel");
    expect(page).not.toContain("Sort and filter who is buying");
  });

  it("is still offered from the end that holds many", () => {
    expect(draw("/customers/chloe")).toContain("Sort and filter their deals");
  });
});
