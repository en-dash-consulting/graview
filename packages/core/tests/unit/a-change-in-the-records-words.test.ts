import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A CHANGE IS SAID IN THE RECORD'S WORDS. The derived edit's history read
 * "Change 2026 Tesla Model Y Performance: price → 49900" beside a card
 * that says "Price $49,900", and then `Change Billing across apps: stage →
 * "considering"` — a field's key, an arrow and the value as it is kept —
 * heard in Take back, in Activity and when another seat's change was said
 * aloud (the screen-reader pass). It says "Changed the stage of Billing
 * across apps to Considering": the field's label, the value as the record
 * page says it, several fields in one sentence.
 */
const car = defineNode("car", {
  fields: z.object({ label: z.string(), price: z.number(), condition: z.enum(["new", "cpo"]), vin: z.string() }),
  plural: "Cars",
  display: {
    labels: { vin: "VIN" },
    format: { price: (value) => `$${Number(value).toLocaleString("en-US")}`, condition: (value) => (value === "cpo" ? "Certified pre-owned" : "New") },
  },
});
const schema = createSchema([car]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-car", {
  title: "Add a car",
  creates: ["car"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: "c1", kind: "car", label: args.label, price: 1, condition: "new", vin: "X" }),
});

/** No key, no arrow, no value in a program's quotes: what the screen-reader pass heard. */
const SAID_AS_KEPT = /→|"|\b[a-z]+[A-Z]\w*\b/;

describe("the derived edit's sentence", () => {
  it("says several changes as one sentence, each by the field's label and as the record says its value", () => {
    const store = new Store({ schema, mutations: [add] });
    store.apply({ name: "add-car", args: { label: "Model Y" } });
    store.apply({ name: "edit-car", args: { id: "c1", price: 49900, condition: "cpo", vin: "8C9D" } });
    expect(store.log.all().at(-1)!.intent).toBe("Changed the price of Model Y to $49,900, the condition to Certified pre-owned and the VIN to “8C9D”");
  });
});

/** A feature of every field type a document declares, and a house in another app it may link. */
const roadmap = {
  format: "graview-document",
  formatVersion: 1,
  name: "Roadmap",
  brand: { currency: "USD" },
  kinds: {
    feature: {
      label: "{name}",
      fields: {
        name: { type: "string", required: true },
        summary: { type: "text", format: "markdown" },
        stage: { type: "enum", options: ["considering", "planned", "shipped"] },
        budget: { type: "number", format: "money" },
        reviewOn: { type: "date", repeats: true },
        startsAt: { type: "datetime" },
        site: { type: "url" },
        home: { type: "app-link" },
        flagged: { type: "boolean" },
        tags: { type: "list" },
      },
      edges: { forHouse: { to: ["@nick/house/house"], cardinality: "one" } },
    },
  },
  acts: { "add-feature": { title: "Add a feature", creates: "feature" } },
};

function storeOf(): Store<AnySchema> {
  const result = compileDocument(roadmap, { today: () => "2026-10-14" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((one) => one.severity === "error")));
  const app = result.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "f1", kind: "feature", name: "Billing across apps", stage: "planned" }], edges: [] } as never });
}
const changed = (args: Record<string, unknown>): string => storeOf().apply({ name: "edit-feature", args: { id: "f1", ...args } }).intent;

describe("a document's derived edit", () => {
  it("says a choice by its option's words: Changed the stage of Billing across apps to Considering", () => {
    expect(changed({ stage: "considering" })).toBe("Changed the stage of Billing across apps to Considering");
  });

  it("says money as money and a day as a day, in the app's locale", () => {
    expect(changed({ budget: 12500 })).toBe("Changed the budget of Billing across apps to $12,500");
    expect(changed({ reviewOn: "2026-10-20" })).toBe("Changed the review on of Billing across apps to Oct 20, 2026");
    expect(changed({ startsAt: "2026-10-20T18:00" })).toBe("Changed the starts at of Billing across apps to Oct 20, 2026, 6:00 PM");
  });

  it("says a date that repeats by the date and how often", () => {
    expect(changed({ reviewOnRepeat: { every: "week" } })).toBe("Changed the review on of Billing across apps to repeat every week");
    expect(changed({ reviewOnRepeat: { every: "month", interval: 2 } })).toBe("Changed the review on of Billing across apps to repeat every 2 months");
  });

  it("says prose by its start without its Markdown, a link and an app as written, a box as yes or no, and a list item by item", () => {
    expect(changed({ summary: "**Bill once** across every app.\n\nThen the rest." })).toBe("Changed the summary of Billing across apps to “Bill once across every app.”");
    expect(changed({ site: "https://example.com/billing" })).toBe("Changed the site of Billing across apps to “https://example.com/billing”");
    expect(changed({ home: "@nick/house" })).toBe("Changed the home of Billing across apps to “@nick/house”");
    expect(changed({ flagged: true })).toBe("Changed the flagged of Billing across apps to yes");
    expect(changed({ tags: ["billing", "apps"] })).toBe("Changed the tags of Billing across apps to “billing”, “apps”");
  });

  it("says a record in another app as one, never the reference it keeps", () => {
    expect(changed({ forHouse: "house:h1" })).toBe("Changed the for house of Billing across apps to a linked record");
  });

  it("says a value taken away as nothing", () => {
    expect(changed({ summary: "" })).toBe("Changed the summary of Billing across apps to nothing");
  });

  it("says several fields in one sentence, and none of them as kept: no key, no arrow, no value in a program's quotes", () => {
    const said = changed({ stage: "shipped", budget: 900, reviewOn: "2026-11-01", reviewOnRepeat: { every: "year" } });
    expect(said).toBe("Changed the stage of Billing across apps to Shipped, the budget to $900, the review on to Nov 1, 2026 and the review on to repeat every year");
    expect(said).not.toMatch(SAID_AS_KEPT);
  });
});
