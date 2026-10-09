import { readFileSync } from "node:fs";
import { compileDocument } from "@graview/core/check";
import type { GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * A LENS TAKEN AWAY IN THE STUDIO IS `remove-lens`: the edit that takes back
 * a lens the seat kept from a draft. The studio says it to the document,
 * where it used to say no edit could.
 */
const workshop = JSON.parse(readFileSync(new URL("../../../../scripts/fixtures/desk-bar/workshop.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

describe("a lens taken away in the studio", () => {
  it("is the remove-lens edit, and the document it hands back has no such place", () => {
    const compiled = compileDocument(workshop);
    if (!compiled.ok) throw new Error("the workshop did not compile");
    const studio = createStudio(compiled.app as never, { document: workshop } as never);
    const lens = studio.store.graph.allNodes().find((node) => node.kind === "lens" && node.id.endsWith("email-to-todd"));
    expect(lens).toBeDefined();
    studio.store.apply({ name: "remove-lens", args: { id: lens!.id } } as never);
    expect(studio.edits()).toEqual([{ op: "remove-lens", title: "Email to Todd", on: "deliverable" }]);
    const document = studio.document();
    expect(document?.ok).toBe(true);
    if (document?.ok) expect(document.document.lenses?.map((one) => one["title"])).toEqual(["What the workshop covers"]);
  });
});
