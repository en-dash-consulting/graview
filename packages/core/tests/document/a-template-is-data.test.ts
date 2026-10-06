import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store } from "../../src/index.js";
import { isGraviewTemplate, readGraviewTemplate, templateSeedPrimitives } from "../../src/document/index.js";
import { instantiateTemplate } from "../../src/check.js";

/**
 * FR-08. A template is a document, the questions that set it up, what the
 * answers do as ordinary acts, and example content — in Graview Cloud's
 * shape, so one made there instantiates here with no Cloud in the room.
 */
const raw = JSON.parse(readFileSync(new URL("./fixtures/vendor-shortlist.template.json", import.meta.url), "utf8")) as Record<string, unknown>;
const TODAY = "2026-10-02";

function instantiated(answers: Record<string, unknown> = {}) {
  const out = instantiateTemplate(raw, answers, { today: () => TODAY });
  if (!out.ok) throw new Error(out.findings.map((f) => `${f.path}: ${f.message}`).join("\n"));
  return out;
}

describe("a template made in Graview Cloud", () => {
  it("reads as a template, and a document does not", () => {
    expect(isGraviewTemplate(raw)).toBe(true);
    expect(isGraviewTemplate(raw["document"])).toBe(false);
    expect(readGraviewTemplate(raw).ok).toBe(true);
  });

  it("instantiates to its own document, compiled, and setup calls in the template's order", () => {
    const out = instantiated();
    expect(out.document).toEqual(raw["document"]);
    expect(out.compiled.app.name).toBe("Vendor shortlist");
    expect(out.setup).toEqual(
      ["Venue", "Photographer", "Florist", "Catering"].map((name) => ({ name: "add-category", args: { name }, intent: "Set up from Vendor shortlist" })),
    );
  });

  it("reads an answer into the acts, coerced to the question's type", () => {
    const out = instantiated({ categories: "Venue, DJ", budget: "2,500" });
    expect(out.setup.map((call) => call.args)).toEqual([
      { name: "Venue", budget: 2500 },
      { name: "DJ", budget: 2500 },
    ]);
  });

  it("refuses an answer to no question, and a setup act the document lacks, in sentences with a path", () => {
    const unknown = instantiateTemplate(raw, { colour: "teal" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.findings.map((f) => f.path)).toEqual(["answers.colour"]);

    const wrongAct = instantiateTemplate({ ...raw, setup: [{ act: "add-venue", args: {} }] });
    expect(wrongAct.ok).toBe(false);
    if (!wrongAct.ok) expect(wrongAct.findings[0]!.message).toContain('"add-venue" is not an act');

    const notATemplate = instantiateTemplate({ ...raw, format: "graview-document" });
    expect(notATemplate.ok).toBe(false);
  });

  it("runs its setup in a store as acts, and its example content as primitives that fit the schema", () => {
    const out = instantiated({ budget: 500 });
    const { app } = out.compiled;
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [] });
    for (const call of out.setup) store.apply({ name: call.name, args: call.args }, { batch: "setup", intent: call.intent });
    expect(store.graph.nodesOfKind("category").map((n) => [n["name"], n["budget"]])).toEqual([
      ["Venue", 500],
      ["Photographer", 500],
      ["Florist", 500],
      ["Catering", 500],
    ]);
    store.applyPrimitives(templateSeedPrimitives(out.seed!, out.document), { batch: "examples" });
    expect(store.graph.nodesOfKind("vendor")).toHaveLength(4);
    // The examples are dated against the day they were written, so a later install moves them with the calendar.
    const later = instantiateTemplate(raw, {}, { today: () => "2026-10-12" });
    expect(later.ok && later.seed!.nodes.find((n) => n.id === "example-sugar-spoon")!["due"]).toBe("2026-11-25");
  });
});
