import { arrangeable, parseArrangement } from "@graview/core/arrange";
import { createSchema, defineNode, Graph } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, roundSteps, sayCondition } from "../../src/index.js";

/**
 * "SUVs UNDER £25,000, A KIA OR A HYUNDAI." The list's Only… offered body
 * style, fuel and condition, and no price, mileage, year or make: the
 * filters a car shopper reaches for first (the seventh walk).
 */
const money = (value: unknown) => `£${Number(value).toLocaleString("en-GB")}`;
const car = defineNode("car", {
  fields: z.object({ label: z.string(), make: z.string(), price: z.number().int(), year: z.number().int() }),
  plural: "Cars",
  display: { labels: { price: "Price" }, format: { price: money } },
});
const schema = createSchema([car]);
const graph = new Graph(schema);
const makes = ["Kia", "Hyundai", "Ford", "Kia"];
graph.load({
  nodes: Array.from({ length: 40 }, (_, at) => ({ id: `car:${at}`, kind: "car", label: `Car ${at}`, make: makes[at % 4], price: 8000 + at * 1500, year: 2014 + (at % 12) })) as never,
  edges: [],
});

describe("a list's Only…", () => {
  it("offers a price at most and at least a few round amounts, a year by the year, and a make by name", () => {
    const html = renderToStaticMarkup(<ArrangeBar schema={schema} graph={graph as never} kind="car" arrangement={{}} onChange={() => {}} />);
    expect(html).toMatch(/<option value="price:at-most:\d+">at most £\d{1,3},\d{3}<\/option>/);
    expect(html).toMatch(/<option value="year:at-least:20\d\d">at least 20\d\d<\/option>/);
    expect(html).toContain('<option value="make:Kia">Kia</option>');
    expect(html).toContain('<option value="make:Hyundai">Hyundai</option>');
  });

  it("rounds to the spread, and says a chosen one in the record's words", () => {
    const prices = roundSteps([9995, 14995, 23995, 31000, 64995]);
    expect(prices.length).toBeGreaterThan(1);
    expect(prices.every((price) => price % 5000 === 0 && price >= 5000 && price <= 65000)).toBe(true);
    expect(roundSteps([2015, 2017, 2019, 2022, 2026]).every((year) => year >= 2015 && year <= 2026)).toBe(true);
    const [condition] = parseArrangement({ filter: "price:at-most:25000" }).filter ?? [];
    expect(sayCondition(schema, graph as never, arrangeable(schema, "car"), condition!)).toBe("Price: at most £25,000");
  });
});
