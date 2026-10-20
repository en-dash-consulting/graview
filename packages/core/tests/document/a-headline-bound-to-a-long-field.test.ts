import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { validateViewSpecs, validateViews } from "../../src/document/index.js";
import { createSchema, defineNode, markdownField, z } from "../../src/index.js";

/**
 * A HEADLINE BOUND TO A LONG FIELD. `{"headline": "{call}"}`, where `call`
 * is a text of three sentences, filled a focus card at display size: a
 * headline is a few words, drawn large. `graview check` says so where a
 * view's headline binds a long text whole, and names the text block that
 * says it at the size of words.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Dispatch",
  kinds: {
    incident: {
      noun: "incident",
      plural: "incidents",
      fields: { name: { type: "string", required: true }, call: { type: "text" }, notes: { type: "text", format: "markdown" } },
    },
  },
  views: { incident: { page: [{ headline: "{call}" }, { headline: "{notes}" }, { headline: "{name}" }, { headline: "{call|excerpt: 60}" }, { text: "{call}" }] } },
};

describe("graview check, on a headline that binds a long field", () => {
  it("warns where a headline binds a text or a markdown field whole, and names the text block; a string, an excerpt and a text block say nothing", () => {
    const findings = validateViews(document as never).filter((finding) => finding.code === "view-headline-long");
    expect(findings.map((finding) => [finding.severity, finding.path])).toEqual([
      ["warning", "views.incident.page.0.headline"],
      ["warning", "views.incident.page.1.headline"],
    ]);
    expect(findings[0]!.message).toBe("incident page heads it with call, a long text, drawn at a headline's size; a headline is a few words.");
    expect(findings[0]!.fix).toBe('say it in a text block, {"text": "{call}"}, or head it with {call|excerpt: 60}');
  });

  it("is a warning, so the document still compiles", () => {
    const result = compileDocument(document, { today: () => "2026-10-20" });
    expect(result.ok).toBe(true);
    expect(result.findings.filter((finding) => finding.code === "view-headline-long")).toHaveLength(2);
  });

  it("reads a TypeScript declaration's long string and Markdown field as long", () => {
    const incident = defineNode("incident", { fields: z.object({ name: z.string(), call: z.string().max(5000), notes: markdownField().optional(), code: z.string() }) });
    const findings = validateViewSpecs(createSchema([incident]), { incident: { card: [{ headline: "{call}" }, { headline: "{notes}" }, { headline: "{code}" }] } });
    expect(findings.filter((finding) => finding.code === "view-headline-long").map((finding) => finding.path)).toEqual(["viewSpecs.incident.card.0.headline", "viewSpecs.incident.card.1.headline"]);
  });
});
