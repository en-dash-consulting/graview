import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { compileDocumentWithoutCheck, editDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * A CHECKER'S CODE IN A COMPILE CARRIES `check:` BEFORE IT, AND IS THE SAME
 * CODE (Roadmap f-count-past-graph-budget,
 * request:lens-cannot-draw-code-prefix). Cloud read `check:lens-cannot-draw`
 * from `compileDocument` and `lens-cannot-draw` from an `add-lens` refusal
 * and the 0.1.63 notes, and matched both. The prefix is systematic: what
 * the checker found of the app a document compiles to carries it; what the
 * document's own judgments found, the checker run alone and an edit's
 * refusal say the bare code — so one strip makes them the same.
 */
const every = JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8")) as GraviewDocument & { kinds: Record<string, { fields: Record<string, unknown> }> };
const { lenses: _lenses, pages: _pages, ...bare } = every as typeof every & { lenses?: unknown; pages?: unknown };
const document = structuredClone(bare) as typeof every;
document.kinds["shift"]!.fields["ends"] = { type: "date" };
const overDates = { ...document, lenses: [{ name: "timeline", title: "Roadmap", bindings: { shift: { start: "on", end: "ends", column: "day" } } }] } as GraviewDocument;
const bareCode = (code: string) => code.replace(/^check:/, "");

describe("a finding code", () => {
  it("is the checker's, with check: before it, wherever compileDocument ran the checker", () => {
    const compiled = compileDocument(overDates, { today: () => "2026-10-28" });
    const codes = compiled.findings.map((f) => f.code);
    expect(codes).toContain("check:lens-cannot-draw");
    expect(codes).not.toContain("lens-cannot-draw");
    // Every code with the prefix is a code the checker says bare of the same app.
    const app = compileDocumentWithoutCheck(overDates);
    if (!app.ok) throw new Error(JSON.stringify(app.findings));
    const checker = new Set(checkApp(app.app, { design: false }).findings.map((f) => f.code));
    for (const code of codes.filter((one) => one.startsWith("check:"))) expect(checker).toContain(bareCode(code));
  });

  it("is bare in an edit's refusal, and the same code once the prefix is stripped", () => {
    const refused = editDocument(document, [{ op: "add-lens", title: "Roadmap", lens: "timeline", bindings: { shift: { start: "on", end: "ends", column: "day" } } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    const compiled = compileDocument(overDates, { today: () => "2026-10-28" });
    expect(refused.findings.map((f) => f.code)).toEqual(["lens-cannot-draw"]);
    expect(compiled.findings.map((f) => bareCode(f.code))).toContain(refused.findings[0]!.code);
  });
});
