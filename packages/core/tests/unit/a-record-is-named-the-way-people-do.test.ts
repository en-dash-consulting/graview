import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createSchema, defineMutation, defineNode, nodeRef, nodeRefArgs, Store, type Policy, type Principal } from "../../src/index.js";

/**
 * FR-33. A person says "book the florist", never `vendor:bloom-co`. A node
 * argument is resolved from a label, or a unique case-insensitive prefix of
 * one, among the records the principal may see of the kinds it accepts;
 * several matches come back as candidates; ids keep working unchanged.
 */
let labeled = 0;
const vendor = defineNode("vendor", {
  fields: z.object({ name: z.string(), status: z.enum(["researching", "booked"]) }),
  label: (node) => {
    labeled += 1;
    return node.name;
  },
});
const category = defineNode("category", { fields: z.object({ name: z.string() }), label: (node) => node.name });
const schema = createSchema([vendor, category]);
const book = defineMutation("book", {
  subject: { kinds: ["vendor"], arg: "id" },
  input: z.object({ id: nodeRef(["vendor"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "booked" });
  },
});
const ref = nodeRefArgs(book.input)[0]!;
const make = (policy?: Policy) =>
  new Store({
    schema,
    mutations: [book] as never,
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "vendor:bloom-co", kind: "vendor", name: "Bloom & Co", status: "researching" },
        { id: "vendor:petal", kind: "vendor", name: "Petal Pushers", status: "researching" },
        { id: "vendor:lens", kind: "vendor", name: "Lens Lane", status: "researching" },
        { id: "category:blooms", kind: "category", name: "Blooms" },
      ] as never,
      edges: [],
    },
  });
const agent: Principal = { kind: "agent", id: "claude" };

describe("a record named the way people name it", () => {
  it("resolves a unique case-insensitive prefix among the accepted kinds, and says which id it chose", () => {
    const store = make();
    // "Blooms" is a category: the argument takes vendors, so it is not a candidate.
    expect(store.resolveRef(ref, "bloom", agent)).toMatchObject({ ok: true, id: "vendor:bloom-co", label: "Bloom & Co", by: "prefix" });
    expect(store.resolveRef(ref, "PETAL PUSHERS", agent)).toMatchObject({ ok: true, id: "vendor:petal", by: "label" });
    // An id keeps working, unchanged.
    expect(store.resolveRef(ref, "vendor:lens", agent)).toMatchObject({ ok: true, id: "vendor:lens", by: "id" });
  });

  it("refuses two matches with both candidates listed, and says when there is none", () => {
    const store = make();
    store.applyPrimitives([{ op: "add-node", node: { id: "vendor:bloom-room", kind: "vendor", name: "Bloom Room", status: "researching" } as never }]);
    const two = store.resolveRef(ref, "bloom", agent);
    expect(two.ok).toBe(false);
    if (two.ok) return;
    expect(two.reason).toBe("ambiguous");
    expect(two.candidates.map((candidate) => candidate.id).sort()).toEqual(["vendor:bloom-co", "vendor:bloom-room"]);
    expect(two.message).toContain("Bloom & Co (vendor:bloom-co)");
    expect(two.message).toContain("Bloom Room (vendor:bloom-room)");
    // It says what it could mean in the argument's own words, as the refusal for none does (FR-51).
    expect(two.message).toBe('"bloom" names more than one vendor: Bloom & Co (vendor:bloom-co), Bloom Room (vendor:bloom-room). Pass the id of the one you mean as id.');
    // An exact label wins over the prefixes it shares.
    expect(store.resolveRef(ref, "bloom room", agent)).toMatchObject({ ok: true, id: "vendor:bloom-room" });
    const none = store.resolveRef(ref, "zinnia", agent);
    expect(none).toMatchObject({ ok: false, reason: "none", candidates: [] });
  });

  it("only ever sees the records the principal may see", () => {
    const store = make({
      grants: [{ roles: "*", mutations: "*" }],
      sees: [{ roles: ["planner"], kinds: ["vendor"] }],
    });
    const stranger: Principal = { kind: "agent", id: "stranger", roles: [] };
    const planner: Principal = { kind: "agent", id: "planner", roles: ["planner"] };
    expect(store.resolveRef(ref, "bloom", stranger)).toMatchObject({ ok: false, reason: "none", candidates: [] });
    // Not even by id: a record the seat cannot see is not there for it.
    expect(store.resolveRef(ref, "vendor:bloom-co", stranger)).toMatchObject({ ok: false, reason: "none" });
    expect(store.resolveRef(ref, "bloom", planner)).toMatchObject({ ok: true, id: "vendor:bloom-co" });
  });

  it("reads node references without sharing the module instance that made them", async () => {
    vi.resetModules();
    const other = (await import("../../src/mutations/node-ref.js")) as typeof import("../../src/mutations/node-ref.js");
    // A second copy of the framework module, as a host that bundled its own would hold.
    expect(other.nodeRefArgs).not.toBe(nodeRefArgs);
    expect(other.nodeRefArgs(book.input)).toEqual([{ name: "id", kinds: ["vendor"], optional: false }]);
    const described = z.object({ who: other.nodeRef(["vendor"]).describe("Who to book").optional() });
    expect(nodeRefArgs(described)).toEqual([{ name: "who", kinds: ["vendor"], optional: true }]);
  });

  it("resolves through a label index: O(matches), not a scan of every visible record", () => {
    const nodes = Array.from({ length: 5000 }, (_, i) => ({ id: `vendor:v${i}`, kind: "vendor", name: `Vendor ${i}`, status: "researching" }));
    const store = new Store({ schema, mutations: [book] as never, snapshot: { nodes: [...nodes, { id: "vendor:zz", kind: "vendor", name: "Zinnia & Sons", status: "researching" }] as never, edges: [] } });
    store.resolveRef(ref, "zinnia", agent); // the index is built once
    labeled = 0;
    const seen = vi.spyOn(store, "sees");
    expect(store.resolveRef(ref, "zinn", agent)).toMatchObject({ ok: true, id: "vendor:zz" });
    expect(labeled).toBe(0);
    expect(seen.mock.calls.length).toBeLessThanOrEqual(1);
    // A write keeps the index current by touching only what it changed.
    store.apply({ name: "book", args: { id: "vendor:zz" } });
    store.applyPrimitives([{ op: "patch-node", id: "vendor:v7", before: { name: "Vendor 7" }, after: { name: "Yarrow Hall" } }]);
    expect(labeled).toBeLessThan(10);
    expect(store.resolveRef(ref, "yarrow", agent)).toMatchObject({ ok: true, id: "vendor:v7" });
    const old = store.resolveRef(ref, "vendor 7", agent);
    expect(old.ok).toBe(false);
    if (!old.ok) expect(old.candidates.map((candidate) => candidate.id)).not.toContain("vendor:v7");
  });
});
