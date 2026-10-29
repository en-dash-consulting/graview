import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptSuggestion, declineSuggestion, isProposal, mayDecide, propose, proposedMutations, suggestions, withdrawSuggestion } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, PROPOSE_CHANGES, Store, type AnySchema, type Policy, type Principal } from "../../src/index.js";
import { lineageOf } from "../../src/ops/lineage.js";

/**
 * A PERSON PROPOSES CHANGES AND A REVIEWER ACCEPTS THEM (Roadmap
 * f-proposals-for-review). A grant's `propose` lets a seat ask for an act it
 * may not run: its calls kept as the same suggestion op the app's own actor
 * makes, with the person as its author and a lineage naming them. Whoever
 * may run the calls accepts it — made as the reviewer, its lineage naming
 * the proposal and the proposer — or declines it in words; the proposer
 * may withdraw it. Each call is judged as the store judges it for the
 * reviewer, and a seat that may neither run nor propose an act is refused.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"], description: "the events it supplies" } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const { defineMutation } = bindSchema(schema);
const supply = defineMutation("supply", {
  title: "Say a vendor supplies an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["supplies"],
  input: z.object({ id: nodeRef(["vendor"]), event: nodeRef(["event"]) }),
  describe: (args, graph) => `Link ${(graph.getNode(args.id) as { label?: string } | undefined)?.label} to ${(graph.getNode(args.event) as { label?: string } | undefined)?.label}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.id, to: args.event });
  },
});
const rename = defineMutation("rename-event", {
  title: "Rename an event",
  subject: { kinds: ["event"], arg: "id" },
  input: z.object({ id: nodeRef(["event"]), label: z.string() }),
  apply(ctx, args) {
    if (args.label.trim() === "") throw new Error("An event has a name.");
    ctx.patchNode(args.id, { label: args.label });
  },
});
const kay: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["helper"] };
const vis: Principal = { kind: "human", id: "vis", name: "Vis", roles: [] };
const quill = { name: "supply", args: { id: "vendor:quill", event: "event:gala" } };
const NOW = "2026-10-28T09:00:00.000Z";
/** The keeper runs everything; a helper runs nothing and may propose a vendor's supplying, on vendors. */
const policy: Policy = { roles: ["keeper", "helper"], grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["helper"], mutations: [], propose: ["supply"], kinds: ["vendor"] }] };

const storeOf = () =>
  new Store<AnySchema>({
    schema,
    mutations: [supply, rename] as never,
    now: () => NOW,
    policy,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });

describe("a grant's propose", () => {
  it("lets a seat propose an act it may not run, and no other", () => {
    const store = storeOf();
    expect(store.permits(quill, ada).ok).toBe(false);
    expect(store.mayPropose(quill, ada)).toBe(true);
    expect(store.mayPropose(quill, kay)).toBe(false);
    expect(store.mayPropose({ name: "rename-event", args: { id: "event:gala", label: "Gala" } }, ada)).toBe(false);
    expect(store.mayPropose(quill, vis)).toBe(false);
    expect(proposedMutations(policy, ada, store.allMutations()).map((one) => one.name)).toEqual(["supply"]);
    // Offered by no list: it is how a proposal travels, not one of the app's acts.
    expect(store.allMutations().map((one) => one.name)).not.toContain(PROPOSE_CHANGES);
  });

  it("is refused, in a sentence, to a seat that may neither run nor propose the act", () => {
    const store = storeOf();
    expect(() => propose(store, vis, [quill])).toThrow(/Not permitted to propose this/);
    expect(() => propose(store, ada, [{ name: "rename-event", args: { id: "event:gala", label: "Gala" } }])).toThrow(/Not permitted to propose this/);
    expect(suggestions(store)).toEqual([]);
  });
});

describe("a proposal", () => {
  it("is the suggestion op with the person as its author, and changes nothing", () => {
    const store = storeOf();
    const op = propose(store, ada, [quill], "Quill printed the invitations")!;
    expect(op).toMatchObject({ author: ada, mutation: null, primitives: [], suggests: [quill], intent: "Link Quill Stationers to Spring gala", lineage: { basis: "Quill printed the invitations", proposedBy: "ada" } });
    expect(store.graph.allEdges()).toEqual([]);
    const [waiting] = suggestions(store, kay);
    expect(waiting).toMatchObject({ id: op.id, author: ada });
    expect(isProposal(waiting!)).toBe(true);
    // The same change, proposed again, is the one that waits.
    expect(propose(store, ada, [quill])!.id).toBe(op.id);
  });

  it("says who proposed it where the person gave no words of their own", () => {
    const store = storeOf();
    expect(propose(store, ada, [quill])!.lineage).toEqual({ basis: "Proposed by Ada", proposedBy: "ada" });
  });

  it("is judged as the store judges the change for the reviewer: an act's own refusal refuses it", () => {
    const store = new Store<AnySchema>({
      schema,
      mutations: [supply, rename] as never,
      now: () => NOW,
      policy: { grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["helper"], mutations: [], propose: "*" }] },
      snapshot: { nodes: [{ id: "event:gala", kind: "event", label: "Spring gala" }] as never, edges: [] },
    });
    expect(() => propose(store, ada, [{ name: "rename-event", args: { id: "event:gala", label: " " } }])).toThrow(/An event has a name/);
    expect(propose(store, ada, [{ name: "rename-event", args: { id: "event:gala", label: "Gala" } }])).toBeDefined();
  });

  it("is accepted as the reviewer, its lineage naming the proposal and who proposed it", () => {
    const store = storeOf();
    const op = propose(store, ada, [quill])!;
    expect(mayDecide(store, suggestions(store)[0]!, kay)).toBe(true);
    expect(mayDecide(store, suggestions(store)[0]!, ada)).toBe(false);
    const made = acceptSuggestion(store, op.id, { author: kay });
    expect(made.ops[0]).toMatchObject({ author: kay, lineage: { suggestion: op.id, proposedBy: "ada" } });
    expect(store.graph.allEdges()).toHaveLength(1);
    expect(suggestions(store)).toEqual([]);
  });

  it("is declined in words, and the proposer may propose it again", () => {
    const store = storeOf();
    const op = propose(store, ada, [quill])!;
    const answer = declineSuggestion(store, op.id, { author: kay });
    expect(answer.ops[0]).toMatchObject({ author: kay, batchIntent: "Declined Ada's proposal: Link Quill Stationers to Spring gala" });
    expect(suggestions(store)).toEqual([]);
    expect(store.graph.allEdges()).toEqual([]);
    expect(propose(store, ada, [quill])).toBeDefined();
  });

  it("is withdrawn by its proposer, and by nobody else", () => {
    const store = storeOf();
    const op = propose(store, ada, [quill])!;
    expect(() => withdrawSuggestion(store, op.id, { author: kay })).toThrow(/Only who made a suggestion withdraws it/);
    withdrawSuggestion(store, op.id, { author: ada });
    expect(suggestions(store)).toEqual([]);
  });

  it("goes over the wire as a call of the store's own act", () => {
    const store = storeOf();
    const result = store.applyAll([{ name: PROPOSE_CHANGES, args: { calls: [quill] } }], { author: ada });
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]!.suggests).toEqual([quill]);
  });

  it("keeps who proposed it as a lineage key of its own", () => {
    expect(lineageOf({ basis: "b", proposedBy: "ada" })).toEqual({ basis: "b", proposedBy: "ada" });
    expect(() => lineageOf({ basis: "b", proposedBy: "" })).toThrow();
  });
});
