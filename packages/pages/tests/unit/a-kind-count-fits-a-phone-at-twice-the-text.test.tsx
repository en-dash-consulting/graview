import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A KIND'S COUNT FITS A PHONE AT TWICE THE TEXT. The gauntlet's longest
 * plural and its count, "101", sat on one line inside its card on the home's
 * "What is here"; at 320 wide and 32px text the page scrolled sideways by
 * 20px (the nightly's watch, `breaks-at-width`). jsdom draws nothing, so
 * this holds the declarations that keep it in.
 */
const thing = defineNode("thing", { fields: z.object({ label: z.string() }), plural: "Extraordinarilylongpluralnamesofthings" });
const schema = createSchema([thing]);
const html = () => {
  const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "a", kind: "thing", label: "One" }] as never, edges: [] } });
  const context: PageContext<typeof schema> = { store };
  return renderToStaticMarkup(<PagesApp context={context} initialPath="/" />);
};

describe("the home's kinds", () => {
  it("keeps each kind's card to the line and lets its name break and its count wrap", () => {
    const kinds = html().split('data-testid="kinds"')[1] ?? "";
    expect(kinds).toMatch(/<li style="max-width:100%">/);
    expect(kinds).toContain("flex-wrap:wrap");
    expect(kinds).toContain("overflow-wrap:anywhere");
  });
});
