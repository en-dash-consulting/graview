import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineApp, defineNode, labelOf, readableFields } from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A GLANCE SAYS WHAT THE DECLARATION CHOSE. Every card in the showroom
 * read "DRCD05TU2R88P6N6D · SUV · Atlas Blue": the three fields declared
 * first that the heading did not already say. A shopper compares cars by
 * price and mileage, and had to open each one to read them (the seventh walk).
 */
const fields = z.object({ vin: z.string(), year: z.number(), make: z.string(), model: z.string(), body: z.string(), color: z.string(), price: z.number(), mileage: z.number() });
const money = (value: unknown) => `£${Number(value).toLocaleString("en-GB")}`;
const chosen = defineNode("car", { fields, plural: "Cars", label: (node) => `${node.year} ${node.make} ${node.model}`, display: { format: { price: money }, glance: ["price", "mileage", "body"] } });
const unchosen = defineNode("van", { fields, plural: "Vans", label: (node) => `${node.year} ${node.make} ${node.model}` });
const node = { id: "car:1", kind: "car", vin: "DRCD05TU2R88P6N6D", year: 2017, make: "Audi", model: "Q5", body: "SUV", color: "Atlas Blue", price: 18995, mileage: 61000 };

describe("a glance at a record", () => {
  it("says the fields the declaration chose for it, in its order", () => {
    const said = readableFields(node, chosen as never, { limit: 3, said: [labelOf(chosen as never, node)], glance: true }).map((field) => field.value);
    expect(said).toEqual(["£18,995", "61000", "SUV"]);
  });

  it("is a note from the checker where a kind has many fields and has not chosen", () => {
    const app = defineApp({ name: "Lot", schema: createSchema([chosen, unchosen]) });
    const notes = checkApp(app).findings.filter((finding) => finding.code === "glance-unchosen").map((finding) => finding.where);
    expect(notes).toEqual(['defineNode("van").display']);
    const wrong = defineApp({ name: "Lot", schema: createSchema([defineNode("car", { fields, plural: "Cars", display: { glance: ["prise"] } })]) });
    expect(checkApp(wrong).findings.map((finding) => finding.code)).toContain("glance-unknown-field");
  });
});
