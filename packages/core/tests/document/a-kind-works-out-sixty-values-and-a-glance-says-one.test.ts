import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, MOST_COMPUTED, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { createSchema, defineNode, z } from "../../src/index.js";

/**
 * A KIND WORKS OUT SIXTY VALUES, AND A GLANCE MAY SAY ONE (Roadmap
 * f-lifelogics-findings, request
 * more-than-20-computed-fields-per-kind-and-glances-that-can-show-computed-fields).
 * An estimate carrying a whole price breakdown met the cap of twenty
 * computed fields, and `set-glance` refused a computed field, so a total
 * could not stand on a card — though the checker and every card already
 * said one a declaration glanced at. The cap bounds what one record costs
 * to read (each value worked out from a budget of its own), and is sixty.
 */
const doc = (computed: Record<string, unknown>, glance?: string[]) =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Estimates",
    brand: { currency: "USD" },
    kinds: { estimate: { label: "{name}", fields: { name: { type: "string", required: true }, hours: { type: "number" }, rate: { type: "number" } }, computed, ...(glance ? { glance } : {}) } },
    acts: { "add-estimate": { title: "Add an estimate", creates: "estimate" } },
    policy: { grants: [{ roles: "*", mutations: "*" }] },
  }) as unknown as GraviewDocument;
const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`line${i}`, `hours * ${i + 1}`]));

describe("a kind's computed fields", () => {
  it("number up to sixty, and the sixty-first is refused, by the document and by an edit", () => {
    expect(MOST_COMPUTED).toBe(60);
    expect(compileDocument(doc(many(60))).ok).toBe(true);
    const over = compileDocument(doc(many(61)));
    expect(over.ok).toBe(false);
    expect(JSON.stringify(over.findings)).toContain("at most 60 computed fields");
    const refused = editDocument(doc(many(60)), [{ op: "set-computed", kind: "estimate", name: "total", expr: "hours * rate" }]);
    expect(refused.ok).toBe(false);
    expect(editDocument(doc(many(59)), [{ op: "set-computed", kind: "estimate", name: "total", expr: "hours * rate" }]).ok).toBe(true);
  });
});

describe("set-glance", () => {
  it("takes a computed field, and refuses one kept off the card", () => {
    const base = doc({ total: { expr: "hours * rate", format: "money" }, helper: { expr: "hours", hidden: true } });
    const glanced = editDocument(base, [{ op: "set-glance", kind: "estimate", fields: ["total", "hours"] }]);
    expect(glanced.ok).toBe(true);
    if (!glanced.ok) return;
    expect(glanced.document.kinds["estimate"]!.glance).toEqual(["total", "hours"]);
    expect(compileDocument(glanced.document).ok).toBe(true);
    const hidden = editDocument(base, [{ op: "set-glance", kind: "estimate", fields: ["helper"] }]);
    expect(hidden.ok).toBe(false);
    if (hidden.ok) return;
    expect(hidden.findings[0]).toMatchObject({ path: "edits.0.fields.0" });
    expect(editDocument(base, [{ op: "set-glance", kind: "estimate", fields: ["nothing"] }]).ok).toBe(false);
  });

  it("keeps a computed field in the glance a TypeScript app's document is written with", () => {
    const estimate = defineNode("estimate", { fields: z.object({ name: z.string(), hours: z.number() }), computed: { double: "hours * 2" }, display: { glance: ["double", "hours"] } } as never);
    const written = toDocument({ name: "Estimates", schema: createSchema([estimate]) } as never);
    expect(written.document?.kinds["estimate"]!.glance).toEqual(["double", "hours"]);
  });
});
