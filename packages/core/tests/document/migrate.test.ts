import { readFileSync } from "node:fs";
import { UNSET } from "../../src/index.js";
import { describe, expect, it } from "vitest";
import { applyPatch, compileDocument, diffDocuments, planMigration, readDocument, type GraviewDocument } from "../../src/document/index.js";

const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;

const graph = {
  nodes: [
    { id: "category:venue", kind: "category", name: "Venue", budget: 10000 },
    { id: "vendor:barn", kind: "vendor", name: "The Barn", status: "booked", quote: 8000, notes: "lovely", due: "2026-11-01" },
    { id: "vendor:loft", kind: "vendor", name: "The Loft", status: "contacted", notes: "12,500" },
  ],
  edges: [
    { kind: "fills", from: "vendor:barn", to: "category:venue" },
    { kind: "fills", from: "vendor:loft", to: "category:venue" },
  ],
};

/** Apply a plan to the stored graph and prove the result fits the NEW declaration. */
function migrated(after: GraviewDocument) {
  const compiled = compileDocument(after, { skipFrameworkCheck: true });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const plan = planMigration(vendors, after, graph);
  const result = applyLoose(graph, plan.primitives as never);
  for (const node of result.nodes) (compiled.app.schema as unknown as { parseNode(n: unknown): unknown }).parseNode(node);
  return { plan, result };
}

/** A schema-free fold of primitives, so the test can check the result against the new schema itself. */
function applyLoose(start: typeof graph, primitives: { op: string; node?: Record<string, unknown>; edge?: { kind: string; from: string; to: string }; id?: string; after?: Record<string, unknown> }[]) {
  const nodes = new Map(start.nodes.map((n) => [n.id, { ...n } as Record<string, unknown>]));
  const edges = new Map(start.edges.map((e) => [`${e.kind}|${e.from}|${e.to}`, e]));
  for (const p of primitives) {
    if (p.op === "patch-node") {
      const n = nodes.get(p.id!)!;
      for (const [k, v] of Object.entries(p.after!)) if (v === UNSET || v === undefined) delete n[k];
      else n[k] = v;
    } else if (p.op === "remove-node") nodes.delete(String(p.node!["id"]));
    else if (p.op === "add-node") nodes.set(String(p.node!["id"]), { ...p.node! });
    else if (p.op === "remove-edge") edges.delete(`${p.edge!.kind}|${p.edge!.from}|${p.edge!.to}`);
    else if (p.op === "add-edge") edges.set(`${p.edge!.kind}|${p.edge!.from}|${p.edge!.to}`, p.edge!);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

describe("a change to an app keeps what it can", () => {
  it("a renamed field keeps its values, and the diff says renamed", () => {
    const after = applyPatch(vendors, [
      { op: "remove", path: "/kinds/vendor/fields/quote" },
      { op: "add", path: "/kinds/vendor/fields/price", value: { type: "number", format: "money", renamedFrom: "quote" } },
      { op: "replace", path: "/kinds/vendor/describe", value: "{status} · {price|money}" },
      { op: "replace", path: "/rules/booked-needs-quote/require", value: "price != null" },
      { op: "replace", path: "/rules/within-budget/require", value: "sum(in('fills') where status == 'booked', price) <= budget" },
      { op: "replace", path: "/acts/set-quote/writes", value: ["price"] },
    ]);
    const { plan, result } = migrated(after);
    expect(result.nodes.find((n) => n["id"] === "vendor:barn")!["price"]).toBe(8000);
    expect(result.nodes.find((n) => n["id"] === "vendor:barn")!["quote"]).toBeUndefined();
    expect(plan.counts).toMatchObject({ moved: 1, cleared: 0 });
    expect(plan.words).toContain("vendor's quote renamed to price, values kept (1 record).");
    const diff = diffDocuments(vendors, after);
    expect(diff.sentences).toContain("vendor's quote is renamed to price; its values are kept.");
    expect(diff.removedFields).toEqual([]);
  });

  it("text becomes a number where it parses, and the rest is counted as cleared", () => {
    const after = applyPatch(vendors, [{ op: "replace", path: "/kinds/vendor/fields/notes", value: { type: "number" } }]);
    const { plan, result } = migrated(after);
    expect(result.nodes.find((n) => n["id"] === "vendor:loft")!["notes"]).toBe(12500);
    expect(result.nodes.find((n) => n["id"] === "vendor:barn")!["notes"]).toBeUndefined();
    expect(plan.counts).toMatchObject({ coerced: 1, cleared: 1 });
  });

  it("an enum option no longer offered is cleared, and a required field takes its default", () => {
    const after = applyPatch(vendors, [{ op: "replace", path: "/kinds/vendor/fields/status/options", value: ["researching", "booked", "declined"] }]);
    const { result, plan } = migrated(after);
    // "contacted" is gone; status is required with a default, so the Loft falls back to it.
    expect(result.nodes.find((n) => n["id"] === "vendor:loft")!["status"]).toBe("researching");
    expect(plan.counts.defaulted).toBe(1);
  });

  it("a renamed kind keeps its records, their ids and their links", () => {
    let after = structuredClone(vendors) as GraviewDocument & { kinds: Record<string, unknown> };
    const spec = { ...(after.kinds as Record<string, unknown>)["category"] as object, renamedFrom: "category" };
    delete (after.kinds as Record<string, unknown>)["category"];
    (after.kinds as Record<string, unknown>)["section"] = spec;
    after = JSON.parse(JSON.stringify(after).replace(/"category"/g, '"section"').replace(/"renamedFrom":"section"/, '"renamedFrom":"category"'));
    const { result, plan } = migrated(after);
    expect(result.nodes.find((n) => n["id"] === "category:venue")!["kind"]).toBe("section");
    expect(result.edges).toHaveLength(2);
    expect(plan.words).toContain("category renamed to section, records kept (1 record).");
  });

  it("a removed kind takes its records and their links with it", () => {
    const after = structuredClone(vendors) as GraviewDocument;
    delete (after.kinds as Record<string, unknown>)["category"];
    delete (after.kinds.vendor as { edges?: unknown }).edges;
    for (const a of ["add-category", "add-to-category", "file-under", "unfile"]) delete (after.acts as Record<string, unknown>)[a];
    delete (after.rules as Record<string, unknown>)["one-booked-per-category"];
    delete (after.rules as Record<string, unknown>)["within-budget"];
    const { result, plan } = migrated(after);
    expect(result.nodes.map((n) => n["id"]).sort()).toEqual(["vendor:barn", "vendor:loft"]);
    expect(result.edges).toEqual([]);
    expect(plan.counts).toMatchObject({ removedNodes: 1, removedEdges: 2 });
  });
});
