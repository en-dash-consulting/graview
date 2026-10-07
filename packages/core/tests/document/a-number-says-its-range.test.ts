import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, editDocument, planMigration, readDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { createSchema, defineApp, defineNode, formFields, mutationToolSchema, refusalOf, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";
import { argShape } from "../../src/mutations/node-ref.js";

/**
 * FR-114. A NUMBER FIELD MAY SAY ITS RANGE.
 *
 *   "level": { "type": "integer", "min": 1, "max": 5 }
 *
 * The range is the field's, so everything that asks for or takes the
 * field honors it: a form's control (min, max, step), an agent's tool
 * (minimum, maximum, multipleOf), and the store, which refuses a value
 * outside it as invalid. The check says when a default is outside it; an
 * edit op says it; a diff and a migration read it.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const seed = read("org.seed.json");
const org = (): GraviewDocument => {
  const doc = read("org.gdd.json");
  doc.kinds.strength.fields.level = { type: "integer", min: 1, max: 5, description: "how strong, from 1 to 5" };
  doc.kinds.component.fields.weight = { type: "number", min: 0, max: 1, step: 0.05 };
  return doc;
};

function compiled(doc: unknown = org()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-06" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: structuredClone(seed) as never });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};
const errors = (doc: unknown) => {
  const result = compileDocument(doc);
  return result.findings.filter((f) => f.severity === "error").map((f) => `${f.code} at ${f.path}: ${f.message}`);
};

describe("a number field with a range", () => {
  it("is asked for within it: every form's control and every agent's tool say min, max and step", () => {
    const store = storeOf(compiled());
    for (const act of ["set-level", "note-strength"]) {
      expect(argShape(store.mutation(act).input, "level")).toMatchObject({ type: "number", min: 1, max: 5, step: 1 });
      expect(formFields(store.mutation(act).input).find((f) => f.name === "level")).toMatchObject({ control: "number", min: 1, max: 5, step: 1 });
      expect(mutationToolSchema(store.mutation(act)).inputSchema["properties"]).toMatchObject({ level: { type: "integer", minimum: 1, maximum: 5 } });
    }
    expect(formFields(store.mutation("note-strength").input).find((f) => f.name === "level")).toMatchObject({ min: 1, max: 5 });
    expect(argShape(store.mutation("edit-component").input, "weight")).toMatchObject({ min: 0, max: 1, step: 0.05 });
    expect(mutationToolSchema(store.mutation("edit-component")).inputSchema["properties"]).toMatchObject({ weight: { type: "number", minimum: 0, maximum: 1, multipleOf: 0.05 } });
  });

  it("is enforced when an act is applied: a value outside it is refused as invalid, and nothing changes", () => {
    const store = storeOf(compiled());
    expect(refusal(() => store.apply({ name: "set-level", args: { id: "strength-pricing", level: 9 } }))).toMatchObject({ reason: "invalid" });
    expect(refusal(() => store.apply({ name: "set-level", args: { id: "strength-pricing", level: 0 } }))).toMatchObject({ reason: "invalid" });
    expect(refusal(() => store.apply({ name: "note-strength", args: { id: "person-val", name: "Facilitation", level: 9 } }))).toMatchObject({ reason: "invalid" });
    expect(refusal(() => store.apply({ name: "edit-component", args: { id: "comp-pricing", weight: 0.33 } }))).toMatchObject({ reason: "invalid" });
    expect(store.graph.getNode("strength-pricing")).toMatchObject({ level: 3 });
    store.apply({ name: "set-level", args: { id: "strength-pricing", level: 5 } });
    store.apply({ name: "edit-component", args: { id: "comp-pricing", weight: 0.35 } });
    expect(store.graph.getNode("strength-pricing")).toMatchObject({ level: 5 });
    expect(store.graph.getNode("comp-pricing")).toMatchObject({ weight: 0.35 });
  });
});

describe("the check reads a range", () => {
  it("flags a default outside the range, or off its step", () => {
    const doc = org() as unknown as { kinds: Record<string, { fields: Record<string, Record<string, unknown>> }> };
    doc.kinds["strength"]!.fields["level"]!["default"] = 9;
    doc.kinds["component"]!.fields["weight"]!["default"] = 0.33;
    expect(errors(doc)).toEqual([
      "default-range at kinds.component.fields.weight.default: 0.33 is not a whole multiple of 0.05, as weight's values are",
      "default-range at kinds.strength.fields.level.default: 9 is outside level's range, 1 to 5",
    ]);
  });

  it("refuses a range on a field that is not a number, a minimum above the maximum, and a step that is not above zero", () => {
    const doc = org() as unknown as { kinds: Record<string, { fields: Record<string, Record<string, unknown>> }> };
    doc.kinds["person"]!.fields["role"] = { type: "string", min: 1 };
    doc.kinds["strength"]!.fields["level"] = { type: "integer", min: 5, max: 1 };
    doc.kinds["component"]!.fields["y"] = { type: "number", step: 0 };
    expect(compileDocument(doc).findings.filter((f) => f.severity === "error").map((f) => `${f.code} at ${f.path}`)).toEqual([
      "field-range at kinds.person.fields.role.min",
      "field-range at kinds.component.fields.y.step",
      "field-range at kinds.strength.fields.level.max",
    ]);
  });
});

describe("a TypeScript field's bounds", () => {
  it("are the range of the document written from it", () => {
    const place = defineNode("place", { fields: z.object({ label: z.string().min(1), x: z.number().min(0).max(1), rating: z.number().int().min(1).max(5).multipleOf(1), loose: z.number().gt(0) }) });
    const { document } = toDocument(defineApp({ name: "Places", schema: createSchema([place]) }));
    expect(document.kinds["place"]!.fields).toMatchObject({ x: { type: "number", min: 0, max: 1 }, rating: { type: "integer", min: 1, max: 5, step: 1 }, loose: { type: "number" } });
    expect(document.kinds["place"]!.fields["loose"]).not.toHaveProperty("min");
  });
});

describe("a range changed by an edit", () => {
  const base = readDocument(org()).document!;

  it("set-range says it, a diff says it, and narrowing it is breaking", () => {
    const outcome = editDocument(base, [{ op: "set-range", kind: "strength", field: "level", max: 3 }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.said).toEqual(["strength's level takes 1 to 3."]);
    expect(outcome.document.kinds["strength"]!.fields["level"]).toMatchObject({ min: 1, max: 3 });
    const diff = diffDocuments(base, outcome.document);
    expect(diff.sentences).toEqual(["strength's level now takes 1 to 3, where it took 1 to 5; values outside it are cleared."]);
    expect(diff.breaking).toBe(true);
    expect(diff.narrowedRanges).toEqual([{ kind: "strength", field: "level" }]);
  });

  it("widening or clearing it is not breaking", () => {
    const outcome = editDocument(base, [{ op: "set-range", kind: "strength", field: "level", min: null, max: 10 }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.said).toEqual(["strength's level takes at most 10."]);
    expect(diffDocuments(base, outcome.document)).toMatchObject({ breaking: false, sentences: ["strength's level now takes at most 10, where it took 1 to 5."] });
  });

  it("a migration clears what a narrowed range no longer takes", () => {
    const outcome = editDocument(base, [{ op: "set-range", kind: "strength", field: "level", max: 4 }]);
    if (!outcome.ok) throw new Error("refused");
    const plan = planMigration(base, outcome.document, seed);
    expect(plan.counts.cleared).toBe(1);
    expect(plan.primitives).toEqual([{ op: "patch-node", id: "strength-fit-judgement", before: { level: 5 }, after: { level: expect.anything() } }]);
  });

  it("a migration that clears a required value says the record will need it, as its graph would refuse the record without one", () => {
    const required = structuredClone(base);
    required.kinds["strength"]!.fields["level"] = { ...required.kinds["strength"]!.fields["level"]!, required: true };
    const outcome = editDocument(required, [{ op: "set-range", kind: "strength", field: "level", max: 4 }]);
    if (!outcome.ok) throw new Error("refused");
    const plan = planMigration(required, outcome.document, seed);
    expect(plan.counts.cleared).toBe(1);
    expect(plan.missingRequired).toBe(1);
    expect(plan.words).toContain("1 required value would be missing; those records need it filled in.");
  });

  it("is refused on a field that is not a number, or with a default it would leave outside", () => {
    const refused = (edits: unknown[]) => {
      const outcome = editDocument(base, edits);
      return outcome.ok ? "applied" : outcome.findings.map((f) => f.message).join("; ");
    };
    expect(refused([{ op: "set-range", kind: "person", field: "role", min: 1 }])).toMatch(/role is a string, not a number/);
    expect(refused([{ op: "set-default", kind: "strength", field: "level", default: 3 }, { op: "set-range", kind: "strength", field: "level", max: 2 }])).toMatch(/default, 3, is outside/);
    expect(refused([{ op: "set-default", kind: "strength", field: "level", default: 7 }])).toMatch(/outside level's range/);
  });

  it("retyping a field to something that is not a number lets its range go", () => {
    const outcome = editDocument(base, [{ op: "retype-field", kind: "strength", field: "level", type: "string" }]);
    if (!outcome.ok) throw new Error("refused");
    expect(outcome.document.kinds["strength"]!.fields["level"]).toEqual({ type: "string", description: "how strong, from 1 to 5" });
  });
});
