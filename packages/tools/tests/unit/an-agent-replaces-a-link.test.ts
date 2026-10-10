import { Store, type AnySchema, type GraviewApp, type Primitive } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * FR-156, on the agent's surface. A seat that ran a declared act with
 * `replaces: true` on a record that already had the link was answered
 * "Cannot remove missing edge" — by the act's own tool and by
 * `preview_mutation` alike. It now severs the old link and makes the new
 * one as one call, one batch and one undo.
 */
const compiled = compileDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Pricing model",
  kinds: {
    feature: { noun: "feature", plural: "Features", fields: { name: { type: "string", required: true } }, edges: { tier: { to: ["plan"], cardinality: "one", inverse: "features" } } },
    plan: { noun: "plan", plural: "Plans", fields: { name: { type: "string", required: true } } },
  },
  acts: { "set-tier": { title: "Set the tier", on: "feature", connects: "tier", replaces: true } },
});
if (!compiled.ok) throw new Error("the document compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = {
  nodes: [
    { id: "feature:apps", kind: "feature", name: "Apps" },
    { id: "plan:free", kind: "plan", name: "Free" },
    { id: "plan:pro", kind: "plan", name: "Pro" },
  ],
  edges: [{ kind: "tier", from: "feature:apps", to: "plan:free" }],
};
const fresh = () => {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: structuredClone(seed) as never });
  return { store, runtime: createToolRuntime(store, { author: { kind: "agent" } }) };
};
const changes = (primitives: readonly Primitive[]) => primitives.map((p) => ("edge" in p ? `${p.op} ${p.edge.kind} ${p.edge.from} ${p.edge.to}` : p.op));

describe("an agent replaces a link the record already has", () => {
  it("previews the sever and the connect", async () => {
    const { runtime } = fresh();
    const preview = await runtime.call("preview_mutation", { mutation: "set-tier", args: { id: "feature:apps", to: "plan:pro" } });
    expect(preview.ok).toBe(true);
    expect(changes((preview as { data: { primitives: Primitive[] } }).data.primitives)).toEqual(["remove-edge tier feature:apps plan:free", "add-edge tier feature:apps plan:pro"]);
  });

  it("runs the act as one call, and undoes it as one batch", async () => {
    const { store, runtime } = fresh();
    const result = await runtime.call("set-tier", { id: "feature:apps", to: "plan:pro" });
    expect(result.ok).toBe(true);
    expect(store.graph.out("feature:apps", "tier").map((n) => n.id)).toEqual(["plan:pro"]);
    const batch = (result as { data: { batch: string } }).data.batch;
    expect((await runtime.call("undo_batch", { batch })).ok).toBe(true);
    expect(store.graph.out("feature:apps", "tier").map((n) => n.id)).toEqual(["plan:free"]);
  });
});
