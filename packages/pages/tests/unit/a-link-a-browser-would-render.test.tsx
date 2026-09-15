import { createSchema, defineNode, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { Link } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPageRegistry, PagesApp, type PageComponent, type PageContext } from "../../src/index.js";

/**
 * A TEST RENDERS THE HREFS A BROWSER WILL, OR IT IS A LIE.
 *
 * `PagesApp` mounts a `BrowserRouter` with the app's `basename` and, given
 * `initialPath`, a `MemoryRouter` with no basename at all. So under
 * `basename="/pages"` a `<Link to="/survey">` rendered `/survey` in a test
 * and `/pages/survey` in a browser — and a link written the other way round
 * rendered correctly in EVERY test and doubled to `/pages/pages/survey` the
 * moment anybody opened it.
 *
 * A product shipped nine of those, with a helper building them and
 * twenty-five tests asserting the exact hrefs, all green throughout. The
 * tests were not weak; they were run against a different router.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: [{ id: "p1", kind: "plot", label: "Back Lawn" }] as never, edges: [] },
  });

const Linky: PageComponent<typeof schema> = () => (
  <nav>
    <Link to="/survey" data-testid="relative">
      The survey desk
    </Link>
  </nav>
);

const draw = (path: string, basename?: string) => {
  const context: PageContext<typeof schema> = { store: store() };
  return renderToStaticMarkup(
    <PagesApp context={context} initialPath={path} {...(basename === undefined ? {} : { basename })} />,
  );
};

const withRoute = (path: string, basename?: string) => {
  const context: PageContext<typeof schema> = { store: store() };
  const registry = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).route(
    "/survey",
    Linky,
  );
  return renderToStaticMarkup(
    <PagesApp
      context={context}
      registry={registry}
      initialPath={path}
      {...(basename === undefined ? {} : { basename })}
    />,
  );
};

describe("the address a test renders at", () => {
  it("is where a browser would be, once the basename is on it", () => {
    /* The route is "/survey" and the face is mounted at "/pages": a browser
       is at "/pages/survey", and so is the test. */
    expect(withRoute("/survey", "/pages")).toContain("The survey desk");
  });

  it("renders a relative link the way a browser will", () => {
    const html = withRoute("/survey", "/pages");
    expect(html).toContain('href="/pages/survey"');
    expect(html).not.toContain('href="/pages/pages/survey"');
  });

  it("leaves a face mounted at the root exactly as it was", () => {
    const html = withRoute("/survey");
    expect(html).toContain('href="/survey"');
  });

  it("still derives the schema's own routes under a basename", () => {
    expect(draw("/plots", "/pages")).toContain("Plots");
    expect(draw("/plots/p1", "/pages")).toContain("Back Lawn");
  });
});
