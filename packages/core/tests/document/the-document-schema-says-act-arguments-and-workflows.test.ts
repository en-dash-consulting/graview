import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { readDocument } from "../../src/document/compile.js";

/*
 * THE SCHEMA SAYS AN ACT'S ARGUMENTS AND A WORKFLOW'S TRIGGERS AND STEPS
 * (Roadmap f-authoring-schemas-args-workflows). An agent authoring a
 * Thanksgiving app read the schema Cloud serves its guide from, found
 * nothing on `acts.args`, and had to guess how to ask for a household that
 * may be left out. The schema now says what `args` holds — a field's
 * shape, or a record's — and a workflow's every trigger and step.
 */
type Json = Record<string, unknown>;
const schema = documentJsonSchema("0.0.0") as Json;
const at = (node: unknown, ...path: string[]): Json => path.reduce<Json>((one, key) => (one?.[key] ?? {}) as Json, node as Json);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const document = (act: Json, workflows?: Json) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  kinds: {
    household: { label: "{name}", fields: { name: { type: "string", required: true } } },
    dish: { label: "{name}", fields: { name: { type: "string", required: true } }, edges: { broughtBy: { to: ["household"], cardinality: "one" } } },
  },
  acts: { "add-dish": act },
  ...(workflows ? { workflows } : {}),
});
const ADD_DISH = { title: "Add a dish", args: { to: { required: false } }, effects: [{ create: "dish", as: "new", set: { name: "$name" } }, { connect: "broughtBy", from: "$new", to: "$to" }] };

describe("the document's JSON Schema", () => {
  it("says what an act's args are, an optional record among them", () => {
    const args = at(schema, "properties", "acts", "additionalProperties", "properties", "args");
    expect(String(args["description"])).toMatch(/\{ "required": false \}/);
    expect(JSON.stringify(args)).toMatch(/An argument naming a record/);
    expect(JSON.stringify(args)).toMatch(/"type":\{"type":"string","enum"/);
  });

  it("reads an optional record argument as the compiler does, and refuses what the compiler refuses", () => {
    expect(validate(document(ADD_DISH))).toBe(true);
    expect(readDocument(document(ADD_DISH)).document).toBeDefined();
    const wrong = { ...ADD_DISH, args: { to: { required: false, kinds: ["household"] } } };
    expect(validate(document(wrong))).toBe(false);
    expect(readDocument(document(wrong)).document).toBeUndefined();
  });

  it("says a workflow's triggers and its steps", () => {
    const workflow = at(schema, "properties", "workflows", "additionalProperties");
    const triggers = JSON.stringify(at(workflow, "properties", "when", "items"));
    for (const key of ["every", "cron", "made", "changed", "synced", "byHand"]) expect(triggers).toContain(`"required":["${key}"]`);
    const steps = at(workflow, "properties", "steps", "items")["anyOf"] as Json[];
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(validate(document(ADD_DISH, { weekly: { title: "Add the pie", when: [{ every: "sunday 18:00" }], steps: [{ act: "add-dish", args: { name: "Pie" } }] } }))).toBe(true);
    expect(validate(document(ADD_DISH, { weekly: { title: "Add the pie", when: [{}], steps: [{ act: "add-dish" }] } }))).toBe(false);
  });
});
