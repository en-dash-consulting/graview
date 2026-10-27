import { compileDocumentWithoutCheck, toDocument, type GraviewDocument } from "@graview/core/document";
import type { InvariantDefinition } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * A COVERAGE RULE KEEPS ITS WALK THROUGH THE STUDIO (Roadmap
 * f-rule-covers-every). A rule judged by `covers` has no `require`, and the
 * studio used to read every document rule by its `require` alone: opened
 * and handed back, a coverage rule would have come back as a rule that
 * judges nothing, and the studio's edits would have said it "says nothing
 * that must hold". Its walk is three words on the rule node now, handed
 * back as the same `covers`, written back as `coverageRule`, and said as
 * `covers` in the edits the studio hands a host.
 */
const GUIDE: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Voter guide",
  kinds: {
    candidate: {
      fields: { name: { type: "string", required: true } },
      edges: { stances: { to: ["stance"], cardinality: "many", description: "the stances this candidate has taken", inverse: "the candidate who holds it" } },
    },
    issue: { fields: { title: { type: "string", required: true } }, label: "{title}" },
    stance: {
      fields: { position: { type: "enum", options: ["for", "against"], required: true } },
      edges: { issue: { to: ["issue"], cardinality: "one", description: "the issue this stance is on", inverse: "the stances on it" } },
    },
  },
  rules: {
    "stance-on-every-issue": { title: "A stance on every issue", over: "candidate", covers: { every: "issue", through: "stances", via: "issue" }, says: "{candidate} has no stance on {issue}" },
  },
} as GraviewDocument;

function studioOn(document: GraviewDocument) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return createStudio(compiled.app);
}

describe("a coverage rule keeps its walk through the studio", () => {
  it("is a rule node carrying the kind it covers and the relations it walks, with no require", () => {
    const studio = studioOn(GUIDE);
    const rule = studio.store.graph.getNode("rule:stance-on-every-issue") as Record<string, unknown> | undefined;
    expect(rule).toMatchObject({ kind: "rule", coversEvery: "issue", coversThrough: "stances", coversVia: "issue", says: "{candidate} has no stance on {issue}" });
    expect(rule?.["require"]).toBeUndefined();
  });

  it("is handed back as the same covers, and judged as one", () => {
    const studio = studioOn(GUIDE);
    const declared = studio.declaration();
    const rule = (declared.invariants as readonly InvariantDefinition[]).find((one) => one.name === "stance-on-every-issue")!;
    expect(rule.judgment).toEqual({ covers: { every: "issue", through: "stances", via: "issue" }, says: "{candidate} has no stance on {issue}" });
    // The studio gives every rule the description it was shown by; the rest comes back as it went in.
    expect(toDocument(declared).document.rules?.["stance-on-every-issue"]).toMatchObject(GUIDE.rules!["stance-on-every-issue"]!);
    // Nothing is said to the host: the document came back as it went in.
    expect(studio.edits()).toEqual([]);
  });

  it("is written back as coverageRule, which the file imports", () => {
    const studio = studioOn(GUIDE);
    const rules = (studio.files() as readonly { path: string; contents: string }[]).find((file) => file.path.endsWith("invariants.ts"))!;
    expect(rules.contents).toContain(`import { coverageRule } from "@graview/core/document";`);
    expect(rules.contents).toContain(`coverageRule("stance-on-every-issue", {`);
    expect(rules.contents).toContain(`covers: { every: "issue", through: "stances", via: "issue" },`);
    expect(rules.contents).not.toContain("evaluate: () => []");
  });

  it("a renamed kind or relation is followed in the walk, and said to the host as the rule given again", () => {
    const studio = studioOn(GUIDE);
    studio.store.apply({ name: "rename-kind", args: { id: "declared:issue", label: "topic" } });
    const document = toDocument(studio.declaration()).document;
    expect(document.rules?.["stance-on-every-issue"]?.covers).toEqual({ every: "topic", through: "stances", via: "issue" });
    const handed = studio.document();
    expect(handed?.ok).toBe(true);
    if (!handed?.ok) return;
    expect(handed.document.rules?.["stance-on-every-issue"]?.covers).toEqual({ every: "topic", through: "stances", via: "issue" });
  });
});
