import { describe, expect, it } from "vitest";
import { z } from "zod";
import { arrange, arrangeable, parseArrangement } from "../../src/arrange.js";
import { createSchema, defineNode, Graph } from "../../src/index.js";

/**
 * "SUVs UNDER £25,000, A KIA OR A HYUNDAI." A car shopper's first minute,
 * and the list offered none of it: a choice, a yes or no and a date could
 * be picked, and a price, a mileage or a make could not (the seventh walk).
 */
const car = defineNode("car", {
  fields: z.object({ label: z.string(), make: z.string(), price: z.number().int(), mileage: z.number().int(), body: z.enum(["suv", "saloon"]) }),
  plural: "Cars",
});
const schema = createSchema([car]);
const graph = new Graph(schema);
graph.load({
  nodes: [
    { id: "car:1", kind: "car", label: "Sportage", make: "Kia", price: 23995, mileage: 18000, body: "suv" },
    { id: "car:2", kind: "car", label: "Tucson", make: "Hyundai", price: 27500, mileage: 9000, body: "suv" },
    { id: "car:3", kind: "car", label: "Picanto", make: "Kia", price: 9995, mileage: 41000, body: "saloon" },
  ] as never,
  edges: [],
});

describe("a list narrowed by a number and a word", () => {
  it("offers both as filters", () => {
    expect(arrangeable(schema, "car").filters.map((offer) => offer.key)).toEqual(expect.arrayContaining(["make", "price", "mileage", "body"]));
  });

  it("keeps a price at most a value, a mileage at least one, and a make by name", () => {
    const kept = (filter: string) => arrange(graph.allNodes(), parseArrangement({ filter }), { schema, graph } as never).nodes.map((node) => node.id);
    expect(kept("price:at-most:25000")).toEqual(["car:1", "car:3"]);
    expect(kept("mileage:at-least:10000,body:suv")).toEqual(["car:1"]);
    expect(kept("make:Kia")).toEqual(["car:1", "car:3"]);
  });
});
