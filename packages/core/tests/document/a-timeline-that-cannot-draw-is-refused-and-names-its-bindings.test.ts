import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { declaredLenses } from "../../src/index.js";

/**
 * A TIMELINE IS ACCEPTED ONLY WHERE IT DRAWS (Roadmap f-lifelogics-findings,
 * request bug-a-timeline-lens-is-accepted-but-never-becomes-a-place). On
 * LifeLogics Estimates an `add-lens` with lens `timeline` over an
 * initiative's start and end dates applied cleanly and was never a place: a
 * timeline lays out spans by number (minutes of a day) across columns, and
 * dates with no column gave it neither. Now the edit refuses it in the
 * checker's own code, naming the bindings a timeline takes and the calendar
 * that draws spans of dates; the checker says the same of a declaration
 * written by hand; and what the edit accepts draws.
 */
const every = JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8")) as GraviewDocument & { kinds: Record<string, { fields: Record<string, unknown> }> };
const { lenses: _lenses, pages: _pages, ...bare } = every as typeof every & { lenses?: unknown; pages?: unknown };
const document = structuredClone(bare) as typeof every;
document.kinds["shift"]!.fields["ends"] = { type: "date" };

describe("add-lens with a timeline", () => {
  it("refuses one over dates, naming the bindings a timeline takes and the calendar that draws dates", () => {
    const refused = editDocument(document, [{ op: "add-lens", title: "Roadmap", lens: "timeline", bindings: { shift: { start: "on", end: "ends" } } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings).toHaveLength(1);
    expect(refused.findings[0]).toMatchObject({ severity: "error", code: "lens-cannot-draw", path: "edits.0.bindings.shift.start" });
    expect(refused.findings[0]!.message).toContain("shift's on is a date field, and a timeline's axis is a number");
    expect(refused.findings[0]!.fix).toContain('"lens": "calendar", "bindings": { "shift": { "start": "on", "end": "ends" } }');
  });

  it("refuses one over numbers with nowhere to put a span", () => {
    const refused = editDocument(document, [{ op: "add-lens", title: "The day", lens: "timeline", bindings: { shift: { start: "from", end: "until" } } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]).toMatchObject({ code: "lens-cannot-draw", path: "edits.0.options.columns" });
  });

  it("accepts one over numbers with columns, and it draws as a place", () => {
    for (const lens of [
      { op: "add-lens", title: "The week", lens: "timeline", bindings: { shift: { start: "from", end: "until", column: "day" } } },
      { op: "add-lens", title: "The week", lens: "timeline", bindings: { shift: { start: "from", end: "until" } }, options: { columns: ["mon", "tue"] } },
    ]) {
      const added = editDocument(document, [lens]);
      expect(added.ok).toBe(true);
      if (!added.ok) return;
      const compiled = compileDocument(added.document, { today: () => "2026-10-28" });
      if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
      expect(declaredLenses(compiled.app).drawn.map((one) => [one.lens, one.as])).toEqual([["timeline", "the-week"]]);
    }
  });
});

describe("the checker, of a timeline declared by hand over dates", () => {
  it("says it cannot draw at the binding's path, and names the bindings a timeline takes", () => {
    const result = compileDocument({ ...document, lenses: [{ name: "timeline", title: "Roadmap", bindings: { shift: { start: "on", end: "ends", column: "day" } } }] }, { today: () => "2026-10-28" });
    const finding = result.findings.find((f) => f.code.endsWith("lens-cannot-draw"));
    expect(finding).toMatchObject({ path: "lenses.0.bindings.shift.start" });
    expect(finding?.message).toContain('its start "on" is not a number');
    expect(finding?.fix).toContain('"start": "<a number field>", "end": "<a number field>", "column": "<a choice field, like a weekday>"');
    expect(finding?.fix).toContain('"lens": "calendar"');
  });
});
