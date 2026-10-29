import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, formatMoney, parseTemplate, renderTemplate, type GraviewDocument } from "../../src/document/index.js";
import { Store, type AnySchema } from "../../src/index.js";
import { amountOf } from "../../src/schema/amount-mark.js";
import { sayAmount } from "../../src/document/amount.js";

/**
 * MONEY NEVER READS ".00", AND MAY BE SAID IN WHOLE UNITS (Roadmap
 * f-lifelogics-findings, request
 * bug-money-shows-00-cents-on-some-amounts-and-none-on-others). On
 * LifeLogics Estimates one list read "$11,424.00" beside "$7,840" and
 * "$22,758.40": a sum worked out as 11423.999999… was not whole, so it took
 * two places that rounded to ".00". The rule is one: a sum is rounded to
 * the cent, and shows cents only where it has them. And a money field's
 * `"places": 0` — a template's `{total | money: 0}` — says it in whole
 * units, rounded.
 */
const money = JSON.parse(readFileSync(new URL("./fixtures/money.gdd.json", import.meta.url), "utf8")) as GraviewDocument & { kinds: Record<string, { fields: Record<string, Record<string, unknown>> }> };
const usd = { currency: "USD", locale: "en-US" };

describe("a sum of money", () => {
  it("never reads .00: a sum that rounds to whole cents is said whole", () => {
    expect(formatMoney(11424, usd)).toBe("$11,424");
    expect(formatMoney(11423.999999999998, usd)).toBe("$11,424");
    expect(formatMoney(7840.004, usd)).toBe("$7,840");
    expect(formatMoney(22758.4, usd)).toBe("$22,758.40");
    expect(formatMoney(0.1 + 0.2, usd)).toBe("$0.30");
  });

  it("is said in whole units, rounded, where it is told 0 places", () => {
    expect(formatMoney(22758.4, usd, 0)).toBe("$22,758");
    expect(formatMoney(467566.5, usd, 0)).toBe("$467,567");
  });

  it("in a template, money: 0 says whole units, and anything else after money is refused", () => {
    const parts = parseTemplate("{total | money: 0} of {total | money}");
    expect(renderTemplate(parts, { node: { id: "e", kind: "estimate", total: 467566.4 } as never, kinds: new Map([["estimate", { fields: new Set(["total"]), edges: new Map() }]]), money: usd })).toBe("$467,566 of $467,566.40");
    expect(() => parseTemplate("{total | money: 2}")).toThrow(/money is told 0 for whole units/);
  });
});

describe("a money field's places", () => {
  it("is 0 on a money field, and every face that says the field says it whole", () => {
    const doc = structuredClone(money);
    doc.kinds["deal"]!.fields["amount"]!["places"] = 0;
    const result = compileDocument(doc, { today: () => "2026-10-28" });
    if (!result.ok) throw new Error(JSON.stringify(result.findings));
    const mark = amountOf((result.app.schema.tryDefinition("deal")!.fields.shape as Record<string, unknown>)["amount"]);
    expect(mark).toMatchObject({ format: "money", places: 0 });
    expect(sayAmount(22758.4, mark!)).toBe("$22,758");
    // And the kind's describe line, which says the field bare.
    const store = new Store<AnySchema>({ schema: result.app.schema, mutations: [], snapshot: { nodes: [{ id: "d1", kind: "deal", name: "Pier", amount: 22758.4, stage: "won" }], edges: [] } as never });
    expect(result.app.schema.tryDefinition("deal")!.describe!(store.graph.getNode("d1") as never)).toBe("Pier for $22,758");
  });

  it("is refused on a field that is not money", () => {
    const doc = structuredClone(money);
    doc.kinds["deal"]!.fields["weight"]!["places"] = 0;
    const result = compileDocument(doc, { today: () => "2026-10-28" });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.path.endsWith("weight.places") && f.message.includes('"places" belongs only on money'))).toBe(true);
  });

  it("is set and cleared by set-format, and refused on a percent", () => {
    const set = editDocument(money, [{ op: "set-format", kind: "deal", field: "amount", places: 0 }]);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect((set.document.kinds["deal"]!.fields["amount"] as Record<string, unknown>)["places"]).toBe(0);
    expect(set.said.join(" ")).toContain("money in USD, in whole units — 1250.5 reads $1,251");
    const cleared = editDocument(set.document, [{ op: "set-format", kind: "deal", field: "amount", places: null }]);
    expect(cleared.ok && (cleared.document.kinds["deal"]!.fields["amount"] as Record<string, unknown>)["places"]).toBe(undefined);
    const refused = editDocument(money, [{ op: "set-format", kind: "deal", field: "margin", places: 0 }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]).toMatchObject({ path: "edits.0.places" });
  });
});
