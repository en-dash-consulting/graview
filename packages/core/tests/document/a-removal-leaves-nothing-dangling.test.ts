import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { FIXTURES } from "../../src/conformance/fixtures.js";

/**
 * A REMOVAL LEAVES NOTHING DANGLING. Removing a kind took with it the
 * relations that led TO it, but not the ones it declared itself: a rule
 * over another kind that walked one of those (`count(in('fills') where …)`
 * over a category, when the vendor kind went) stayed, and the document no
 * longer compiled — "fills" is not a relation any kind declares. In five of
 * Cloud's twelve templates, removing one kind broke the app. Now whatever
 * cannot stand without the kind goes with it, and the edit says so; and
 * every single removal, of a kind, a field or a relation, in every fixture
 * here, leaves a document that compiles.
 */
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const documents: readonly [string, GraviewDocument][] = [
  ["vendors", read("./fixtures/vendors.gdd.json") as GraviewDocument],
  ["vendor-shortlist", read("./fixtures/vendor-shortlist.template.json").document as GraviewDocument],
  ...FIXTURES.flatMap((fixture) => (fixture.kind === "document" && fixture.expect.compiles ? [[fixture.id, fixture.document as GraviewDocument] as [string, GraviewDocument]] : [])),
];

function removals(document: GraviewDocument): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    out.push({ op: "remove-kind", kind });
    for (const field of Object.keys(spec.fields)) out.push({ op: "remove-field", kind, field });
    for (const relation of Object.keys(spec.edges ?? {})) out.push({ op: "remove-relation", kind, relation });
  }
  return out;
}

describe("a removal leaves nothing dangling", () => {
  it("removing the vendor kind takes the rules that walked its fills relation, and says so", () => {
    const vendors = documents[0]![1];
    const outcome = editDocument(vendors, [{ op: "remove-kind", kind: "vendor" }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(Object.keys(outcome.document.rules ?? {})).not.toContain("one-booked-per-category");
    expect(Object.keys(outcome.document.rules ?? {})).not.toContain("within-budget");
    expect(outcome.said.join(" ")).toMatch(/rule one-booked-per-category/);
    expect(outcome.said.join(" ")).toMatch(/rule within-budget/);
    const compiled = compileDocument(outcome.document);
    expect(compiled.ok ? [] : compiled.findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  for (const [name, document] of documents) {
    it(`every removal from ${name} compiles, or is refused in words`, () => {
      const broken: string[] = [];
      for (const edit of removals(document)) {
        const outcome = editDocument(document, [edit]);
        if (!outcome.ok) {
          // A refusal is fine when it says why (a kind keeps one field; an app keeps one kind).
          for (const finding of outcome.findings) expect(finding.message.length).toBeGreaterThan(10);
          continue;
        }
        const compiled = compileDocument(outcome.document);
        if (!compiled.ok) broken.push(`${JSON.stringify(edit)}: ${compiled.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} at ${finding.path}`).join("; ")}`);
      }
      expect(broken).toEqual([]);
    });
  }
});
