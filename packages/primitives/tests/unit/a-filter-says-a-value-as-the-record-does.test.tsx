import { arrangeable, parseArrangement } from "@graview/core/arrange";
import { createSchema, defineNode, Graph } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, sayCondition } from "../../src/index.js";
import { filterEntries } from "../../src/arrange-lists.js";

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
    const said = Object.fromEntries(filterEntries(schema, graph as never, arrangeable(schema, "car")).map((entry) => [entry.value, entry.label]));
    expect(said["body:suv"]).toBe("SUV");
    expect(said["fuel:plug-in-hybrid"]).toBe("Plug in hybrid");
    expect(Object.values(said)).not.toContain("suv");
    // The line itself names no value until its list is opened.
    expect(renderToStaticMarkup(<ArrangeBar schema={schema} graph={graph} kind="car" arrangement={{}} onChange={() => {}} />)).not.toContain("SUV");
  });

  it("and so does the chip a chosen one leaves", () => {
    const offers = arrangeable(schema, "car");
    const [condition] = parseArrangement({ filter: "body:suv" }).filter ?? [];
    expect(sayCondition(schema, graph as never, offers, condition!)).toBe("Body style: SUV");
  });
});
