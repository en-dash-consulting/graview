import { readFileSync } from "node:fs";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";

/**
 * MONEY IS SAID AS MONEY ON A STATIC PAGE (found on a Graview Cloud app,
 * Oct 13). A deal's amount is a number marked `"format": "money"` in an
 * app whose currency is USD: the static page a host keeps (`renderPlace`)
 * said "10000". It reads the record as every face does, and says "$10,000".
 */
const { renderPlace } = await import("@graview/pages/static");
const deals = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/money.gdd.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const seed = {
  nodes: [
    { id: "d1", kind: "deal", name: "Acme rebrand", amount: 10000, margin: 0.125, effort: 90, weight: 12.5, fee: 1250.5, stage: "won" },
    { id: "d2", kind: "deal", name: "Harbor signage", amount: 4250.75, stage: "lead" },
  ],
  edges: [],
};

function opened() {
  const compiled = compileDocument(deals, { today: () => "2026-10-13" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const store = new Store<AnySchema>({ schema: compiled.app.schema as AnySchema, mutations: compiled.app.mutations ?? [], policy: compiled.app.policy!, snapshot: seed as never });
  return { app: compiled.app, store };
}

describe("a money field on a static page and in a kind's table", () => {
  it("a record's static page says its amount, margin, effort, weight and fee as declared", () => {
    const { app, store } = opened();
    const page = renderPlace(store, app as never, "/deals/d1", { viewer: owner, today: "2026-10-13" });
    for (const said of ["$10,000", "13%", "1 h 30 min", "12.5 kg", "€1,250.50"]) expect(page.html).toContain(said);
    expect(page.html).not.toMatch(/[^\d,.$€]10000[^\d,.]/);
  });

  it("a list's static page says each amount as money", () => {
    const { app, store } = opened();
    const page = renderPlace(store, app as never, "/deals", { viewer: owner, today: "2026-10-13" });
    expect(page.html).toContain("$10,000");
    expect(page.html).toContain("$4,250.75");
  });
});
