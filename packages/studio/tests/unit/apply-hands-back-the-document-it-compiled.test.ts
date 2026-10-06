import { documentHash, documentOf, toDocument } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { declared, template, TEMPLATES, throughTheStudio, type Call } from "./templates.js";

/*
 * THE APP APPLY HANDS BACK IS THE DOCUMENT'S (FR-54). Opened on a document,
 * the studio handed back the document its change makes — and, beside it,
 * its own TypeScript reading as the app, so `toDocument(apply().app)` still
 * said every act was code (`act-is-code`). A host that kept the app and
 * read it back lost the document it had just been given. The app is now the
 * one that document compiles to, remembered as compiled from it, so reading
 * it back is the document, byte for byte.
 */
const additions = TEMPLATES.flatMap((name) => {
  const document = template(name);
  return declared(document)
    .filter((node) => node.kind === "kind" && node.id.startsWith("declared:"))
    .map((kind) => ({
      name: `${name}: ${kind.label} gains soil`,
      document,
      calls: [{ name: "add-field", args: { kind: kind.id, label: "soil", type: "string", required: false } }] as readonly Call[],
    }));
});

describe("apply's app reads back as apply's document", () => {
  it("covers every kind of the five templates", () => {
    expect(additions.length).toBeGreaterThanOrEqual(15);
  });

  it.each(additions.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    const applied = throughTheStudio(c.document, c.calls).apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    expect(applied.document).toBeDefined();
    expect(documentOf(applied.app)).toBe(applied.document);
    const back = toDocument(applied.app);
    expect(back.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(await documentHash(back.document)).toBe(await documentHash(applied.document!));
    // The same app a host would compile from the document it was handed.
    const compiled = compileDocument(applied.document!);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(Object.keys(applied.app.schema.kinds)).toEqual(Object.keys(compiled.app.schema.kinds));
    expect((applied.app.mutations ?? []).map((mutation) => mutation.name)).toEqual((compiled.app.mutations ?? []).map((mutation) => mutation.name));
  });

  it("nothing changed: the app reads back as the document the studio opened on", async () => {
    const vendors = template("vendor-shortlist");
    const applied = throughTheStudio(vendors, []).apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    expect(await documentHash(toDocument(applied.app).document)).toBe(await documentHash(vendors));
  });
});
