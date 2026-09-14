import { createSchema, defineNode, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPageRegistry, PagesApp, type PageComponent, type PageContext } from "../../src/index.js";

/**
 * A PAGE THAT IS NOT ABOUT A KIND HAS SOMEWHERE TO LIVE.
 *
 * The derived routes are `/`, `/problems`, `/:plural` and `/:plural/:id`,
 * and an app could replace any of them and add none. So the headline feature
 * of a real product — a desk that takes photographs and proposes a survey,
 * about nothing in the schema — sat unreachable through a whole first build,
 * and a link to it landed on an empty scene. Every app with an onboarding, a
 * settings page, an import screen or an about meets the same wall.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: [{ id: "p1", kind: "plot", label: "Back Lawn" }] as never, edges: [] },
  });

const Desk: PageComponent<typeof schema> = () => <p data-testid="survey-desk">Stake it out from photographs</p>;

const draw = (path: string, registry?: ReturnType<typeof pages>) => {
  const context: PageContext<typeof schema> = { store: store() };
  return renderToStaticMarkup(
    <PagesApp context={context} initialPath={path} {...(registry ? { registry } : {})} />,
  );
};
const pages = () =>
  createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).route("/survey", Desk);

afterEach(() => vi.restoreAllMocks());

describe("a route the app added", () => {
  it("renders at its own address, inside the shell like any other page", () => {
    const html = draw("/survey", pages());
    expect(html).toContain('data-testid="survey-desk"');
    /* Inside the face, not instead of it: the shell's own nav is still there. */
    expect(html).toContain("Plots");
    expect(html).toContain("Problems");
  });

  it("does not disturb the routes the schema derives", () => {
    const registry = pages();
    expect(draw("/", registry)).not.toContain('data-testid="survey-desk"');
    expect(draw("/plots", registry)).toContain("Plots");
    expect(draw("/plots/p1", registry)).toContain("Back Lawn");
  });

  it("is matched before the list route, which would otherwise swallow it", () => {
    /* Without ordering, "/survey" reads as the plural slug of some kind and
       the kind switch renders a not-found where the desk should be. */
    expect(draw("/survey", pages())).not.toContain("Nothing here");
  });

  it("says so when a path shadows a derived one, rather than hiding a kind", () => {
    const said = vi.spyOn(console, "warn").mockImplementation(() => {});
    createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).route("/plots", Desk);
    expect(said).toHaveBeenCalledWith(expect.stringContaining("shadows the derived list of plot"));
  });
});
