import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * "Related: Drives Test drives · Towards Trade-ins · About Enquiries" over
 * the list of cars: the edge's name, humanized, where the declaration says
 * "the test drives booked in it" — and "1 vehicle" over a list of cars
 * (the seventh walk).
 */
const car = defineNode("car", { noun: "car", fields: z.object({ label: z.string() }), plural: "Cars" });
const drive = defineNode("drive", {
  fields: z.object({ label: z.string() }),
  plural: "Test drives",
  edges: { drives: { to: ["car"], description: "the car to drive", inverse: "the test drives booked in it" } },
});
const vehicle = defineNode("vehicle", { noun: "van", fields: z.object({ label: z.string() }), plural: "Vans" });
const schema = createSchema([car, drive, vehicle]);
const store = new Store({ schema, snapshot: { nodes: [{ id: "vehicle:1", kind: "vehicle", label: "Transit" }] as never, edges: [] } });

describe("a list page's relations", () => {
  it("are said in their own words from this end", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store }} initialPath="/cars" />);
    expect(html).toContain("The test drives booked in it");
    expect(html).not.toMatch(/>Drives</);
  });

  it("and one of a kind is counted by its noun", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store }} initialPath="/vans" />);
    expect(html).toContain("1 van");
    expect(html).not.toContain("1 vehicle");
  });
});
