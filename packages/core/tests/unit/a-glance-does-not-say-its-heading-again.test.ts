import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineNode, readableFields } from "../../src/index.js";


/**
 * A GLANCE DOES NOT SAY ITS HEADING AGAIN, word by word. A vehicle's card is
 * headed "2027 Subaru Forester Sport", built from its year, make, model and
 * trim; its three facts were the VIN, "Year 2027" and "Subaru", and the
 * price never appeared.
 */
describe("a glance under a heading made of its own fields", () => {
  const car = defineNode("car", {
    fields: z.object({ vin: z.string(), year: z.number(), make: z.string(), model: z.string(), price: z.number(), mileage: z.number() }),
    label: (node) => `${node.year} ${node.make} ${node.model}`,
  });
  const node = { id: "c1", kind: "car", vin: "GTACBLRJ9YVNF1VAC", year: 2027, make: "Subaru", model: "Forester", price: 31900, mileage: 12 };

  it("spends its facts on what the heading does not say", () => {
    const facts = readableFields(node, car as never, { limit: 3, said: ["2027 Subaru Forester"], glance: true }).map((field) => field.key);
    expect(facts).toEqual(["vin", "price", "mileage"]);
  });

  it("while a record's full facts keep every field, because that is where each is changed", () => {
    const facts = readableFields(node, car as never, { said: ["2027 Subaru Forester"] }).map((field) => field.key);
    expect(facts).toEqual(["vin", "year", "make", "model", "price", "mileage"]);
  });
});
