import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";
import type { HostView } from "../../src/index.js";

/**
 * A RENAME CARRIES THE KEPT VIEWS THAT READ IT (HQ
 * feature:f-rename-carries-kept-views). A Cloud app renamed its relation
 * `updatedBy` to `recheckedBy` on nine kinds: the preview said nothing would
 * break — the links were kept, the computed values followed — and then every
 * one of its fourteen kept views, whose manifests read `updatedBy`, no longer
 * fit the app, and the home fell back to the derived pages. A rename is
 * breaking for a view whose manifest reads the old name, unless the change
 * carries the manifest; `editDocument` carries each one it is handed, says
 * which, and says which views' sources still name the old key.
 */
const tracker = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Checks",
    kinds: {
      check: { fields: { title: { type: "string", required: true }, photo: { type: "image" } }, edges: { updatedBy: { to: ["person"] } } },
      site: { fields: { name: { type: "string", required: true } }, edges: { updatedBy: { to: ["person"] } } },
      person: { fields: { name: { type: "string", required: true } } },
    },
    acts: {
      "add-check": { title: "Add a check", creates: "check" },
      "add-site": { title: "Add a site", creates: "site" },
      "add-person": { title: "Add a person", creates: "person" },
    },
  }) as unknown as GraviewDocument;

type Kept = HostView & { readonly source?: string; readonly [key: string]: unknown };

/** A manifest act with what the view calls it (`ManifestAct.as`). */
const assign = { act: "connect-check-updated-by", as: "assign" };
const board: Kept = {
  name: "check-board",
  title: "Check board",
  attach: "check",
  cardinality: "many",
  reads: { kinds: ["person"], edges: ["updatedBy"] },
  acts: ["add-check", assign],
  accepts: [{ kind: "check", field: "photo" }],
  pictures: { check: "photo" },
  source: "for (const c of G.nodes('check')) G.o('updatedBy', c.id);",
};
const sites: Kept = {
  name: "site-list",
  title: "Sites",
  attach: "site",
  cardinality: "many",
  reads: { kinds: ["person"], edges: ["updatedBy"] },
  source: "const who = (id) => G.o(\"recheckedBy\", id);",
};
const people: Kept = { name: "people", attach: "person", cardinality: "many", source: "G.nodes('person')" };
const kept = [board, sites, people];

const renameRelation = [{ op: "rename-relation", kind: "check", relation: "updatedBy", to: "recheckedBy" }];

describe("a rename and the kept views that read the renamed key", () => {
  it("is breaking for each view whose manifest reads it, named, when the manifests are not carried", () => {
    const edited = editDocument(tracker(), renameRelation);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const diff = diffDocuments(tracker(), edited.document, { views: kept });
    expect(diff.breaking).toBe(true);
    expect(diff.brokenViews.map((view) => [view.name, view.reads])).toEqual([
      ["check-board", ["updatedBy"]],
      ["site-list", ["updatedBy"]],
    ]);
    expect(diff.sentences).toContain('The view "Check board" reads updatedBy, which this change takes away: its manifest would no longer fit the app.');
    // Without the views, the change is what it was: nothing stored stops fitting.
    expect(diffDocuments(tracker(), edited.document).breaking).toBe(false);
  });

  it("carries each manifest in the same change, so every view still fits and nothing is breaking", () => {
    const edited = editDocument(tracker(), renameRelation, { views: kept });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(compileDocument(edited.document).ok).toBe(true);
    expect(edited.carried?.map((view) => view.name)).toEqual(["check-board", "site-list"]);
    const [carriedBoard, carriedSites, carriedPeople] = edited.views!;
    expect(carriedBoard).toMatchObject({ reads: { kinds: ["person"], edges: ["recheckedBy"] }, acts: ["add-check", { act: "connect-check-rechecked-by", as: "assign" }] });
    expect(carriedSites?.reads?.edges).toEqual(["recheckedBy"]);
    // A view the rename does not reach is handed back as it was; no manifest comes back with its source.
    expect(carriedPeople).toEqual({ name: "people", attach: "person", cardinality: "many" });
    expect(edited.views!.some((view) => "source" in view)).toBe(false);
    expect(edited.said).toContain('The view "Check board" read updatedBy and connect-check-updated-by; its manifest now reads recheckedBy and connect-check-rechecked-by.');
    const diff = diffDocuments(tracker(), edited.document, { views: edited.views });
    expect(diff.brokenViews).toEqual([]);
    expect(diff.breaking).toBe(false);
  });

  it("says each view whose source still names the old key, and none whose source already reads the new one", () => {
    const edited = editDocument(tracker(), renameRelation, { views: kept });
    if (!edited.ok) throw new Error("refused");
    expect(edited.carried?.map((view) => [view.name, view.sourceNames])).toEqual([
      ["check-board", ["updatedBy"]],
      ["site-list", []],
    ]);
    expect(edited.said).toContain('The view "Check board"\'s source still names updatedBy: change it there too, or the view reads nothing by that name.');
    expect(edited.said.some((line) => line.startsWith('The view "Sites"\'s source'))).toBe(false);
  });

  it("is taken back whole by the rename the other way: the document and every manifest as they were", () => {
    const there = editDocument(tracker(), renameRelation, { views: kept });
    if (!there.ok) throw new Error("refused");
    const back = editDocument(there.document, [{ op: "rename-relation", kind: "check", relation: "recheckedBy", to: "updatedBy" }], { views: there.views });
    if (!back.ok) throw new Error("refused");
    expect(diffDocuments(tracker(), back.document).unchanged).toBe(true);
    const withoutSource = ({ source: _, ...manifest }: Kept) => manifest;
    expect(back.views).toEqual(kept.map(withoutSource));
  });

  it("carries a field renamed and a kind renamed the same way", () => {
    const edited = editDocument(
      tracker(),
      [
        { op: "rename-field", kind: "check", field: "photo", to: "picture" },
        { op: "rename-kind", kind: "check", to: "inspection" },
      ],
      { views: kept },
    );
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    const [carried] = edited.views!;
    expect(carried).toMatchObject({
      attach: "inspection",
      accepts: [{ kind: "inspection", field: "picture" }],
      pictures: { inspection: "picture" },
      acts: ["add-inspection", { act: "connect-inspection-updated-by", as: "assign" }],
    });
    expect(diffDocuments(tracker(), edited.document, { views: edited.views }).brokenViews).toEqual([]);
    const uncarried = diffDocuments(tracker(), edited.document, { views: kept });
    expect(uncarried.brokenViews.find((view) => view.name === "check-board")?.reads).toEqual(["check", "check's photo", "add-check"]);
  });
});
