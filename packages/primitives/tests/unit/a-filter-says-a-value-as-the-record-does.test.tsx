import { arrangeable, parseArrangement } from "@graview/core/arrange";
import { createSchema, defineNode, Graph } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, sayCondition } from "../../src/index.js";

/**
 * "Only… suv, plug-in-hybrid" on the list of cars whose every record says
 * "SUV" and "Plug-in hybrid": the filter read the field's raw values while
 * the record read the declaration's (the seventh walk; the watch's
 * key's-own-words rule caught it on every list page with a choice).
 */
const car = defineNode("car", {
  fields: z.object({ label: z.string(), body: z.enum(["suv", "saloon"]), fuel: z.enum(["petrol", "plug-in-hybrid"]) }),
  plural: "Cars",
  display: { labels: { body: "Body style" }, format: { body: (value) => (value === "suv" ? "SUV" : "Saloon") } },
});
const schema = createSchema([car]);
const graph = new Graph(schema);

describe("a filter's choices", () => {
  it("say each value as the record does", () => {
    const html = renderToStaticMarkup(<ArrangeBar schema={schema} graph={graph} kind="car" arrangement={{}} onChange={() => {}} />);
    expect(html).toMatch(/<option value="body:suv">SUV<\/option>/);
    expect(html).toMatch(/<option value="fuel:plug-in-hybrid">Plug in hybrid<\/option>/);
    expect(html).not.toMatch(/>suv<|>plug-in-hybrid</);
  });

  it("and so does the chip a chosen one leaves", () => {
    const offers = arrangeable(schema, "car");
    const [condition] = parseArrangement({ filter: "body:suv" }).filter ?? [];
    expect(sayCondition(schema, graph as never, offers, condition!)).toBe("Body style: SUV");
  });
});
