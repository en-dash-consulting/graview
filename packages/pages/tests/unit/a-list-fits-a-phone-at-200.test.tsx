import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A LIST FITS A PHONE AT TWICE THE TEXT. A shopper's email is one long
 * word; at a reader's 200% on a 390 phone the list of shoppers was 138
 * pixels too wide (the seventh walk) — W-151's search page, again, on the
 * list. jsdom draws nothing, so this holds the declarations that keep it in.
 */
const shopper = defineNode("shopper", { fields: z.object({ label: z.string(), email: z.string() }), plural: "Shoppers" });
const schema = createSchema([shopper]);
const store = new Store({ schema, snapshot: { nodes: [{ id: "s", kind: "shopper", label: "Ravi Robertson", email: "ravi.robertson63@mail.example" }] as never, edges: [] } });

describe("a list page", () => {
  it("keeps each row to the page and lets a long value break", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store }} initialPath="/shoppers" />);
    // The row is the shared anatomy (ROWS_CSS): a track no wider than the list, and a value that breaks inside it.
    expect(html).toMatch(/<li class="graview-row"><a[^>]*href="\/shoppers\/s"/);
    expect(html).toMatch(/\.graview-rows\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
    expect(html).toMatch(/\.graview-row\{[^}]*overflow-wrap:anywhere/);
  });
});
