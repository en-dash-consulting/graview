import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { startingDocument, type DropPart } from "../../src/compose.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";

/*
 * A STARTING DOCUMENT DROPS THE RULES AND VIEWS A PERSON UNTICKED. The
 * kinda turn asks about a template's kinds, rules and views alike, and
 * reads back the ones to drop as parts (`{ part, name }`); `drop` takes
 * those parts as they come, so a host no longer removes unticked rules and
 * views itself. Each is said in `left`, kept out of `took`, and is one of
 * the `edits` that make the same document from the base.
 */
const catalog = JSON.parse(readFileSync(new URL("./fixtures/cloud-catalog.json", import.meta.url), "utf8")) as { id: string; document: GraviewDocument }[];
const shortlist = catalog.find((one) => one.id === "vendor-shortlist")!.document;
const titles = (document: GraviewDocument) => (document.lenses ?? []).map((lens) => (lens as { title?: string }).title);

describe("a starting document drops the rules and views a person unticked", () => {
  const drop: DropPart[] = [
    { part: "rule", name: "booked-needs-quote" },
    { part: "lens", name: "Deadlines" },
  ];
  const made = startingDocument({ base: shortlist, name: "Vendors", drop });

  it("takes the rule and the view out, and the document compiles", () => {
    expect(Object.keys(made.document.rules ?? {})).not.toContain("booked-needs-quote");
    expect(Object.keys(made.document.rules ?? {})).toContain("within-budget");
    expect(titles(made.document)).not.toContain("Deadlines");
    expect(titles(made.document)).toContain("Vendors by status");
    expect(compileDocument(made.document).ok).toBe(true);
  });

  it("says each in left, keeps each out of took, and makes them edits", () => {
    expect(made.left).toEqual([
      { part: "booked-needs-quote", what: "rule", from: shortlist.name },
      { part: "Deadlines", what: "lens", from: shortlist.name },
    ]);
    expect(made.took.some((part) => part.part === "booked-needs-quote" || part.part === "Deadlines")).toBe(false);
    expect(made.edits).toContainEqual({ op: "remove-rule", rule: "booked-needs-quote" });
    expect(made.edits).toContainEqual({ op: "remove-lens", title: "Deadlines" });
    const replayed = editDocument(shortlist, made.edits);
    if (!replayed.ok) throw new Error(JSON.stringify(replayed.findings));
    expect(replayed.document).toEqual(made.document);
  });

  it("takes a kinda reading's parts whole, kinds among them, and a bare name as before", () => {
    const both = startingDocument({ base: shortlist, name: "Vendors", drop: ["budget", { part: "kind", name: "category" }, { part: "rule", name: "booked-needs-quote" }] });
    expect(Object.keys(both.document.kinds)).toEqual(["vendor"]);
    expect(both.left.map((part) => `${part.what}:${part.part}`)).toEqual(expect.arrayContaining(["kind:category", "rule:booked-needs-quote", "trait:budget"]));
    expect(compileDocument(both.document).ok).toBe(true);
  });

  it("says a rule or a view the base does not have, and changes nothing for it", () => {
    const none = startingDocument({ base: shortlist, name: shortlist.name, drop: [{ part: "rule", name: "no-such-rule" }, { part: "lens", name: "No such view" }] });
    expect(none.edits).toEqual([]);
    expect(none.said).toEqual([`${shortlist.name} has no rule called no-such-rule to leave out.`, `${shortlist.name} has no view called No such view to leave out.`]);
  });
});
