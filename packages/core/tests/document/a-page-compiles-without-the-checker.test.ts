import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocumentWithoutCheck } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * A PAGE COMPILES WITHOUT THE CHECKER. `compileDocument` judges a document
 * twice — its own sentences, then the framework's `checkApp` over the app —
 * and a page that compiled one in the browser carried the whole checker
 * though its host had judged the document already. The checker is now
 * `compileDocument`'s alone; `compileDocumentWithoutCheck` is the same app
 * from the same document, judged only by its own sentences (FR-57).
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"));

describe("a document compiled without the checker", () => {
  it("is the app compileDocument makes, without the checker's findings", () => {
    const judged = compileDocument(vendors);
    const unjudged = compileDocumentWithoutCheck(vendors);
    if (!judged.ok || !unjudged.ok) throw new Error("the vendors fixture should compile");
    expect(unjudged.app.schema.kinds).toEqual(judged.app.schema.kinds);
    expect(unjudged.app.mutations!.map((m) => m.name)).toEqual(judged.app.mutations!.map((m) => m.name));
    expect(unjudged.findings.filter((f) => f.code.startsWith("check:"))).toEqual([]);
    expect(judged.findings.filter((f) => !f.code.startsWith("check:"))).toEqual(unjudged.findings);
  });

  it("still refuses what the document itself gets wrong", () => {
    const broken = { ...vendors, rules: { ...vendors.rules, "booked-needs-quote": { ...vendors.rules["booked-needs-quote"], over: "venue" } } };
    const refused = compileDocumentWithoutCheck(broken);
    expect(refused.ok).toBe(false);
    expect(refused.findings.map((f) => f.code)).toContain("rule-kind");
  });

  it("is judged by the checker only when compileDocument is asked", () => {
    const nobody = { ...vendors, policy: { grants: [{ roles: ["owner"], mutations: ["book"] }] } };
    const judged = compileDocument(nobody);
    const unjudged = compileDocumentWithoutCheck(nobody);
    expect(unjudged.ok).toBe(true);
    expect(judged.findings.some((f) => f.code.startsWith("check:"))).toBe(true);
  });
});
