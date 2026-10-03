import { compileDocument, editDocument, parseExpr, printExpr, toDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";
import { DECLARED_KIND } from "../../src/meta.js";

/**
 * FR-34. A structural change is one operation, whichever surface makes it:
 * the studio's acts over its meta-graph and `editDocument` over a document
 * produce the same declaration for the same change. Compared as what the
 * declaration says — each kind's fields with their type and whether they
 * must be given, its relations, and every rule's judgement.
 */
const base: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Vendors",
  kinds: {
    vendor: {
      fields: { name: { type: "string", required: true }, quote: { type: "number" }, notes: { type: "string" } },
      edges: { fills: { to: ["category"], cardinality: "one", description: "the category it fills", inverse: "vendors for it" } },
    },
    category: { fields: { name: { type: "string", required: true } } },
  },
  rules: { "quoted-vendors": { over: "vendor", require: "quote != null || name == ''" } },
} as GraviewDocument;

type Said = Record<string, { fields: Record<string, string>; edges: string[] }> & { rules?: Record<string, string> };
function said(document: GraviewDocument): Said {
  const out: Said = {} as Said;
  for (const [kind, spec] of Object.entries(document.kinds)) {
    out[kind] = {
      fields: Object.fromEntries(Object.entries(spec.fields).map(([name, field]) => [name, `${field.type}${field.required ? "!" : ""}${field.options ? `(${field.options.join("|")})` : ""}`])),
      edges: Object.keys(spec.edges ?? {}).sort(),
    };
  }
  // A judgement compared as what it means, printed one way: "||" and "or" are the same rule.
  out.rules = Object.fromEntries(Object.entries(document.rules ?? {}).map(([name, rule]) => [name, printExpr(parseExpr(rule.require))]));
  return out;
}

function throughTheStudio(calls: readonly { name: string; args: Record<string, unknown> }[]): GraviewDocument {
  const compiled = compileDocument(base);
  if (!compiled.ok) throw new Error("the base did not compile");
  const studio = createStudio(compiled.app as never);
  for (const call of calls) studio.store.apply(call as never);
  const applied = studio.apply();
  if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
  return toDocument(applied.app as never).document;
}
function throughEditDocument(edits: readonly unknown[]): GraviewDocument {
  const outcome = editDocument(base, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome.document;
}

describe("the studio and editDocument agree", () => {
  it("add-field", () => {
    expect(said(throughTheStudio([{ name: "add-field", args: { kind: `${DECLARED_KIND}vendor`, label: "status", type: "enum", required: false, options: ["researching", "booked"] } }]))).toEqual(
      said(throughEditDocument([{ op: "add-field", kind: "vendor", field: "status", spec: { type: "enum", options: ["researching", "booked"] } }])),
    );
  });

  it("rename-field — the rule that reads it follows, on both", () => {
    expect(said(throughTheStudio([{ name: "rename-field", args: { id: "field:vendor.quote", to: "price" } }]))).toEqual(
      said(throughEditDocument([{ op: "rename-field", kind: "vendor", field: "quote", to: "price" }])),
    );
  });

  it("remove-field", () => {
    expect(said(throughTheStudio([{ name: "remove-field", args: { id: "field:vendor.notes" } }]))).toEqual(
      said(throughEditDocument([{ op: "remove-field", kind: "vendor", field: "notes" }])),
    );
  });

  it("add-kind", () => {
    expect(said(throughTheStudio([{ name: "add-kind", args: { label: "venue" } }]))).toEqual(said(throughEditDocument([{ op: "add-kind", kind: "venue", fields: { label: { type: "string", required: true } } }])));
  });
});

describe("the studio's migration keeps what it renames (FR-22)", () => {
  it("a renamed field is a rename, not a field dropped and another added", async () => {
    const { migrationSteps } = await import("../../src/migration.js");
    const compiled = compileDocument(base);
    if (!compiled.ok) throw new Error("the base did not compile");
    const studio = createStudio(compiled.app as never);
    const before = studio.store.snapshot();
    studio.store.apply({ name: "rename-field", args: { id: "field:vendor.quote", to: "price" } } as never);
    expect(migrationSteps(before as never, studio.store.snapshot() as never)).toEqual([{ what: "rename-field", kind: "vendor", field: "quote", to: "price" }]);
  });
});
