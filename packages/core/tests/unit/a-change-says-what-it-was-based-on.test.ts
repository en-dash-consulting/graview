import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isProvisional, lineageWords, linkProvenance, provisionalLinks } from "../../src/provenance.js";
import { bindSchema, createSchema, defineNode, GraphError, KEEP_LINK, nodeRef, OperationLog, PermissionDeniedError, redact, Store, type AnySchema, type Author, type Policy } from "../../src/index.js";

/**
 * A CHANGE SAYS WHAT IT WAS BASED ON, AND A LINK MADE UNSURE IS PROVISIONAL
 * UNTIL A PERSON TOUCHES IT (FR-172). An op may carry `lineage` — a basis,
 * a confidence from 0 to 1, a model — kept in the log; a link whose making
 * op was less than sure, by someone other than a person, is provisional
 * until a person's op names it ("Keep this link", or any edit of theirs to
 * it); and an undo keeps the lineage of what it declined.
 */
const lease = defineNode("lease", { fields: z.object({ label: z.string() }), edges: { about: { to: ["property"], description: "what it is about" } } });
const property = defineNode("property", { fields: z.object({ label: z.string() }) });
const schema = createSchema([lease, property]);
const { defineMutation } = bindSchema(schema);
const link = defineMutation("link-lease", {
  title: "Say what a lease is about",
  subject: { kinds: ["lease"], arg: "id" },
  connects: ["about"],
  input: z.object({ id: nodeRef(["lease"]), to: nodeRef(["property"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "about", from: args.id, to: args.to });
  },
});
const unlink = defineMutation("unlink-lease", {
  title: "Take back what a lease is about",
  subject: { kinds: ["lease"], arg: "id" },
  severs: ["about"],
  input: z.object({ id: nodeRef(["lease"]), to: nodeRef(["property"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "about", from: args.id, to: args.to });
  },
});
const rename = defineMutation("rename-lease", {
  title: "Rename a lease",
  subject: { kinds: ["lease"], arg: "id" },
  input: z.object({ id: nodeRef(["lease"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const tidying: Author = { kind: "agent", id: "tidying", name: "Graview, tidying" };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const edge = { kind: "about", from: "lease:harbor", to: "property:harbor" };
const sure = { basis: "Both name 12 Harbor Street", confidence: 0.6, model: "jev-1" };

const storeOf = (policy?: Policy) =>
  new Store<AnySchema>({
    schema,
    mutations: [link, unlink, rename] as never,
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "lease:harbor", kind: "lease", label: "Harbor lease" },
        { id: "property:harbor", kind: "property", label: "12 Harbor Street" },
      ] as never,
      edges: [],
    },
  });
const made = (store: Store<AnySchema>) => store.apply({ name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: tidying, lineage: sure });

describe("an op's lineage", () => {
  it("is kept on the op, in the log as written, and on its batch", () => {
    const store = storeOf();
    const result = made(store);
    expect(result.ops[0]!.lineage).toEqual(sure);
    const kept = JSON.parse(JSON.stringify(store.log.toJSON()));
    expect(OperationLog.from(kept).all()[0]!.lineage).toEqual(sure);
    expect(store.batches().at(-1)!.lineage).toEqual(sure);
  });

  it("is said in words", () => {
    expect(lineageWords(sure)).toBe("based on “Both name 12 Harbor Street” · 60% sure · jev-1");
    expect(lineageWords({ basis: "Same address" })).toBe("based on “Same address”");
  });

  it("is checked before anything is kept: a confidence from 0 to 1, a basis of words and a bounded length", () => {
    const store = storeOf();
    const call = { name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } };
    expect(() => store.apply(call, { lineage: { basis: "x", confidence: 1.2 } })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: { basis: "x", confidence: Number.NaN } })).toThrow(/A lineage is/);
    expect(() => store.apply(call, { lineage: { basis: "  " } })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: { basis: "x".repeat(501) } })).toThrow(GraphError);
    expect(() => store.applyPrimitives([{ op: "add-edge", edge }], { lineage: { basis: "x", confidence: -0.1 } })).toThrow(GraphError);
    expect(store.log.length).toBe(0);
    // A key a later build says rides along as it was said; one that is not plain JSON, or reaches a prototype, is refused.
    expect(() => store.apply(call, { lineage: { basis: "x", later: () => 1 } as never })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: JSON.parse('{"basis":"x","__proto__":{"polluted":true}}') })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: { basis: "x", later: "y".repeat(4000) } as never })).toThrow(/at most 4000/);
    expect(store.log.length).toBe(0);
    const kept = store.apply(call, { lineage: { basis: " Same street ", confidence: 0, extra: "kept" } as never });
    expect(kept.ops[0]!.lineage).toEqual({ basis: "Same street", confidence: 0, extra: "kept" });
  });

  it("says which judge made it, in which run, and the records its basis rests on", () => {
    const store = storeOf();
    const call = { name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } };
    const said = { basis: "Both name 12 Harbor Street", confidence: 0.6, actor: "links by address", run: "run:2026-10-22", evidence: ["lease:harbor", "property:harbor"] };
    expect(store.apply(call, { author: tidying, lineage: said }).ops[0]!.lineage).toEqual(said);
    expect(() => store.apply(call, { lineage: { basis: "x", evidence: "lease:harbor" } as never })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: { basis: "x", evidence: Array.from({ length: 51 }, (_, at) => `r${at}`) } })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: { basis: "x", run: "" } })).toThrow(GraphError);
    expect(() => store.apply(call, { lineage: { basis: "x", actor: "a".repeat(121) } })).toThrow(GraphError);
  });

  it("withholds the op from a seat that may not see a record its evidence names", () => {
    const store = storeOf();
    store.apply({ name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: tidying, lineage: { basis: "Named in the email", evidence: ["email:secret"] } });
    const op = store.log.all()[0]!;
    const [served] = redact([op], (id) => id !== "email:secret");
    expect(served!.withheld).toBe(true);
    expect(JSON.stringify(served)).not.toContain("email:secret");
  });

  it("is carried by a host's own ops, and by ops received from elsewhere", () => {
    const store = storeOf();
    const [op] = store.append([{ primitives: [{ op: "add-edge", edge }], author: tidying, intent: "Link the lease", lineage: sure }]);
    expect(op!.lineage).toEqual(sure);
    expect(isProvisional(store, edge)).toBe(true);
    const elsewhere = storeOf();
    elsewhere.receive(store.log.all());
    expect(isProvisional(elsewhere, edge)).toBe(true);
    expect(linkProvenance(elsewhere, edge)).toMatchObject({ by: tidying, lineage: sure, provisional: true });
  });
});

describe("a link made unsure", () => {
  it("is provisional, and its provenance says who made it and why", () => {
    const store = storeOf();
    const result = made(store);
    expect(linkProvenance(store, edge)).toEqual({ edge, made: result.ops[0]!.id, by: tidying, lineage: sure, provisional: true });
    expect(provisionalLinks(store).map((one) => one.edge)).toEqual([edge]);
  });

  it("is ordinary when it was made sure, or with nothing said, or by a person", () => {
    const sureStore = storeOf();
    sureStore.apply({ name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: tidying, lineage: { basis: "Named on the lease", confidence: 1 } });
    expect(isProvisional(sureStore, edge)).toBe(false);
    const unsaid = storeOf();
    unsaid.apply({ name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: tidying });
    expect(isProvisional(unsaid, edge)).toBe(false);
    const person = storeOf();
    person.apply({ name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: nick, lineage: sure });
    expect(isProvisional(person, edge)).toBe(false);
  });

  it("is kept by a person: an ordinary link, which says who kept it", () => {
    const store = storeOf();
    made(store);
    const kept = store.apply({ name: KEEP_LINK, args: edge }, { author: nick });
    expect(kept.ops[0]!.intent).toBe("Keep the link from Harbor lease to 12 Harbor Street");
    expect(store.graph.out("lease:harbor", "about").map((node) => node.id)).toEqual(["property:harbor"]);
    expect(linkProvenance(store, edge)).toMatchObject({ provisional: false, keptBy: kept.ops[0]!.id, lineage: sure, by: tidying });
    // Undoing the keep makes it provisional again.
    store.undo(kept.batch, { author: nick });
    expect(isProvisional(store, edge)).toBe(true);
  });

  it("is not kept by another agent, nor by a person's edit that does not name it", () => {
    const store = storeOf();
    made(store);
    store.apply({ name: KEEP_LINK, args: edge }, { author: { kind: "agent", id: "other" } });
    store.apply({ name: "rename-lease", args: { id: "lease:harbor", label: "The Harbor lease" } }, { author: nick });
    expect(isProvisional(store, edge)).toBe(true);
  });

  it("is ordinary once a person takes it away and makes it again", () => {
    const store = storeOf();
    made(store);
    store.apply({ name: "unlink-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: nick });
    expect(linkProvenance(store, edge)).toBeUndefined();
    store.apply({ name: "link-lease", args: { id: "lease:harbor", to: "property:harbor" } }, { author: nick });
    expect(isProvisional(store, edge)).toBe(false);
  });

  it("is not a link to keep when there is none", () => {
    const store = storeOf();
    expect(() => store.apply({ name: KEEP_LINK, args: edge }, { author: nick })).toThrow(/missing edge/);
  });

  it("is kept by whoever may make or break such links, and by nobody else", () => {
    const policy: Policy = { grants: [{ roles: ["editor"], mutations: ["link-lease"] }, { roles: ["*"], mutations: ["rename-lease"] }] };
    const store = storeOf(policy);
    store.append([{ primitives: [{ op: "add-edge", edge }], author: tidying, intent: "Link the lease", lineage: sure }]);
    expect(() => store.apply({ name: KEEP_LINK, args: edge }, { author: { kind: "human", id: "rae", roles: ["reader"] } as never })).toThrow(PermissionDeniedError);
    store.apply({ name: KEEP_LINK, args: edge }, { author: { kind: "human", id: "ed", roles: ["editor"] } as never });
    expect(isProvisional(store, edge)).toBe(false);
  });

  it("is kept by an act no list offers: it is not one of the app's acts", () => {
    const store = storeOf();
    expect(store.allMutations().map((mutation) => mutation.name)).not.toContain(KEEP_LINK);
    expect(store.permittedMutations().map((mutation) => mutation.name)).not.toContain(KEEP_LINK);
  });
});

describe("an undo of an unsure change", () => {
  it("keeps the lineage of what it declined, and the link is gone", () => {
    const store = storeOf();
    const result = made(store);
    const undone = store.undo(result.batch, { author: nick });
    expect(undone.ops[0]!.undoneLineage).toEqual(sure);
    expect(undone.ops[0]!.lineage).toBeUndefined();
    expect(linkProvenance(store, edge)).toBeUndefined();
    // Redone, it is the suggestion again.
    store.undo(undone.batch, { author: nick });
    expect(isProvisional(store, edge)).toBe(true);
  });
});
