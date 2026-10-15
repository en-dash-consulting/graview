import { readFileSync } from "node:fs";
import { compileDocument } from "@graview/core/check";
import { editDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * A LENS KEPT OFF THE LISTS IN THE STUDIO IS `set-lens-hidden`: the studio
 * reads a hidden lens as hidden, says keeping one off the lists to the
 * document as the edit, and the document it hands back keeps it there.
 */
const workshop = JSON.parse(readFileSync(new URL("../../../../scripts/fixtures/desk-bar/workshop.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const studioOf = (document: GraviewDocument) => {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error("the workshop did not compile");
  return createStudio(compiled.app as never, { document } as never);
};

describe("a lens kept off the lists in the studio", () => {
  it("is the set-lens-hidden edit, and the document it hands back keeps the lens off the lists", () => {
    const studio = studioOf(workshop);
    const lens = studio.store.graph.allNodes().find((node) => node.kind === "lens" && node.id.includes(":email-to-todd"));
    expect(lens).toBeDefined();
    studio.store.apply({ name: "set-lens-hidden", args: { id: lens!.id, hidden: true } } as never);
    expect(studio.edits()).toEqual([{ op: "set-lens-hidden", title: "Email to Todd", on: "deliverable", hidden: true }]);
    const document = studio.document();
    expect(document?.ok).toBe(true);
    if (document?.ok) expect(document.document.lenses?.find((one) => one["title"] === "Email to Todd")?.["hidden"]).toBe(true);
  });

  it("reads a lens the document hides as hidden, and lists it again as set-lens-hidden false", () => {
    const hidden = editDocument(workshop, [{ op: "set-lens-hidden", title: "Email to Todd", hidden: true }]);
    if (!hidden.ok) throw new Error(JSON.stringify(hidden.findings));
    const studio = studioOf(hidden.document);
    const lens = studio.store.graph.allNodes().find((node) => node.kind === "lens" && node.id.includes(":email-to-todd")) as { id: string; hidden?: boolean } | undefined;
    expect(lens?.hidden).toBe(true);
    studio.store.apply({ name: "set-lens-hidden", args: { id: lens!.id, hidden: false } } as never);
    expect(studio.edits()).toEqual([{ op: "set-lens-hidden", title: "Email to Todd", on: "deliverable", hidden: false }]);
  });
});
