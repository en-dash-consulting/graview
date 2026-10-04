import { documentHash, type DocumentEdit } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { template, throughEditDocument, throughTheStudio, type Call } from "./templates.js";

/*
 * A NAME ALREADY WRITTEN AS ONE IS KEPT. A relation may be one camelCase
 * word ("tendedBy") and a field always is ("lastDone"); the studio folded
 * every new name to lower case, so `tendedBy` arrived as `tendedby` — a
 * different relation from the one editDocument and Graview Cloud's builder
 * make for the same words. A label that is already a legal name is the
 * name; anything else ("Phone number") is still made into one.
 */
const chores = template("household-chores");

describe("a name the studio is given is kept as it was written", () => {
  const cases: readonly { readonly name: string; readonly calls: readonly Call[]; readonly edits: readonly DocumentEdit[] }[] = [
    {
      name: "add-relation tendedBy",
      calls: [{ name: "add-edge", args: { kind: "declared:area", label: "tendedBy", to: "declared:person", cardinality: "one" } }],
      edits: [{ op: "add-relation", kind: "area", relation: "tendedBy", to: ["person"], cardinality: "one" }],
    },
    {
      name: "add-relation in kebab-case",
      calls: [{ name: "add-edge", args: { kind: "declared:area", label: "looked-after-by", to: "declared:person" } }],
      edits: [{ op: "add-relation", kind: "area", relation: "looked-after-by", to: ["person"] }],
    },
    {
      name: "add-field lastChecked",
      calls: [{ name: "add-field", args: { kind: "declared:area", label: "lastChecked", type: "date", required: false } }],
      edits: [{ op: "add-field", kind: "area", field: "lastChecked", type: "date" }],
    },
  ];

  it.each(cases.map((c) => [c.name, c] as const))("%s gives the document editDocument makes", async (_name, c) => {
    const studio = throughTheStudio(chores, c.calls);
    expect(studio.edits()).toEqual(c.edits);
    const outcome = studio.document();
    if (!outcome?.ok) throw new Error(JSON.stringify(outcome));
    expect(await documentHash(outcome.document)).toBe(await documentHash(throughEditDocument(chores, c.edits)));
  });

  it("words that are not yet a name are still made into one", () => {
    const studio = throughTheStudio(chores, [{ name: "add-edge", args: { kind: "declared:area", label: "Looked After By", to: "declared:person" } }]);
    expect(studio.edits()).toEqual([{ op: "add-relation", kind: "area", relation: "looked-after-by", to: ["person"] }]);
  });
});
