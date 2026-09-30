import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A PICKER FITS ITS FIELD. A select is as wide as its longest option; the
 * "Open a deal" form's vehicle picker, over 320 vehicles, was 618 pixels on
 * a 390-pixel phone and the place page scrolled sideways. jsdom draws no
 * boxes, so this holds the declarations that keep it in.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const deal = defineNode("deal", { fields: z.object({ label: z.string() }), plural: "Deals" });
const schema = createSchema([car, deal]);
const { defineMutation } = bindSchema(schema);
const open = defineMutation("open-deal", {
  title: "Open a deal",
  creates: ["deal"],
  input: z.object({ carId: nodeRef(["car"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.carId, "deal"), kind: "deal", label: args.carId }),
});

describe("a picker on the routed face", () => {
  it("is never wider than its field", () => {
    const store = new Store({ schema, mutations: [open], snapshot: { nodes: [{ id: "c1", kind: "car", label: "2027 Mercedes-Benz GLE AMG 53 4MATIC+ Coupe" }] as never, edges: [] } });
    const html = renderToStaticMarkup(<DerivedForm store={store} mutation={open} />);
    const select = html.match(/<select[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(select).toContain("min-width:0");
    expect(select).toContain("max-width:100%");
  });
});
