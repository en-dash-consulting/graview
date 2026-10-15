import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { documentJsonSchema, NAMING } from "../../src/cli/document-schema.js";

/**
 * A document's kinds are kebab-case (`tool-note`) and its fields and
 * relations camelCase (`supersededBy`). The checker said one rule at a time
 * — a kind called `toolNote` was told kinds join words with hyphens, and
 * then a field called `superseded-by` was told fields are camelCase — so
 * the first write met the trap twice. Now each refusal says both rules and
 * the exact name it wants, and the schema says both wherever a name is
 * written. The name is not respelled for the author: a kind's name is in
 * every record a seed or a log holds, so a document renamed behind its
 * back would disagree with its own data.
 */
const document = (kinds: Record<string, unknown>, acts: Record<string, unknown> = {}) => ({ format: "graview-document", formatVersion: 1, name: "Review", kinds, acts });

describe("a misnamed kind or field is told both conventions and its right name", () => {
  it("tells a camelCase kind its kebab-case name, and that fields are camelCase", () => {
    const compiled = compileDocument(document({ toolNote: { fields: { title: { type: "string" } } } }));
    expect(compiled.ok).toBe(false);
    const finding = compiled.findings.find((f) => f.path === "kinds.toolNote")!;
    expect(finding.fix).toContain('Call it "tool-note"');
    expect(finding.fix).toContain("camelCase");
    expect(finding.message).toContain("camelCase");
  });

  it("tells a kebab-case field and relation their camelCase names, and that kinds are kebab-case", () => {
    const field = compileDocument(document({ "tool-note": { fields: { "superseded-on": { type: "date" } } } })).findings.find((f) => f.path === "kinds.tool-note.fields.superseded-on")!;
    expect(field.fix).toContain('Call it "supersededOn"');
    expect(field.fix).toContain("kebab-case");
    const relation = compileDocument(document({ "tool-note": { fields: { title: { type: "string" } }, edges: { superseded_by: { to: ["tool-note"] } } } })).findings.find((f) => f.path === "kinds.tool-note.edges.superseded_by")!;
    expect(relation.fix).toContain('Call it "supersededBy"');
  });

  it("tells a value that names a kind the same, where an act says it", () => {
    const compiled = compileDocument(document({ "tool-note": { fields: { title: { type: "string" } } } }, { "add-note": { creates: "toolNote" } }));
    const finding = compiled.findings.find((f) => f.path === "acts.add-note.creates")!;
    expect(finding.fix).toContain('Call it "tool-note"');
  });

  it("says both rules in the JSON Schema wherever a kind, an act, a rule, a field or a relation is named", () => {
    const schema = documentJsonSchema("0.0.0") as any;
    expect(schema.properties.kinds.propertyNames.description).toBe(NAMING);
    expect(schema.properties.acts.propertyNames.description).toBe(NAMING);
    expect(schema.properties.rules.propertyNames.description).toBe(NAMING);
    const kind = JSON.stringify(schema);
    expect(kind.split(NAMING.replaceAll('"', '\\"')).length - 1).toBeGreaterThanOrEqual(7);
  });
});
