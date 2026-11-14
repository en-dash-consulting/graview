import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptSuggestion, declineSuggestion, propose, suggest, suggestions, withdrawSuggestion } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Author, type Policy, type Principal } from "../../src/index.js";

/**
 * A SUGGESTION STOPS WAITING ONLY WHEN IT IS ANSWERED. A person's proposal,
 * or the app's own actor's suggestion, is accepted, declined or withdrawn —
 * by whoever may answer it — and by nothing else. A change of somebody's
 * own that says it accepted a suggestion, or an undo that says so, is kept
 * without that word: the suggestion still waits. Accepting it by making
 * exactly its change, as whoever may make it, is accepting it, as it goes
 * over the wire.
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
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.id, to: args.event });
  },
});
const rename = defineMutation("rename-event", {
  title: "Rename an event",
  subject: { kinds: ["event"], arg: "id" },
  input: z.object({ id: nodeRef(["event"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const kay: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const ada: Principal = { kind: "human", id: "ada", name: "Ada", roles: ["helper"] };
const mel: Principal = { kind: "human", id: "mel", name: "Mel", roles: ["member"] };
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const quill = { name: "supply", args: { id: "vendor:quill", event: "event:gala" } };
const fern = { name: "supply", args: { id: "vendor:fern", event: "event:gala" } };
const renamed = { name: "rename-event", args: { id: "event:gala", label: "Gala" } };
const NOW = "2026-11-14T09:00:00.000Z";
/** The keeper runs everything; a helper proposes a vendor's supplying; a member renames events and may answer nothing. */
const policy: Policy = {
  roles: ["keeper", "helper", "member"],
  grants: [
    { roles: ["keeper"], mutations: "*" },
    { roles: ["helper"], mutations: [], propose: ["supply"], kinds: ["vendor"] },
    { roles: ["member"], mutations: ["rename-event"] },
  ],
};

const storeOf = () =>
  new Store<AnySchema>({
    schema,
    mutations: [supply, rename] as never,
    now: () => NOW,
    policy,
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "vendor:fern", kind: "vendor", label: "Fern Florists" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });

const waiting = (store: Store<AnySchema>, id: string) => suggestions(store, kay).some((one) => one.id === id);
const planted = (id: string, more: Record<string, unknown> = {}) => ({ basis: "Accepted it", suggestion: id, ...more });

/** Ada's proposal, and the app's own actor's suggestion of two changes. */
function waitingTwo() {
  const store = storeOf();
  const proposal = propose(store, ada, [quill])!;
  const tidying = suggest(store, [quill, fern], { author: actor, lineage: { basis: "Both printed for the gala", confidence: 0.5 } })!;
  return { store, proposal, tidying };
}

describe("a member's act that says it accepted somebody else's suggestion", () => {
  it("leaves a person's proposal waiting", () => {
    const { store, proposal } = waitingTwo();
    const made = store.applyAll([renamed], { author: mel, lineage: planted(proposal.id) });
    expect(made.ops[0]!.lineage?.suggestion).toBeUndefined();
    expect(waiting(store, proposal.id)).toBe(true);
  });

  it("leaves the app's own suggestion waiting, whole and in part", () => {
    const { store, tidying } = waitingTwo();
    store.applyAll([renamed], { author: mel, lineage: planted(tidying.id) });
    store.applyAll([{ ...renamed, args: { ...renamed.args, label: "Gala night" } }], { author: mel, lineage: planted(tidying.id, { items: [0] }) });
    expect(waiting(store, tidying.id)).toBe(true);
    expect(suggestions(store, kay).find((one) => one.id === tidying.id)!.items.map((item) => item.at)).toEqual([0, 1]);
  });

  it("leaves it waiting when the act is a keeper's that is not the suggestion's change", () => {
    const { store, proposal, tidying } = waitingTwo();
    store.applyAll([renamed], { author: kay, lineage: planted(proposal.id) });
    store.applyAll([fern], { author: kay, lineage: planted(tidying.id, { items: [0] }) });
    expect(waiting(store, proposal.id)).toBe(true);
    expect(suggestions(store, kay).find((one) => one.id === tidying.id)!.items.map((item) => item.at)).toEqual([0, 1]);
  });

  it("leaves it waiting when it is an undo", () => {
    const { store, proposal, tidying } = waitingTwo();
    const own = store.applyAll([renamed], { author: mel });
    const undo = store.undo(own.batch, { author: mel, lineage: planted(proposal.id) });
    expect(undo.ops.every((op) => op.lineage?.suggestion === undefined)).toBe(true);
    const again = store.applyAll([renamed], { author: mel });
    store.undo(again.batch, { author: mel, lineage: planted(tidying.id, { items: [0, 1] }) });
    expect(waiting(store, proposal.id)).toBe(true);
    expect(waiting(store, tidying.id)).toBe(true);
  });

  it("leaves it waiting when it is another suggestion", () => {
    const { store, proposal } = waitingTwo();
    const other = suggest(store, [renamed], { author: actor, lineage: planted(proposal.id) as never })!;
    expect(other.lineage?.suggestion).toBeUndefined();
    expect(waiting(store, proposal.id)).toBe(true);
  });

  it("leaves it waiting when it names a place the suggestion does not hold", () => {
    const { store, tidying } = waitingTwo();
    store.applyAll([fern], { author: kay, lineage: planted(tidying.id, { items: [1, 2, 3] }) });
    expect(suggestions(store, kay).find((one) => one.id === tidying.id)!.items.map((item) => item.at)).toEqual([0, 1]);
  });
});

describe("a member who may not answer a suggestion", () => {
  it("cannot make it stop waiting by any path", () => {
    const { store, proposal, tidying } = waitingTwo();
    for (const id of [proposal.id, tidying.id]) {
      // Accept and decline from a seat that may not make the change are votes.
      expect(acceptSuggestion(store, id, { author: mel }).voted).toBe("for");
      expect(declineSuggestion(store, id, { author: mel }).voted).toBe("against");
      expect(() => withdrawSuggestion(store, id, { author: mel })).toThrow(/Only who made a suggestion withdraws it/);
      // Its own change, carrying the suggestion's lineage as the store keeps it.
      expect(() => store.applyAll(store.log.get(id)!.suggests!, { author: mel, lineage: { ...store.log.get(id)!.lineage!, suggestion: id } })).toThrow();
      expect(() => store.undo(store.log.get(id)!.batch, { author: mel })).toThrow();
      store.applyAll([renamed], { author: mel, lineage: { ...store.log.get(id)!.lineage!, suggestion: id } });
      expect(waiting(store, id)).toBe(true);
    }
  });
});

describe("a suggestion's batch", () => {
  it("is joined by no other change, so its maker still withdraws it and a decline takes back only it", () => {
    const { store, proposal } = waitingTwo();
    expect(() => store.applyAll([renamed], { author: mel, batch: proposal.batch })).toThrow(/a batch of its own/);
    const own = store.applyAll([renamed], { author: mel });
    expect(() => store.undo(own.batch, { author: mel, batch: proposal.batch })).toThrow(/a batch of its own/);
    withdrawSuggestion(store, proposal.id, { author: ada });
    expect(waiting(store, proposal.id)).toBe(false);
    expect(store.graph.getNode("event:gala")).toMatchObject({ label: "Gala" });
  });
});

describe("the real answers", () => {
  it("still accept, decline and withdraw", () => {
    const accepted = waitingTwo();
    const made = acceptSuggestion(accepted.store, accepted.proposal.id, { author: kay });
    expect(made.ops[0]!.lineage).toMatchObject({ suggestion: accepted.proposal.id, proposedBy: "ada" });
    expect(waiting(accepted.store, accepted.proposal.id)).toBe(false);

    const declined = waitingTwo();
    declineSuggestion(declined.store, declined.tidying.id, { author: kay });
    expect(waiting(declined.store, declined.tidying.id)).toBe(false);

    const withdrawn = waitingTwo();
    withdrawSuggestion(withdrawn.store, withdrawn.proposal.id, { author: ada });
    expect(waiting(withdrawn.store, withdrawn.proposal.id)).toBe(false);
  });

  it("accept some of a suggestion of several, and the rest still wait", () => {
    const { store, tidying } = waitingTwo();
    const made = acceptSuggestion(store, tidying.id, { author: kay, items: [1] });
    expect(made.ops[0]!.lineage).toMatchObject({ suggestion: tidying.id, items: [1] });
    expect(suggestions(store, kay).find((one) => one.id === tidying.id)!.items.map((item) => item.at)).toEqual([0]);
    acceptSuggestion(store, tidying.id, { author: kay });
    expect(waiting(store, tidying.id)).toBe(false);
  });

  it("accept as the wire does: exactly the suggestion's change, as whoever may make it, with its lineage", () => {
    const { store, proposal } = waitingTwo();
    const made = store.applyAll([quill], { author: kay, lineage: { ...proposal.lineage!, suggestion: proposal.id } });
    expect(made.ops[0]!.lineage).toMatchObject({ suggestion: proposal.id, proposedBy: "ada" });
    expect(waiting(store, proposal.id)).toBe(false);
  });
});
