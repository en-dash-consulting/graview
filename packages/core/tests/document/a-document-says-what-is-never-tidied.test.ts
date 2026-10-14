import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, editDocument, readDocument, toDocument } from "../../src/document/index.js";
import { createSchema, defineApp, defineNode, deriveMutations, PermissionDeniedError, Store, z, type AnySchema, type Author } from "../../src/index.js";

/*
 * A DOCUMENT SAYS WHAT THE APP'S OWN ACTOR MAY NEVER TIDY. `"tidying":
 * "never"` on a kind keeps every automated change off its records,
 * `"no-links"` keeps it from linking or unlinking them ("never auto-link
 * Vendors"), and `"tidying": "never"` on a relation keeps it from making or
 * breaking that relation. `set-tidying` edits each with a sentence, the
 * preview of the same change says it, the checker judges it, and the
 * compiled app's store holds the actor to it.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const compiled = (document: unknown) => {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result.app;
};
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };

describe("set-tidying", () => {
  it("says a kind is never linked automatically, and the preview of the same change says the same sentence", () => {
    const edited = editDocument(vendors, [{ op: "set-tidying", kind: "vendor", tidying: "no-links" }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.document.kinds.vendor?.tidying).toBe("no-links");
    expect(edited.said).toEqual(["Vendors are never linked or unlinked automatically: tidying may change them, and only suggest a link."]);
    expect(diffDocuments(vendors, edited.document).sentences).toContain(edited.said[0]);
  });

  it("says a kind is never tidied, which takes its leave-alone acts away, and back again", () => {
    const off = editDocument(vendors, [{ op: "set-tidying", kind: "category", tidying: "never" }]);
    if (!off.ok) throw new Error(JSON.stringify(off.findings));
    expect(off.said[0]).toBe("Categories are never tidied: nothing automated changes them or their links on its own, and tidying may only suggest.");
    expect(off.said.join(" ")).toMatch(/leave-alone-category and allow-tidying-category are gone/);
    const names = deriveMutations(compiled(off.document).schema, compiled(off.document).mutations ?? []).map((act) => act.name);
    expect(names).toContain("leave-alone-vendor");
    expect(names).not.toContain("leave-alone-category");
    const on = editDocument(off.document, [{ op: "set-tidying", kind: "category", tidying: "allowed" }]);
    if (!on.ok) throw new Error(JSON.stringify(on.findings));
    expect(on.document.kinds.category?.tidying).toBeUndefined();
    expect(on.said[0]).toBe("Categories can be tidied again.");
    const again = editDocument(off.document, [{ op: "set-tidying", kind: "category", tidying: "never" }]);
    expect(again.ok && again.said).toEqual(["Categories were already never tidied."]);
  });

  it("says a relation is never made or broken automatically, and refuses one the kind does not have or a word a relation does not take", () => {
    const edited = editDocument(vendors, [{ op: "set-tidying", kind: "vendor", relation: "fills", tidying: "never" }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.document.kinds.vendor?.edges?.fills?.tidying).toBe("never");
    expect(edited.said).toEqual(["A vendor's “fills” links are never made or broken automatically: tidying may suggest one, and a person decides."]);
    expect(diffDocuments(vendors, edited.document).sentences).toContain(edited.said[0]);

    const missing = editDocument(vendors, [{ op: "set-tidying", kind: "vendor", relation: "supplies", tidying: "never" }]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.findings[0]).toMatchObject({ path: "edits.0.relation", message: 'vendor has no relation "supplies"; it has fills' });
    const wrong = editDocument(vendors, [{ op: "set-tidying", kind: "vendor", relation: "fills", tidying: "no-links" }]);
    expect(wrong.ok).toBe(false);
    const unknown = editDocument(vendors, [{ op: "set-tidying", kind: "vendor", tidying: "sometimes" }]);
    expect(unknown.ok).toBe(false);
  });

  it("is judged by the checker: a grant naming a leave-alone act of a kind never tidied, and a relation saying what its kind already says", () => {
    const granted = { ...vendors, roles: ["planner"], kinds: { ...vendors.kinds, category: { ...vendors.kinds.category!, tidying: "never" } }, policy: { grants: [{ roles: ["planner"], mutations: ["leave-alone-category"] }] } };
    const refused = compileDocument(granted);
    expect(refused.ok).toBe(false);
    expect(refused.findings.find((finding) => finding.code === "grant-act")?.message).toMatch(/"tidying": "never"/);
    const redundant = { ...vendors, kinds: { ...vendors.kinds, vendor: { ...vendors.kinds.vendor!, tidying: "no-links", edges: { fills: { ...vendors.kinds.vendor!.edges!.fills!, tidying: "never" } } } } };
    expect(compileDocument(redundant).findings.find((finding) => finding.code === "tidying-redundant")?.severity).toBe("warning");
  });

  it("is held by the compiled app's store: the actor may not link vendors on its own, and a person may", () => {
    const edited = editDocument(vendors, [{ op: "set-tidying", kind: "vendor", tidying: "no-links" }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    const app = compiled(edited.document);
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: (app.mutations ?? []) as never,
      snapshot: { nodes: [{ id: "vendor:bloom", kind: "vendor", name: "Bloom", status: "researching" }, { id: "category:flowers", kind: "category", name: "Flowers" }] as never, edges: [] },
    });
    const call = { name: "file-under", args: { vendor: "vendor:bloom", category: "category:flowers" } };
    const act = app.mutations?.find((one) => one.name === "file-under");
    const args = Object.fromEntries(Object.keys((act!.input as unknown as { shape: Record<string, unknown> }).shape).map((name, at) => [name, at === 0 ? "vendor:bloom" : "category:flowers"]));
    expect(() => store.apply({ ...call, args }, { author: actor })).toThrow(PermissionDeniedError);
    expect(() => store.apply({ ...call, args }, { author: actor })).toThrow("Graview, tidying may not link or unlink vendors on its own: the app says they are never linked automatically.");
    expect(store.apply({ ...call, args }).ops).toHaveLength(1);
  });

  it("is what a TypeScript kind's and relation's tidying become in its document", () => {
    const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), tidying: "no-links", edges: { books: { to: ["event"], tidying: "never" } } });
    const event = defineNode("event", { fields: z.object({ label: z.string() }) });
    const back = toDocument(defineApp({ name: "Events", schema: createSchema([vendor, event]) }) as never);
    expect(back.document?.kinds.vendor?.tidying).toBe("no-links");
    expect(back.document?.kinds.vendor?.edges?.books?.tidying).toBe("never");
  });
});
