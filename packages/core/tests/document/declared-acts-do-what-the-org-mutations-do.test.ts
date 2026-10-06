import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, editDocument, evaluateExpr, parseExpr, readDocument, type Finding, type GraviewDocument } from "../../src/document/index.js";
import {
  defineMutation,
  nodeRef,
  refusalOf,
  Store,
  z,
  type AnyMutationDefinition,
  type AnySchema,
  type GraviewApp,
  type GraphReader,
  type Principal,
  type Primitive,
} from "../../src/index.js";

/**
 * FR-115. DECLARED ACTS CAN DO WHAT THE ORG APP'S MUTATIONS DO.
 *
 * org-graview's `assign-ownership` severs whoever owns a component and
 * whoever was proposed for it, makes the new owner, and says the
 * component's ownership by who that is; `propose-owner` replaces the
 * proposal; `share-ownership` adds an owner and marks the component shared.
 * Each is written in TypeScript. A document says each as ONE act:
 *
 *   "connects": "owns"                    — from whichever end the subject is (here, the component is the far end)
 *   "replaces": ["owns", "proposedOwner"] — the subject's links of those relations are severed first
 *   "sets": { "ownership": { "expr": "if(to == 'person-nick', 'nick_owns', 'owned_elsewhere')" } }
 *   "setsOther": { "ownership": "shared" } — on the record at the other end of what it connects
 *
 * Parity is proved by running the TypeScript mutation, as org-graview
 * declares it, and the declared act on the same seed and comparing the
 * graphs and the changes they made.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const org = read("org.gdd.json") as GraviewDocument;
const seed = read("org.seed.json") as { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };

function compiled(doc: unknown = org) {
  const result = compileDocument(doc, { today: () => "2026-10-06" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result;
}
const app = compiled().app as GraviewApp<AnySchema>;
const storeOf = (mutations: readonly AnyMutationDefinition<AnySchema>[], policy?: GraviewApp<AnySchema>["policy"]) =>
  new Store<AnySchema>({ schema: app.schema, mutations: mutations as never, ...(policy ? { policy } : {}), snapshot: structuredClone(seed) as never });

// ── org-graview's mutations, as its app/src/domain/mutations.ts declares them ──
type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;
function requireKind(graph: Reader, id: string, kind: string): void {
  const node = graph.getNode(id);
  if (!node) throw new Error(`No node "${id}".`);
  if (node.kind !== kind) throw new Error(`"${id}" is a ${node.kind}, not a ${kind}.`);
}
const tsAssignOwnership = defineMutation("assign-ownership", {
  subject: { kinds: ["component"], arg: "componentId" },
  connects: ["owns"],
  severs: ["owns", "proposedOwner"],
  writes: ["ownership"],
  input: z.object({ componentId: nodeRef(["component"]), personId: nodeRef(["person"]) }),
  apply(ctx, args) {
    requireKind(ctx.graph as Reader, args.componentId, "component");
    requireKind(ctx.graph as Reader, args.personId, "person");
    for (const current of ctx.graph.in(args.componentId, "owns")) ctx.removeEdge({ kind: "owns", from: current.id, to: args.componentId });
    for (const proposed of ctx.graph.in(args.componentId, "proposedOwner")) ctx.removeEdge({ kind: "proposedOwner", from: proposed.id, to: args.componentId });
    ctx.addEdge({ kind: "owns", from: args.personId, to: args.componentId });
    const ownerIsNick = args.personId === "person-nick";
    ctx.patchNode(args.componentId, { ownership: ownerIsNick ? "nick_owns" : "owned_elsewhere" });
  },
}) as unknown as AnyMutationDefinition<AnySchema>;
const tsProposeOwner = defineMutation("propose-owner", {
  subject: { kinds: ["component"], arg: "componentId" },
  connects: ["proposedOwner"],
  writes: ["ownership"],
  input: z.object({ componentId: nodeRef(["component"]), personId: nodeRef(["person"]) }),
  apply(ctx, args) {
    requireKind(ctx.graph as Reader, args.componentId, "component");
    requireKind(ctx.graph as Reader, args.personId, "person");
    for (const existing of ctx.graph.in(args.componentId, "proposedOwner")) ctx.removeEdge({ kind: "proposedOwner", from: existing.id, to: args.componentId });
    ctx.addEdge({ kind: "proposedOwner", from: args.personId, to: args.componentId });
    ctx.patchNode(args.componentId, { ownership: "proposed_handoff" });
  },
}) as unknown as AnyMutationDefinition<AnySchema>;
const tsShareOwnership = defineMutation("share-ownership", {
  subject: { kinds: ["component"], arg: "componentId" },
  connects: ["owns"],
  writes: ["ownership"],
  input: z.object({ componentId: nodeRef(["component"]), personId: nodeRef(["person"]) }),
  apply(ctx, args) {
    requireKind(ctx.graph as Reader, args.componentId, "component");
    requireKind(ctx.graph as Reader, args.personId, "person");
    const already = (ctx.graph.in(args.componentId, "owns") as { id: string }[]).some((n) => n.id === args.personId);
    if (!already) ctx.addEdge({ kind: "owns", from: args.personId, to: args.componentId });
    ctx.patchNode(args.componentId, { ownership: "shared" });
  },
}) as unknown as AnyMutationDefinition<AnySchema>;

const sorted = <T>(items: readonly T[]) => [...items].map((item) => JSON.stringify(item)).sort();
const graphOf = (store: Store<AnySchema>) => {
  const snapshot = store.graph.snapshot() as { nodes: unknown[]; edges: { kind: string; from: string; to: string }[] };
  return { nodes: sorted(snapshot.nodes), edges: sorted(snapshot.edges.map(({ kind, from, to }) => ({ kind, from, to }))) };
};
const changesOf = (primitives: readonly Primitive[]) => sorted(primitives.map((p) => ("edge" in p ? { op: p.op, kind: p.edge.kind, from: p.edge.from, to: p.edge.to } : p)));

/** The TypeScript mutation and the declared act, on the same seed: the graphs they leave and the changes they made. */
function both(ts: AnyMutationDefinition<AnySchema>, tsArgs: Record<string, unknown>, act: string, args: Record<string, unknown>) {
  const typed = storeOf([ts]);
  const declared = storeOf(app.mutations ?? []);
  const a = typed.apply({ name: ts.name, args: tsArgs });
  const b = declared.apply({ name: act, args });
  return { typed: { graph: graphOf(typed), changes: changesOf(a.primitives) }, declared: { graph: graphOf(declared), changes: changesOf(b.primitives) }, store: declared, batch: b.batch };
}

describe("assign-ownership, declared as one act", () => {
  it("is one act, which connects owns from the far end, replaces owners and proposals, and writes the ownership", () => {
    const acts = (app.mutations ?? []).filter((m) => m.name === "assign-ownership");
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ subject: { kinds: ["component"], arg: "id" }, connects: ["owns"], severs: ["owns", "proposedOwner"], writes: ["ownership"], destructive: true });
  });

  it("does what the TypeScript mutation does: a proposed person takes a component nobody owned", () => {
    const run = both(tsAssignOwnership, { componentId: "comp-outbound-hunt", personId: "person-john" }, "assign-ownership", { id: "comp-outbound-hunt", to: "person-john" });
    expect(run.declared.graph).toEqual(run.typed.graph);
    expect(run.declared.changes).toEqual(run.typed.changes);
    expect(run.store.graph.getNode("comp-outbound-hunt")).toMatchObject({ ownership: "owned_elsewhere" });
    expect(run.store.graph.in("comp-outbound-hunt", "proposedOwner")).toEqual([]);
  });

  it("does what the TypeScript mutation does: a shared component goes to Nick alone, and says so — keeping the link it would make, where the TypeScript severs and makes it again", () => {
    const run = both(tsAssignOwnership, { componentId: "comp-pricing", personId: "person-nick" }, "assign-ownership", { id: "comp-pricing", to: "person-nick" });
    expect(run.declared.graph).toEqual(run.typed.graph);
    const churn = [JSON.stringify({ op: "add-edge", kind: "owns", from: "person-nick", to: "comp-pricing" }), JSON.stringify({ op: "remove-edge", kind: "owns", from: "person-nick", to: "comp-pricing" })];
    expect(run.declared.changes).toEqual(run.typed.changes.filter((change) => !churn.includes(change)));
    expect(run.store.graph.in("comp-pricing", "owns").map((n) => n.id)).toEqual(["person-nick"]);
    expect(run.store.graph.getNode("comp-pricing")).toMatchObject({ ownership: "nick_owns" });
  });

  it("does what the TypeScript mutation does: Nick's component goes to John", () => {
    const run = both(tsAssignOwnership, { componentId: "comp-fit-calls", personId: "person-john" }, "assign-ownership", { id: "comp-fit-calls", to: "person-john" });
    expect(run.declared.graph).toEqual(run.typed.graph);
    expect(run.declared.changes).toEqual(run.typed.changes);
  });

  it("leaves the same graph when the owner is already the owner", () => {
    const run = both(tsAssignOwnership, { componentId: "comp-fit-calls", personId: "person-nick" }, "assign-ownership", { id: "comp-fit-calls", to: "person-nick" });
    expect(run.declared.graph).toEqual(run.typed.graph);
  });
});

describe("propose-owner, declared as one act", () => {
  it("does what the TypeScript mutation does, replacing the proposal", () => {
    const run = both(tsProposeOwner, { componentId: "comp-line-health", personId: "person-cathy" }, "propose-owner", { id: "comp-line-health", to: "person-cathy" });
    expect(run.declared.graph).toEqual(run.typed.graph);
    expect(run.declared.changes).toEqual(run.typed.changes);
    expect(run.store.graph.in("comp-line-health", "proposedOwner").map((n) => n.id)).toEqual(["person-cathy"]);
  });

  it("does what the TypeScript mutation does on a component nobody was proposed for", () => {
    const run = both(tsProposeOwner, { componentId: "comp-fit-calls", personId: "person-val" }, "propose-owner", { id: "comp-fit-calls", to: "person-val" });
    expect(run.declared.graph).toEqual(run.typed.graph);
    expect(run.declared.changes).toEqual(run.typed.changes);
  });
});

describe("share-ownership, declared on the person, setting the component it connects", () => {
  it("does what the TypeScript mutation does: the person owns it too, and the component is shared", () => {
    const run = both(tsShareOwnership, { componentId: "comp-fit-calls", personId: "person-steve" }, "share-ownership", { id: "person-steve", to: "comp-fit-calls" });
    expect(run.declared.graph).toEqual(run.typed.graph);
    expect(run.declared.changes).toEqual(run.typed.changes);
    expect(run.store.graph.getNode("comp-fit-calls")).toMatchObject({ ownership: "shared" });
  });

  it("writes nothing on its subject: the field it sets is the other record's", () => {
    expect((app.mutations ?? []).find((m) => m.name === "share-ownership")!.writes).toEqual([]);
  });
});

describe("if in a value an act sets", () => {
  it("judges only the branch it takes, and pays for it from the rule's budget", () => {
    const { kinds } = compiled();
    const graph = storeOf(app.mutations ?? []).graph as unknown as GraphReader;
    const subject = graph.getNode("comp-pricing") as never;
    const run = (source: string, budget?: number) => evaluateExpr(parseExpr(source), { graph, subject, kinds, bindings: { to: "person-nick" }, ...(budget ? { budget } : {}) });
    expect(run("if(to == 'person-nick', 'nick_owns', 'owned_elsewhere')")).toBe("nick_owns");
    // The branch not taken is never worked out: a name nothing has would be a sentence, not a value.
    expect(run("if(to == 'person-nick', 'nick_owns', nothingHasThis)")).toBe("nick_owns");
    expect(() => run("if(true, count(all('component')), 0)", 5)).toThrow(/looks at too much/);
  });
});

describe("the new act language is previewed and taken back like any act", () => {
  it("previewAll says what apply then does, and changes nothing", () => {
    const store = storeOf(app.mutations ?? []);
    const before = graphOf(store);
    const calls = [
      { name: "assign-ownership", args: { id: "comp-outbound-hunt", to: "person-john" } },
      { name: "share-ownership", args: { id: "person-steve", to: "comp-outbound-hunt" } },
    ];
    const preview = store.previewAll(calls);
    expect(graphOf(store)).toEqual(before);
    const applied = store.applyAll(calls);
    expect(changesOf(applied.primitives)).toEqual(changesOf(preview.primitives));
    expect(store.graph.getNode("comp-outbound-hunt")).toMatchObject({ ownership: "shared" });
  });

  it("one undo puts back the owners, the proposal and the ownership", () => {
    const store = storeOf(app.mutations ?? []);
    const before = graphOf(store);
    const { batch } = store.apply({ name: "assign-ownership", args: { id: "comp-pricing", to: "person-john" } });
    expect(graphOf(store)).not.toEqual(before);
    store.undo(batch);
    expect(graphOf(store)).toEqual(before);
  });
});

describe("a seat may not set what it cannot see", () => {
  const policy = {
    roles: ["lead", "dasher"],
    grants: [{ roles: "*" as const, mutations: "*" as const }],
    sees: [
      { roles: ["lead"], kinds: ["person", "component", "constraint", "revenue-stream", "open-question", "strength"] },
      { roles: ["dasher"], kinds: ["person", "strength"] },
      { roles: ["dasher"], kinds: ["component"], own: true },
    ],
  };
  const dasher: Principal = { kind: "human", id: "person-steve", roles: ["dasher"] };

  it("refuses setting the other record as missing, and changes nothing", () => {
    const store = storeOf(app.mutations ?? [], policy as never);
    const error = (() => {
      try {
        store.apply({ name: "share-ownership", args: { id: "person-steve", to: "comp-fit-calls" } }, { author: dasher });
      } catch (e) {
        return e;
      }
      throw new Error("expected a refusal");
    })();
    expect(refusalOf(error).reason).toBe("missing");
    expect(store.graph.getNode("comp-fit-calls")).toMatchObject({ ownership: "nick_owns" });
    expect(store.graph.in("comp-fit-calls", "owns").map((n) => n.id)).toEqual(["person-nick"]);
  });

  it("the check warns of a value set on the other record that reads a kind a role may not see", () => {
    const doc = structuredClone(org) as GraviewDocument & Record<string, unknown>;
    doc.roles = policy.roles;
    doc.policy = { grants: policy.grants, sees: [{ roles: ["lead"], kinds: Object.keys(org.kinds) }, { roles: ["dasher"], kinds: ["person", "component", "strength"] }] } as never;
    (doc.acts!["share-ownership"] as Record<string, unknown>)["setsOther"] = { ownership: { expr: "if(exists(feeds), 'shared', 'owned_elsewhere')" } };
    const warned = compiled(doc).findings.filter((f: Finding) => f.code === "check:act-reads-hidden-kind" && f.path === "acts.share-ownership");
    expect(warned.map((f) => f.message)).toEqual([
      '"share-ownership" reads revenue-stream records (a value it sets on the other record), which "dasher" may run it but may not see: whether it is allowed, what it refuses with or what it writes can tell "dasher" that a revenue stream they cannot see exists.',
    ]);
  });

  it("the check warns when the records an act connects and replaces are of a kind a role may not see", () => {
    const doc = structuredClone(org) as GraviewDocument & Record<string, unknown>;
    doc.roles = policy.roles;
    doc.policy = { grants: policy.grants, sees: [{ roles: ["lead"], kinds: Object.keys(org.kinds) }, { roles: ["dasher"], kinds: ["component"] }] } as never;
    const warned = compiled(doc).findings.filter((f: Finding) => f.code === "check:act-reads-hidden-kind" && f.path === "acts.propose-owner").map((f) => f.message);
    expect(warned[0]).toMatch(/"propose-owner" reads person records \(the links it replaces\)/);
  });
});

describe("the document says the new act language, and refuses it where it cannot hold", () => {
  const errors = (acts: Record<string, unknown>) => {
    const doc = structuredClone(org) as GraviewDocument & { acts: Record<string, unknown> };
    Object.assign(doc.acts, acts);
    return readDocument(doc).findings.filter((f) => f.severity === "error").map((f) => `${f.code} at ${f.path}: ${f.message}`);
  };

  it("refuses setsOther without a relation, and a field the other end has not got", () => {
    expect(errors({ "x-a": { on: "person", setsOther: { ownership: "shared" } } })).toEqual(['act-empty at acts.x-a: "x-a" does nothing', 'act-sets-other at acts.x-a.setsOther: "x-a" sets the record at the other end of what it connects, and connects nothing']);
    expect(errors({ "x-b": { on: "person", connects: "owns", setsOther: { colour: "red" } } })).toEqual(['act-field at acts.x-b.setsOther.colour: component has no field "colour"']);
  });

  it("refuses replaces without a connects, or naming a relation the subject is not at that end of", () => {
    expect(errors({ "x-c": { on: "component", sets: { ownership: "shared" }, replaces: true } })).toEqual(['act-replaces at acts.x-c.replaces: "x-c" replaces the links of what it connects, and connects nothing']);
    expect(errors({ "x-d": { on: "component", connects: "owns", replaces: ["feeds"] } })).toEqual(['act-replaces at acts.x-d.replaces: "feeds" does not join component to a person, so "x-d" has no such links to replace']);
  });
});

describe("an edit keeps the new act language in step", () => {
  const base = readDocument(org).document!;
  const edit = (edits: unknown[]) => {
    const outcome = editDocument(base, edits);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    return outcome;
  };

  it("a renamed relation is renamed in what an act replaces", () => {
    const { document } = edit([{ op: "rename-relation", kind: "person", relation: "proposedOwner", to: "mightOwn" }]);
    expect(document.acts!["assign-ownership"]).toMatchObject({ replaces: ["owns", "mightOwn"] });
    expect(document.acts!["propose-owner"]).toMatchObject({ connects: "mightOwn", replaces: true });
    expect(compiled(document).ok).toBe(true);
  });

  it("a renamed field is renamed where an act sets it on the other record", () => {
    const { document } = edit([{ op: "rename-field", kind: "component", field: "ownership", to: "posture" }]);
    expect(document.acts!["share-ownership"]).toMatchObject({ setsOther: { posture: "shared" } });
    expect(document.acts!["assign-ownership"]!.sets).toEqual({ posture: { expr: "if(to == 'person-nick', 'nick_owns', 'owned_elsewhere')" } });
    expect(compiled(document).ok).toBe(true);
  });

  it("a removed relation leaves what replaced it, and a removed field what set it on the other record", () => {
    const relation = edit([{ op: "remove-relation", kind: "person", relation: "proposedOwner" }]).document;
    expect(relation.acts!["propose-owner"]).toBeUndefined();
    expect(relation.acts!["assign-ownership"]).toMatchObject({ replaces: ["owns"] });
    expect(compiled(relation).ok).toBe(true);
    const field = edit([{ op: "remove-field", kind: "component", field: "ownership" }]).document;
    expect(field.acts!["share-ownership"]).toEqual(expect.not.objectContaining({ setsOther: expect.anything() }));
    expect(field.acts!["share-ownership"]).toMatchObject({ connects: "owns" });
    expect(compiled(field).ok).toBe(true);
  });

  it("a diff says an act that came to replace or set the other record changes", () => {
    const after = structuredClone(base);
    (after.acts!["share-ownership"] as Record<string, unknown>)["replaces"] = true;
    expect(diffDocuments(base, after).sentences).toEqual(['The act "Share ownership" changes.']);
  });
});
