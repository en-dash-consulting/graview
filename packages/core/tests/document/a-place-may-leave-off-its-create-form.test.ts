import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { editDocument, readDocument, type GraviewDocument } from "../../src/document/index.js";
import { declaredLenses, type GraviewApp } from "../../src/index.js";

/**
 * A PLACE MAY LEAVE OFF THE FORMS THAT BEGIN ITS KIND. Every place's page
 * ended with the create form for the kind it stands on; on a page that is
 * read, not written — a summary — that is noise. A lens says `"create":
 * false`, and the document's shape, the check, the place it makes and the
 * edit that adds it all carry it.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/blocks-layout.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

function compiled(doc: unknown): GraviewApp {
  const result = compileDocument(doc, { today: () => "2026-10-15" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app;
}

describe("a place may leave off its create form", () => {
  it("says so on the place it makes, and only on that place", () => {
    const { drawn } = declaredLenses(compiled(review));
    expect(drawn.map((lens) => [lens.title, lens.create])).toEqual([
      ["The summary", false],
      ["Every finding", undefined],
    ]);
  });

  it("is a yes or a no in the document's shape, and its JSON Schema", () => {
    const lenses = (review.lenses ?? []) as Record<string, unknown>[];
    const said = readDocument({ ...review, lenses: [{ ...lenses[0], create: "no" }, lenses[1]] });
    expect(said.findings.filter((f) => f.severity === "error").map((f) => f.path)).toContain("lenses.0.create");
    const schema = documentJsonSchema("0.0.0") as { properties: { lenses: { items: { properties: Record<string, unknown> } } } };
    expect(schema.properties.lenses.items.properties["create"]).toEqual({ type: "boolean" });
  });

  it("is written by add-lens, and said", () => {
    const outcome = editDocument(review, [{ op: "add-lens", title: "The report", on: "finding", create: false, options: { blocks: [{ list: "all('finding')", as: "row" }] } }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect((outcome.document.lenses ?? []).at(-1)).toMatchObject({ title: "The report", create: false });
    expect(outcome.said.join(" ")).toMatch(/A lens "The report" is added, over findings; its page offers no form to add one\./);
  });
});
