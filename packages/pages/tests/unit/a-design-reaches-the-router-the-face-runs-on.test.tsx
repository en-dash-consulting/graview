import { createSchema, defineNode, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPageRegistry, Link, PagesApp, useLocation, useParams, useSearchParams, type PageComponent, type PageContext } from "../../src/index.js";

/**
 * A DESIGN REACHES THE ROUTER THROUGH THE FACE, NEVER BESIDE IT.
 *
 * A product's page read `useParams` from the router package it depended on
 * itself. When that was a second copy, or another major than the one
 * `PagesApp` mounts, the page asked a router that was never set: `useParams`
 * answered `{}` with no error, so a record page said nothing lives at its
 * address, and `Link` and `useLocation` threw. What a design links, reads and
 * moves with comes from `@graview/pages`, so it is always the router the face
 * put above it, and `graview doctor` names a router of the product's own.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);

const Plot: PageComponent<typeof schema> = () => {
  const { id } = useParams();
  const { pathname } = useLocation();
  const [search] = useSearchParams();
  return (
    <main>
      <p data-testid="read">{`${id} at ${pathname} sorted by ${search.get("by")}`}</p>
      <Link to="/plots">All plots</Link>
    </main>
  );
};

describe("a design's routing, from @graview/pages", () => {
  it("reads the address the face is at and links under its base", () => {
    const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "p1", kind: "plot", label: "Back Lawn" }] as never, edges: [] } });
    const context: PageContext<typeof schema> = { store };
    const registry = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).register("plot", "record", Plot);
    const html = renderToStaticMarkup(<PagesApp context={context} registry={registry} basename="/pages" initialPath="/plots/p1?by=label" />);
    expect(html).toContain("p1 at /plots/p1 sorted by label");
    expect(html).toContain('href="/pages/plots"');
  });
});
