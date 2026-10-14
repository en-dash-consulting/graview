import { readFileSync } from "node:fs";
import { Store, type AnySchema } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { cellOf, tableColumns } from "../../src/kind-shape.js";

/**
 * A KIND'S TABLE SAYS MONEY AS MONEY (found on a Graview Cloud app, Oct 13).
 * A deal's amount, a number marked `"format": "money"` in an app whose
 * currency is USD, read "10000" in its cell; it reads "$10,000", as the
 * record page, the list and the cards say it.
 */
const deals = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/money.gdd.json", import.meta.url), "utf8"));

describe("a kind's table", () => {
  it("says each amount as money in the app's currency", () => {
    const compiled = compileDocument(deals, { today: () => "2026-10-13" });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    const store = new Store<AnySchema>({
      schema: compiled.app.schema as AnySchema,
      mutations: compiled.app.mutations ?? [],
      policy: compiled.app.policy!,
      snapshot: { nodes: [{ id: "d1", kind: "deal", name: "Acme rebrand", amount: 10000, stage: "won" }, { id: "d2", kind: "deal", name: "Harbor signage", amount: 4250.75, stage: "lead" }] as never, edges: [] },
    });
    const nodes = store.graph.nodesOfKind("deal");
    const amount = tableColumns(store.schema, "deal", nodes, store.graph).find((column) => column.key === "amount");
    expect(amount).toBeDefined();
    expect(nodes.map((node) => cellOf(store.schema, node, amount!, store.graph).text).sort()).toEqual(["$10,000", "$4,250.75"]);
  });
});
