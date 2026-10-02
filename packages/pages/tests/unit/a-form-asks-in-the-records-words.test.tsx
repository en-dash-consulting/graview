import { bindSchema, createSchema, defineNode, failureWords, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A FORM ASKS IN THE RECORD'S WORDS.
 *
 * "Put a car on sale" asked for "Vin *", "Body *" with options "suv" and
 * "plug-in-hybrid", and a shopper signing up for their "Label *"; one page
 * later the car said "VIN", "Body style", "SUV" and "Plug-in hybrid",
 * because the kind declares them. And a wrong email came back as `Invalid
 * arguments for mutation "sign-up" email: Invalid email address` (the
 * seventh walk).
 */
const car = defineNode("car", {
  fields: z.object({ vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "a 17-character VIN"), body: z.enum(["suv", "saloon"]) }),
  plural: "Cars",
  label: (node) => node.vin,
  display: { labels: { vin: "VIN", body: "Body style" }, format: { body: (value) => (value === "suv" ? "SUV" : "Saloon") } },
});
const shopper = defineNode("shopper", { fields: z.object({ label: z.string(), email: z.string().email() }), plural: "Shoppers" });
const schema = createSchema([car, shopper]);
const { defineMutation } = bindSchema(schema);
const sell = defineMutation("add-car", {
  title: "Put a car on sale",
  creates: ["car"],
  input: z.object({ vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, "a 17-character VIN"), body: z.enum(["suv", "saloon"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.vin, "car"), kind: "car", ...args }),
});
const signUp = defineMutation("sign-up", {
  title: "Sign up",
  creates: ["shopper"],
  input: z.object({ label: z.string().min(1), email: z.string().email() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "shopper"), kind: "shopper", ...args }),
});
const store = new Store({ schema, mutations: [sell, signUp] });

describe("a form for an act that makes a record", () => {
  it("names each field and each choice as the record does", () => {
    const html = renderToStaticMarkup(<DerivedForm store={store} mutation={sell} />);
    expect(html).toContain("VIN *");
    expect(html).toContain("Body style *");
    expect(html).toMatch(/<option value="suv">SUV<\/option>/);
    expect(html).not.toMatch(/>Vin \*|>Body \*|>suv</);
  });

  it("asks for a record's name as its name", () => {
    const html = renderToStaticMarkup(<DerivedForm store={store} mutation={signUp} />);
    expect(html).toContain("Name *");
    expect(html).not.toContain("Label");
  });

  it("says what was wrong in the form's words, never the act's id or the field's key", () => {
    let said = "";
    try {
      store.apply({ name: "sign-up", args: { label: "Kofi Asante", email: "kofi at example" } });
    } catch (error) {
      said = failureWords(store.schema, store.allMutations(), error);
    }
    expect(said).toMatch(/^Not yet: Email — /);
    expect(said).not.toContain("sign-up");
    expect(said).not.toContain("email:");
  });
});
