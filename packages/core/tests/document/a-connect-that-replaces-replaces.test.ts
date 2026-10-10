import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp, type Primitive } from "../../src/index.js";

/**
 * FR-156. A CONNECT THAT REPLACES REPLACES THE LINK IT SHOULD.
 *
 * `replaces: true` on an act that connects a cardinality-one relation
 * severed the record's link once for `replaces` and again for the
 * relation's cardinality, from the same graph as it stood before the act;
 * the second removal named an edge the first had already taken, and the
 * store refused the whole act with "Cannot remove missing edge". So the act
 * ran only on a record with no such link — the one case it is not for.
 * Here the existing link is severed once and the new one made, as one act,
 * one batch and one undo, by every road a seat takes: `apply`, `applyAll`,
 * `preview` and `previewAll`.
 */
const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Pricing model",
  kinds: {
    feature: {
      noun: "feature",
      plural: "Features",
      fields: { name: { type: "string", required: true } },
      edges: {
        tier: { to: ["plan"], cardinality: "one", inverse: "features" },
        plans: { to: ["plan"], cardinality: "many", inverse: "features offered" },
      },
    },
    plan: {
      noun: "plan",
      plural: "Plans",
      fields: { name: { type: "string", required: true } },
      edges: {
        // Declared from the plan: a feature's `lands` is at the far end.
        lands: { to: ["feature"], cardinality: "one", inverse: "landed by" },
      },
    },
  },
  acts: {
    "set-tier": { title: "Set the tier", on: "feature", connects: "tier", replaces: true },
    "offer-only-on": { title: "Offer only on", on: "feature", connects: "plans", replaces: true },
    "land-on": { title: "Land on", on: "feature", connects: "lands", replaces: true },
    "set-tier-and-plan": { title: "Set the tier and the plan", on: "feature", connects: "tier", replaces: ["tier", "plans"] },
  },
};

const compiled = compileDocument(doc, { today: () => "2026-10-09" });
if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
const app = compiled.app as GraviewApp<AnySchema>;

const seed = {
  nodes: [
    { id: "feature:apps", kind: "feature", name: "Apps" },
    { id: "feature:seats", kind: "feature", name: "Seats" },
    { id: "plan:free", kind: "plan", name: "Free" },
    { id: "plan:pro", kind: "plan", name: "Pro" },
    { id: "plan:team", kind: "plan", name: "Team" },
  ],
  edges: [
    { kind: "tier", from: "feature:apps", to: "plan:free" },
    { kind: "plans", from: "feature:apps", to: "plan:free" },
    { kind: "plans", from: "feature:apps", to: "plan:team" },
    { kind: "lands", from: "plan:free", to: "feature:apps" },
  ],
};
const storeOf = () => new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: structuredClone(seed) as never });
const out = (store: Store<AnySchema>, id: string, relation: string) => store.graph.out(id, relation).map((n) => n.id).sort();
const into = (store: Store<AnySchema>, id: string, relation: string) => store.graph.in(id, relation).map((n) => n.id).sort();
const changes = (primitives: readonly Primitive[]) => primitives.map((p) => ("edge" in p ? `${p.op} ${p.edge.kind} ${p.edge.from} ${p.edge.to}` : p.op));

describe("a connect that replaces, on a record that already has the link", () => {
  it("severs the old link once and makes the new one, as one act", () => {
    const store = storeOf();
    const result = store.apply({ name: "set-tier", args: { id: "feature:apps", to: "plan:pro" } });
    expect(changes(result.primitives)).toEqual(["remove-edge tier feature:apps plan:free", "add-edge tier feature:apps plan:pro"]);
    expect(out(store, "feature:apps", "tier")).toEqual(["plan:pro"]);
  });

  it("is one undo", () => {
    const store = storeOf();
    const { batch } = store.apply({ name: "set-tier", args: { id: "feature:apps", to: "plan:pro" } });
    expect(store.batches().filter((b) => b.id === batch)).toHaveLength(1);
    store.undo(batch);
    expect(out(store, "feature:apps", "tier")).toEqual(["plan:free"]);
  });

  it("previews both the sever and the connect", () => {
    const store = storeOf();
    const preview = store.preview({ name: "set-tier", args: { id: "feature:apps", to: "plan:pro" } });
    expect(changes(preview.primitives)).toEqual(["remove-edge tier feature:apps plan:free", "add-edge tier feature:apps plan:pro"]);
    expect(out(store, "feature:apps", "tier")).toEqual(["plan:free"]);
  });

  it("changes nothing when the link it makes is the one it has", () => {
    const store = storeOf();
    expect(store.preview({ name: "set-tier", args: { id: "feature:apps", to: "plan:free" } }).primitives).toEqual([]);
  });

  it("runs inside a batch, and two acts on the same relation in one batch leave the last one's link", () => {
    const store = storeOf();
    const calls = [
      { name: "set-tier", args: { id: "feature:apps", to: "plan:pro" } },
      { name: "set-tier", args: { id: "feature:apps", to: "plan:team" } },
      { name: "set-tier", args: { id: "feature:seats", to: "plan:pro" } },
    ];
    const preview = store.previewAll(calls);
    expect(changes(preview.primitives)).toEqual([
      "remove-edge tier feature:apps plan:free",
      "add-edge tier feature:apps plan:pro",
      "remove-edge tier feature:apps plan:pro",
      "add-edge tier feature:apps plan:team",
      "add-edge tier feature:seats plan:pro",
    ]);
    const result = store.applyAll(calls);
    expect(out(store, "feature:apps", "tier")).toEqual(["plan:team"]);
    expect(out(store, "feature:seats", "tier")).toEqual(["plan:pro"]);
    store.undo(result.batch);
    expect(out(store, "feature:apps", "tier")).toEqual(["plan:free"]);
    expect(out(store, "feature:seats", "tier")).toEqual([]);
  });

  it("replaces a link stored from the other end, where the relation is declared on the far kind", () => {
    const store = storeOf();
    const result = store.apply({ name: "land-on", args: { id: "feature:apps", to: "plan:pro" } });
    expect(changes(result.primitives)).toEqual(["remove-edge lands plan:free feature:apps", "add-edge lands plan:pro feature:apps"]);
    expect(into(store, "feature:apps", "lands")).toEqual(["plan:pro"]);
  });

  it("on a relation of many, replaces every link the record has of it with the one it makes", () => {
    const store = storeOf();
    store.apply({ name: "offer-only-on", args: { id: "feature:apps", to: "plan:pro" } });
    expect(out(store, "feature:apps", "plans")).toEqual(["plan:pro"]);
    // Keeping one it already has: the others go, that one stays and is not made again.
    const again = storeOf();
    const kept = again.apply({ name: "offer-only-on", args: { id: "feature:apps", to: "plan:team" } });
    expect(changes(kept.primitives)).toEqual(["remove-edge plans feature:apps plan:free"]);
    expect(out(again, "feature:apps", "plans")).toEqual(["plan:team"]);
  });

  it("replaces several relations at once, the one it connects among them", () => {
    const store = storeOf();
    const result = store.apply({ name: "set-tier-and-plan", args: { id: "feature:apps", to: "plan:pro" } });
    expect(changes(result.primitives).sort()).toEqual(
      ["add-edge tier feature:apps plan:pro", "remove-edge plans feature:apps plan:free", "remove-edge plans feature:apps plan:team", "remove-edge tier feature:apps plan:free"].sort(),
    );
    expect(out(store, "feature:apps", "tier")).toEqual(["plan:pro"]);
    expect(out(store, "feature:apps", "plans")).toEqual([]);
  });
});
