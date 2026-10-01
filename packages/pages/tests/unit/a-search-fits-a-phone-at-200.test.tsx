import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A SEARCH FITS A PHONE AT TWICE THE TEXT. Two Subaru Outbacks of one name
 * are told apart by their VINs, a seventeen-character word; at a reader's
 * 200% on a 390 phone the hit was 503 pixels wide, its group's grid track
 * grew to it, and the page scrolled sideways. jsdom draws nothing, so this
 * holds the declarations that keep it in.
 */
const car = defineNode("car", { fields: z.object({ label: z.string(), vin: z.string() }), plural: "Cars", display: { labels: { vin: "VIN" } } });
const schema = createSchema([car]);
const html = () => {
  const store = new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "a", kind: "car", label: "2025 Subaru Outback Base", vin: "3VP1SNH5LG8UKNNRM" },
        { id: "b", kind: "car", label: "2025 Subaru Outback Base", vin: "Z78WHYG7B0ACC03NJ" },
      ] as never,
      edges: [],
    },
  });
  const context: PageContext<typeof schema> = { store };
  return renderToStaticMarkup(<PagesApp context={context} initialPath="/search?q=subaru" />);
};

describe("the search page", () => {
  it("keeps each group to its track and lets a hit break", () => {
    const page = html();
    const group = page.match(/<section style="([^"]*)" data-testid="search-group"/)?.[1] ?? "";
    expect(group).toContain("grid-template-columns:minmax(0, 1fr)");
    expect(page).toContain("overflow-wrap:anywhere");
  });
});
