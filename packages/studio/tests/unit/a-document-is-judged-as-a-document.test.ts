import { compileDocument, documentHash, toDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { handedToTheHost, type StudioApplied } from "../../src/place.js";
import { declared, template, TEMPLATES, throughTheStudio, type Call } from "./templates.js";

/*
 * A STUDIO OPENED ON A DOCUMENT IS JUDGED BY THE DOCUMENT (FR-54).
 *
 * `apply()` ran the checker over the studio's own TypeScript reading of the
 * declaration, which does not carry a removal into the acts the way
 * `editDocument` does: removing a relation left the acts that connect it
 * claiming an edge nobody declares (`edge-claim-unknown-kind`), removing a
 * field left the acts that write it (`writes-unknown-field`), removing a
 * kind left the acts that make it (`creates-unknown-kind`) — while the
 * document the studio handed back compiled clean. A host was refused a
 * change that was fine. Opened on a document, the studio's verdict is now
 * `compileDocument(studio.document())`'s: `apply()`, `check()` (the
 * verdict the studio shows) and `would()` (what an agent's proposal is
 * judged by) all say what compiling that document says.
 */
type Case = { readonly name: string; readonly document: GraviewDocument; readonly call: Call };
const cases: readonly Case[] = TEMPLATES.flatMap((name) => {
  const document = template(name);
  return declared(document).flatMap((node): Case[] => {
    const at = `${name}: ${node.id}`;
    if (node.kind === "kind" && node.id.startsWith("declared:")) return [{ name: `${at} removed`, document, call: { name: "remove-kind", args: { id: node.id } } }];
    if (node.kind === "edge") return [{ name: `${at} removed`, document, call: { name: "remove-edge", args: { id: node.id } } }];
    if (node.kind !== "field") return [];
    return [
      { name: `${at} removed`, document, call: { name: "remove-field", args: { id: node.id } } },
      { name: `${at} renamed`, document, call: { name: "rename-field", args: { id: node.id, to: `${node.label}Renamed` } } },
    ];
  });
});

describe("removing and renaming across five of Graview Cloud's templates", () => {
  it("covers every kind, relation and field", () => {
    expect(cases.length).toBeGreaterThanOrEqual(140);
  });

  it.each(cases.map((c) => [c.name, c] as const))("%s: apply says what compiling the document says", async (_name, c) => {
    const studio = throughTheStudio(c.document, [c.call]);
    const outcome = studio.document();
    if (!outcome?.ok) {
      // A change no edit says is named, and the studio's reading stands as before.
      expect(outcome?.findings.length).toBeGreaterThan(0);
      return;
    }
    const compiled = compileDocument(outcome.document);
    const applied = studio.apply();
    const check = studio.check();
    const would = throughTheStudio(c.document, []).would(c.call);
    if (!would.ok) throw new Error(would.reason);
    if (compiled.ok) {
      if (!applied.ok) throw new Error(`refused a document that compiles: ${JSON.stringify(applied.check.findings.filter((finding) => finding.severity === "error"))}`);
      expect(await documentHash(applied.document!)).toBe(await documentHash(outcome.document));
      expect(await documentHash(toDocument(applied.app).document)).toBe(await documentHash(outcome.document));
      expect(check.errors).toBe(0);
      expect(would.check.errors).toBe(0);
    } else {
      // The document's own refusal, in its own words, at its own path.
      expect(applied.ok).toBe(false);
      const said = compiled.findings.filter((finding) => finding.severity === "error").map((finding) => finding.message);
      if (!applied.ok) expect(applied.check.findings.filter((finding) => finding.severity === "error").map((finding) => finding.message)).toEqual(said);
      expect(check.errors).toBe(said.length);
      expect(would.check.errors).toBe(said.length);
    }
  });
});

describe("StudioPlace hands the host the document", () => {
  it("removing a relation reaches onApply with the document, its edits and the app it compiles to", async () => {
    const vendors = template("vendor-shortlist");
    const studio = throughTheStudio(vendors, [{ name: "remove-edge", args: { id: "edge:vendor.fills" } }]);
    const handed: StudioApplied[] = [];
    const result = handedToTheHost(studio, (applied) => void handed.push(applied));
    expect(result.ok).toBe(true);
    expect(handed).toHaveLength(1);
    expect(handed[0]!.edits).toEqual([{ op: "remove-relation", kind: "vendor", relation: "fills" }]);
    expect(handed[0]!.document?.kinds["vendor"]?.edges?.["fills"]).toBeUndefined();
    expect(await documentHash(toDocument(handed[0]!.app).document)).toBe(await documentHash(handed[0]!.document!));
  });
});
