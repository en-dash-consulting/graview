import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { readableFields } from "../../src/words.js";

/**
 * A GLANCE SAYS THE FIELDS ITS KIND CHOSE, AND NO OTHERS; A CHOICE ANOTHER
 * FIELD BESIDE IT SHARES SAYS WHOSE IT IS.
 *
 * A finding card read "Critical · Security · High": the third was its
 * confidence, and a severity can be "High" too. Its author took
 * `confidence` out of the kind's `glance`, and the card still said it —
 * the glance chose the order and the rest of the kind followed it.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/review.seed.json", import.meta.url), "utf8"));

function opened(document: unknown = review) {
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  const glance = (id: string) => {
    const node = store.graph.getNode(id)! as never as { id: string; kind: string } & Record<string, unknown>;
    return readableFields(node, app.schema.tryDefinition(node.kind), { glance: true, limit: 3, said: [String(node["title"] ?? node["label"])] }).map((field) => field.alone);
  };
  return { glance };
}

describe("a card's glance", () => {
  it("says the fields its kind's glance names and none after them: a finding without its confidence", () => {
    expect(opened().glance("f1")).toEqual(["Critical", "Security"]);
  });

  it("says the kind's fields in their declared order where the kind chose no glance, its prose by its start", () => {
    expect(opened().glance("i1")).toEqual(["Every secret the app holds reaches three layers further than it needs to: the logger, the error reporter and the cache.", "Strong"]);
  });

  it("says a choice with its field's name where another field shown beside it shares a choice", () => {
    expect(opened().glance("r1")).toEqual(["Likelihood: low", "Impact: high", "Billing"]);
  });

  it("names both a severity and a confidence when the glance shows both, since either can be high", () => {
    const both = structuredClone(review);
    both.kinds.finding.glance = ["severity", "category", "confidence"];
    expect(opened(both).glance("f1")).toEqual(["Severity: critical", "Security", "Confidence: high"]);
  });
});
