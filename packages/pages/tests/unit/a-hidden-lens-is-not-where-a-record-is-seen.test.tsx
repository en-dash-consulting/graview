import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * HIDDEN MEANS HIDDEN FROM "SEEN IN" TOO. An app built in Graview Cloud
 * kept the boards it was given at creation off the lists with
 * `set-lens-hidden`, and drew its own. A record's page still said "Seen
 * in:" every one of the hidden boards, first, ahead of the pictures the
 * app meant to show — and the kind's list said them under "Also as:". A
 * lens kept off the lists is reached by its address and a link, and
 * listed on neither.
 */
const remediation = defineNode("remediation", {
  fields: z.object({ label: z.string(), audience: z.enum(["staff", "public"]) }),
  plural: "Remediations",
});
const schema = createSchema([remediation]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: { nodes: [{ id: "r1", kind: "remediation", label: "Rotate the keys", audience: "staff" }] as never, edges: [] },
  });
const Board: ViewComponent<typeof schema> = ({ nodes }) => <div>{nodes?.length ?? 0} remediations</div>;
const views = () =>
  createViews(schema)
    .register("remediation", { cardinality: "many", fidelity: "full" }, Board, { title: "Remediations by audience", hidden: true })
    .register("remediation", { cardinality: "many", fidelity: "full" }, Board, { title: "The response plan" });
const draw = (path: string) => {
  const context: PageContext<typeof schema> = { store: store(), views: views() };
  return renderToStaticMarkup(<PagesApp context={context} initialPath={path} />);
};

describe("a hidden lens is not where a record is seen", () => {
  it("a record's page says Seen in the pictures that are listed, and not the one kept off the lists", () => {
    const page = draw("/remediations/r1");
    const seen = page.slice(page.indexOf('data-testid="seen-in"'));
    expect(seen).toContain('href="/places/the-response-plan"');
    expect(page).not.toContain('href="/places/remediations-by-audience"');
    expect(page).not.toContain("#view=remediations-by-audience");
  });

  it("a record whose only pictures are hidden says Seen in nothing at all", () => {
    const only = createViews(schema).register("remediation", { cardinality: "many", fidelity: "full" }, Board, { title: "Remediations by audience", hidden: true });
    const page = renderToStaticMarkup(<PagesApp context={{ store: store(), views: only }} initialPath="/remediations/r1" />);
    expect(page).not.toContain('data-testid="seen-in"');
  });

  it("the kind's list says Also as the listed pictures, and not the hidden one", () => {
    const list = draw("/remediations");
    expect(list).toContain('data-testid="kind-pictures"');
    expect(list).toContain('href="/places/the-response-plan"');
    expect(list).not.toContain('href="/places/remediations-by-audience"');
  });

  it("the hidden picture is still a page at its address", () => {
    expect(draw("/places/remediations-by-audience")).not.toContain("No picture is called that.");
  });
});
