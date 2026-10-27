import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptSuggestion, declineSuggestion, mayDecide, suggest, suggestions, voteSuggestion } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, VOTE_SUGGESTION, type AnySchema, type Author, type Policy, type Principal } from "../../src/index.js";

/**
 * A SUGGESTION TAKES A VOTE FROM SOMEONE WHO MAY NOT ACCEPT IT (Roadmap
 * f-suggestion-votes). A reader who can see a suggestion and may not make
 * its change used to meet a refusal from Accept. Now their Accept and
 * Decline are a vote, for or against — one standing vote per person, which
 * they change by voting again and take back by withdrawing — kept as an op
 * of the built-in `vote-suggestion` act that touches no record, so the
 * suggestion still waits. Whoever may decide reads the tally on it and
 * accepts or declines as ever; a vote is its voter's to undo; a seat that
 * may not see the suggestion may not vote on it. An app may say a
 * suggestion is made at so many votes for (`tidying.autoAcceptAt`): the
 * app's own actor makes it in the vote's own gesture, with the voters in
 * its lineage — unless the actor would be refused, when the vote stands
 * and the suggestion goes on waiting.
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
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const kay: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const ria: Principal = { kind: "human", id: "ria", name: "Ria", roles: ["reader"] };
const rob: Principal = { kind: "human", id: "rob", name: "Rob", roles: ["reader"] };
const quill = { name: "supply", args: { id: "vendor:quill", event: "event:gala" } };
const NOW = "2026-10-27T09:00:00.000Z";
/** The keeper keeps everything; a reader may run nothing, and sees it all. */
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };

const storeOf = (options: { readonly policy?: Policy; readonly autoAcceptAt?: number } = { policy }) =>
  new Store<AnySchema>({
    schema,
    mutations: [supply] as never,
    now: () => NOW,
    ...(options.policy ? { policy: options.policy } : {}),
    ...(options.autoAcceptAt !== undefined ? { tidying: { autoAcceptAt: options.autoAcceptAt } } : {}),
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
const suggested = (store: Store<AnySchema>) => suggest(store, [quill], { author: actor, lineage: { basis: "Quill printed the invitations", confidence: 0.4 } })!;
const tallyFor = (store: Store<AnySchema>, who?: Principal) => suggestions(store, who)[0]?.tally;

describe("a reader's Accept and Decline are a vote", () => {
  it("records a vote for it, and the suggestion still waits", () => {
    const store = storeOf();
    const op = suggested(store);
    expect(mayDecide(store, suggestions(store)[0]!, ria)).toBe(false);
    expect(mayDecide(store, suggestions(store)[0]!, kay)).toBe(true);
    const answer = acceptSuggestion(store, op.id, { author: ria });
    expect(answer.voted).toBe("for");
    expect(answer.ops).toHaveLength(1);
    expect(answer.ops[0]).toMatchObject({ mutation: { name: VOTE_SUGGESTION, args: { suggestion: op.id, vote: "for" } }, primitives: [], vote: { suggestion: op.id, vote: "for" }, author: ria, intent: "For: Link Quill Stationers to Spring gala" });
    // The records the suggestion names are what the sentence read, so a seat kept from one is kept from the vote.
    expect(answer.ops[0]!.described).toEqual(["vendor:quill", "event:gala"]);
    expect(store.graph.allEdges()).toEqual([]);
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
    expect(tallyFor(store, ria)).toEqual({ for: 1, against: 0, mine: "for" });
    expect(tallyFor(store, kay)).toEqual({ for: 1, against: 0 });
  });

  it("is one standing vote per person: a later one replaces it, and null withdraws it", () => {
    const store = storeOf();
    const op = suggested(store);
    acceptSuggestion(store, op.id, { author: ria });
    expect(declineSuggestion(store, op.id, { author: ria }).voted).toBe("against");
    expect(tallyFor(store, ria)).toEqual({ for: 0, against: 1, mine: "against" });
    acceptSuggestion(store, op.id, { author: rob });
    expect(tallyFor(store)).toEqual({ for: 1, against: 1 });
    // An agent acting for Rob votes as Rob: the same standing vote.
    voteSuggestion(store, op.id, "against", { author: { kind: "agent", id: "claude", onBehalfOf: rob } });
    expect(tallyFor(store, rob)).toEqual({ for: 0, against: 2, mine: "against" });
    const withdrawn = voteSuggestion(store, op.id, null, { author: ria });
    expect(withdrawn.voted).toBeUndefined();
    expect(withdrawn.ops[0]!.intent).toBe("Withdraws a vote on: Link Quill Stationers to Spring gala");
    expect(tallyFor(store, ria)).toEqual({ for: 0, against: 1 });
    // Every vote is in the log, and none changed a record.
    expect(store.log.all().filter((one) => one.vote !== undefined)).toHaveLength(5);
    expect(store.log.all().every((one) => one.primitives.length === 0)).toBe(true);
  });

  it("leaves whoever may decide to accept or decline as ever, the tally beside them", () => {
    const store = storeOf();
    const op = suggested(store);
    acceptSuggestion(store, op.id, { author: ria });
    acceptSuggestion(store, op.id, { author: rob });
    expect(tallyFor(store, kay)).toEqual({ for: 2, against: 0 });
    const made = acceptSuggestion(store, op.id, { author: kay });
    expect(made.voted).toBeUndefined();
    expect(made.ops[0]).toMatchObject({ mutation: { name: "supply" }, author: kay, lineage: { suggestion: op.id } });
    expect(store.graph.allEdges()).toHaveLength(1);
    expect(suggestions(store)).toEqual([]);
    // A declined one, likewise: the keeper's Decline is the decline, not a vote.
    const other = storeOf();
    const second = suggested(other);
    expect(declineSuggestion(other, second.id, { author: kay }).ops[0]).toMatchObject({ undoes: second.id });
    expect(suggestions(other)).toEqual([]);
  });

  it("is anybody's in a store with no policy, as it always was", () => {
    const store = storeOf({});
    const op = suggested(store);
    expect(mayDecide(store, suggestions(store)[0]!, ria)).toBe(true);
    expect(acceptSuggestion(store, op.id, { author: ria }).voted).toBeUndefined();
    expect(store.graph.allEdges()).toHaveLength(1);
  });

  it("is its voter's to take back, and not another reader's", () => {
    const store = storeOf();
    const op = suggested(store);
    const vote = acceptSuggestion(store, op.id, { author: rob });
    expect(store.mayUndo(vote.batch, ria)).toMatchObject({ ok: false, refusal: { message: expect.stringMatching(/only whoever voted/) } });
    expect(store.mayUndo(vote.batch, rob)).toEqual({ ok: true });
    expect(store.mayUndo(vote.batch, kay)).toEqual({ ok: true });
    store.undo(vote.batch, { author: rob });
    expect(tallyFor(store, rob)).toEqual({ for: 0, against: 0 });
  });

  it("is refused to a seat that may not see the suggestion, and withheld from one that may not see a record it names", () => {
    const sighted: Policy = { ...policy, sees: [{ roles: ["keeper", "reader"], kinds: ["vendor", "event"] }, { roles: ["guest"], kinds: ["event"] }] };
    const store = storeOf({ policy: sighted });
    const op = suggested(store);
    const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };
    expect(() => voteSuggestion(store, op.id, "for", { author: gus })).toThrow(/no longer waiting/);
    expect(() => acceptSuggestion(store, op.id, { author: gus })).toThrow(/no longer waiting/);
    const vote = acceptSuggestion(store, op.id, { author: ria });
    const served = store.seenBy(gus).log.get(vote.ops[0]!.id)!;
    expect(served.withheld).toBe(true);
    expect(served.vote).toBeUndefined();
    expect(suggestions(store, gus)).toEqual([]);
  });
});

describe("an app that makes a suggestion at so many votes for", () => {
  it("has the app's own actor make it in the vote's own gesture, with the voters in its lineage", () => {
    const store = storeOf({ policy, autoAcceptAt: 2 });
    const op = suggested(store);
    acceptSuggestion(store, op.id, { author: ria });
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
    expect(store.graph.allEdges()).toEqual([]);
    const second = acceptSuggestion(store, op.id, { author: rob });
    expect(second.voted).toBe("for");
    expect(second.ops.map((one) => one.mutation?.name)).toEqual([VOTE_SUGGESTION, "supply"]);
    const made = second.ops[1]!;
    expect(made.batch).toBe(second.batch);
    expect(made.author).toEqual(actor);
    expect(made.lineage).toEqual({ basis: "Quill printed the invitations", confidence: 0.4, suggestion: op.id, voters: ["ria", "rob"] });
    expect(store.graph.allEdges()).toHaveLength(1);
    expect(suggestions(store)).toEqual([]);
    // One gesture, one undo: the keeper takes back the vote and what it made together.
    store.undo(second.batch, { author: kay });
    expect(store.graph.allEdges()).toEqual([]);
  });

  it("counts votes against for nothing, and a vote withdrawn no longer", () => {
    const store = storeOf({ policy, autoAcceptAt: 2 });
    const op = suggested(store);
    declineSuggestion(store, op.id, { author: ria });
    declineSuggestion(store, op.id, { author: rob });
    acceptSuggestion(store, op.id, { author: ria });
    expect(store.graph.allEdges()).toEqual([]);
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
  });

  it("leaves the vote standing and the suggestion waiting when the actor would be refused", () => {
    const store = storeOf({ policy, autoAcceptAt: 2 });
    const op = suggested(store);
    // A person said to leave the vendor alone: the actor may not change it, however many voted.
    store.apply({ name: "leave-alone-vendor", args: { id: "vendor:quill" } }, { author: kay });
    acceptSuggestion(store, op.id, { author: ria });
    const second = acceptSuggestion(store, op.id, { author: rob });
    expect(second.ops.map((one) => one.mutation?.name)).toEqual([VOTE_SUGGESTION]);
    expect(store.graph.allEdges()).toEqual([]);
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
    expect(tallyFor(store, kay)).toEqual({ for: 2, against: 0 });
  });

  it("rehearses the same way: a preview of the deciding vote shows what the actor would make, and keeps nothing", () => {
    const store = storeOf({ policy, autoAcceptAt: 1 });
    const op = suggested(store);
    const preview = store.previewAll([{ name: VOTE_SUGGESTION, args: { suggestion: op.id, vote: "for" } }], { author: ria });
    expect(preview.ops.map((one) => one.mutation?.name)).toEqual([VOTE_SUGGESTION, "supply"]);
    expect(store.graph.allEdges()).toEqual([]);
    expect(store.log.all().some((one) => one.vote !== undefined)).toBe(false);
  });
});
