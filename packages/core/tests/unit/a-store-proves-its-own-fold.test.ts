import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, snapshotHash, Store } from "../../src/index.js";
import { sha256Hex } from "../../src/integrity.js";

/**
 * FR-20. A store can prove its own fold: the graph it holds has a
 * fingerprint that does not care how the graph was built, and `verify()`
 * refolds the log and says whether the two agree, or after which op they
 * part.
 */
const thing = defineNode("thing", {
  fields: z.object({ label: z.string(), tags: z.array(z.string()).optional() }),
  edges: { near: { to: ["thing"] } },
});
const schema = createSchema([thing]);
const { defineMutation } = bindSchema(schema);
const make = defineMutation("make", {
  title: "Make",
  description: "Add one.",
  input: z.object({ id: z.string(), label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "thing", label: args.label } as never);
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["thing"], arg: "id" },
  input: z.object({ id: nodeRef(["thing"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const mutations = [make, rename];

describe("snapshotHash", () => {
  const nodes = [
    { id: "a", kind: "thing", label: "One", tags: ["x", "y"] },
    { id: "b", kind: "thing", label: "Two" },
    { id: "c", kind: "thing", label: "Three" },
  ];
  const edges = [
    { kind: "near", from: "a", to: "b" },
    { kind: "near", from: "b", to: "c" },
  ];

  it("hashes two snapshots of the same graph the same regardless of node or edge order", () => {
    const one = snapshotHash({ nodes, edges });
    const two = snapshotHash({ nodes: [...nodes].reverse(), edges: [...edges].reverse() });
    expect(two).toBe(one);
    expect(one).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("hashes the same regardless of key order inside a node", () => {
    const shuffled = nodes.map((node) => Object.fromEntries(Object.entries(node).reverse())) as typeof nodes;
    expect(snapshotHash({ nodes: shuffled, edges })).toBe(snapshotHash({ nodes, edges }));
  });

  it("hashes a different graph differently, and an array field's order is part of it", () => {
    const base = snapshotHash({ nodes, edges });
    expect(snapshotHash({ nodes, edges: edges.slice(1) })).not.toBe(base);
    const retagged = nodes.map((node) => (node.id === "a" ? { ...node, tags: ["y", "x"] } : node));
    expect(snapshotHash({ nodes: retagged, edges })).not.toBe(base);
  });

  it("is SHA-256, and a fixed graph's hash is pinned so a version that moves it says so", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(snapshotHash({ nodes: [], edges: [] })).toBe(`sha256:${sha256Hex('{"edges":[],"nodes":[]}')}`);
    expect(snapshotHash({ nodes, edges })).toBe(
      `sha256:${sha256Hex(
        '{"edges":[{"from":"a","kind":"near","to":"b"},{"from":"b","kind":"near","to":"c"}],"nodes":[{"id":"a","kind":"thing","label":"One","tags":["x","y"]},{"id":"b","kind":"thing","label":"Two"},{"id":"c","kind":"thing","label":"Three"}]}',
      )}`,
    );
  });
});

describe("store.verify()", () => {
  const worked = () => {
    const store = new Store({ schema, mutations });
    store.apply({ name: "make", args: { id: "a", label: "One" } });
    store.apply({ name: "rename", args: { id: "a", label: "Uno" } });
    store.apply({ name: "make", args: { id: "b", label: "Two" } });
    return store;
  };

  it("reports agreement with the hash when the graph is the fold of its log", () => {
    const store = worked();
    expect(store.verify()).toEqual({ ok: true, hash: snapshotHash(store.snapshot()) });
  });

  it("reports the first op after which the graph and the fold diverge", () => {
    const store = worked();
    const [, renamed] = store.log.all();
    // A snapshot that lost the rename: the stored graph says "One" where the log says "Uno".
    const drifted = store.snapshot().nodes.map((node) => (node.id === "a" ? { ...node, label: "One" } : node));
    const reopened = new Store({ schema, mutations, snapshot: { nodes: drifted, edges: [] }, log: store.log.all() });
    const verdict = reopened.verify();
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.expected).toBe(snapshotHash(store.snapshot()));
    expect(verdict.actual).toBe(snapshotHash({ nodes: drifted, edges: [] }));
    expect(verdict.divergedAfter).toBe(renamed!.id);
    expect(verdict.reason).toContain(renamed!.id);
  });

  it("names no op when the graph disagrees before the first one", () => {
    const store = worked();
    const extra = { id: "z", kind: "thing", label: "Never made" };
    const reopened = new Store({
      schema,
      mutations,
      snapshot: { nodes: [...store.snapshot().nodes, extra], edges: [] },
      log: store.log.all(),
    });
    const verdict = reopened.verify();
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.divergedAfter).toBeUndefined();
  });
});
