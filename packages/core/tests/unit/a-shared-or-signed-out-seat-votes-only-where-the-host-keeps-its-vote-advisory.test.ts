import { describe, expect, it } from "vitest";
import { z } from "zod";
import { acceptSuggestion, declineSuggestion, SIGN_IN_TO_VOTE, suggest, suggestions, voteSuggestion } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, VOTE_SUGGESTION, type AnySchema, type Author, type Policy, type Principal, type VotesOptions } from "../../src/index.js";

/**
 * A SHARED OR SIGNED-OUT SEAT VOTES ONLY WHERE THE HOST KEEPS ITS VOTE
 * ADVISORY (Roadmap f-votes-shared-seat). A host that serves every
 * signed-out visitor as one principal (Cloud's `anonymous`) got one shared
 * vote on 0.1.62: a stranger's vote was that seat's, any other stranger
 * could flip it, and the tray showed one stranger another's. Now the store
 * refuses a vote from a seat the host marks `shared`, or a `visitor`, in
 * words — on every path, policy or none. A host may keep such votes as
 * advisory (`votes: { advisory: "visitors" }`): each under the visitor's
 * own key (`visitorKey`), counted apart in the tally, never toward
 * `autoAcceptAt`, and only that visitor's to take back.
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
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const ria: Principal = { kind: "human", id: "ria", roles: ["reader"] };
const anonymous: Principal = { kind: "human", id: "anonymous", roles: ["reader"], shared: true };
const stranger = (key: string): Principal => ({ ...anonymous, visitorKey: key });
const formVisitor: Principal = { kind: "visitor", id: "v-1", roles: ["reader"] };
const quill = { name: "supply", args: { id: "vendor:quill", event: "event:gala" } };
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };

const storeOf = (options: { readonly policy?: Policy; readonly autoAcceptAt?: number; readonly votes?: VotesOptions } = { policy }) =>
  new Store<AnySchema>({
    schema,
    mutations: [supply] as never,
    now: () => "2026-10-28T09:00:00.000Z",
    ...(options.policy ? { policy: options.policy } : {}),
    ...(options.autoAcceptAt !== undefined ? { tidying: { autoAcceptAt: options.autoAcceptAt } } : {}),
    ...(options.votes ? { votes: options.votes } : {}),
    snapshot: {
      nodes: [
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
        { id: "event:gala", kind: "event", label: "Spring gala" },
      ] as never,
      edges: [],
    },
  });
const suggested = (store: Store<AnySchema>) => suggest(store, [quill], { author: actor, lineage: { basis: "Quill printed the invitations", confidence: 0.4 } })!;
const voteCall = (id: string) => ({ name: VOTE_SUGGESTION, args: { suggestion: id, vote: "for" } });

describe("a vote from a shared or signed-out seat is refused", () => {
  it("in words, by Accept, Decline, a vote and a raw call alike, and nothing is kept", () => {
    const store = storeOf();
    const op = suggested(store);
    expect(() => acceptSuggestion(store, op.id, { author: anonymous })).toThrow(SIGN_IN_TO_VOTE);
    expect(() => declineSuggestion(store, op.id, { author: anonymous })).toThrow(SIGN_IN_TO_VOTE);
    expect(() => voteSuggestion(store, op.id, "for", { author: stranger("cookie-a") })).toThrow(SIGN_IN_TO_VOTE);
    expect(() => store.applyAll([voteCall(op.id)], { author: anonymous })).toThrow(SIGN_IN_TO_VOTE);
    expect(store.log.all().filter((one) => one.vote !== undefined)).toEqual([]);
    expect(store.permits(voteCall(op.id), anonymous)).toMatchObject({ ok: false, refusal: { message: SIGN_IN_TO_VOTE } });
    // A person signed in still votes.
    expect(store.permits(voteCall(op.id), ria).ok).toBe(true);
    expect(acceptSuggestion(store, op.id, { author: ria }).voted).toBe("for");
  });

  it("from a form's visitor, and from an agent acting for a shared seat, too", () => {
    const store = storeOf();
    const op = suggested(store);
    expect(() => voteSuggestion(store, op.id, "for", { author: formVisitor })).toThrow(SIGN_IN_TO_VOTE);
    const agent: Principal = { kind: "agent", id: "claude", roles: ["reader"], onBehalfOf: anonymous };
    expect(() => voteSuggestion(store, op.id, "for", { author: agent })).toThrow(SIGN_IN_TO_VOTE);
  });

  it("in an app with no policy as well", () => {
    const store = storeOf({});
    const op = suggested(store);
    expect(() => voteSuggestion(store, op.id, "for", { author: anonymous })).toThrow(SIGN_IN_TO_VOTE);
  });
});

describe("a host that keeps visitors' votes advisory", () => {
  const advisory = { policy, votes: { advisory: "visitors" } as const };

  it("still refuses a shared seat that says no visitor", () => {
    const store = storeOf(advisory);
    const op = suggested(store);
    expect(() => voteSuggestion(store, op.id, "for", { author: anonymous })).toThrow(SIGN_IN_TO_VOTE);
  });

  it("keeps each visitor's vote under their own key, apart from the people's, and one stranger cannot flip another's", () => {
    const store = storeOf(advisory);
    const op = suggested(store);
    const kept = voteSuggestion(store, op.id, "for", { author: stranger("cookie-a") });
    expect(kept.ops[0]!.vote).toEqual({ suggestion: op.id, vote: "for", advisory: true, voter: "cookie-a" });
    voteSuggestion(store, op.id, "against", { author: stranger("cookie-b") });
    acceptSuggestion(store, op.id, { author: ria });
    expect(suggestions(store, ria)[0]!.tally).toEqual({ for: 1, against: 0, mine: "for", advisory: { for: 1, against: 1 } });
    expect(suggestions(store, stranger("cookie-a"))[0]!.tally.mine).toBe("for");
    expect(suggestions(store, stranger("cookie-b"))[0]!.tally.mine).toBe("against");
    // A third stranger on the same seat has no vote of their own yet, and is not told another's.
    expect(suggestions(store, stranger("cookie-c"))[0]!.tally.mine).toBeUndefined();
    // B voting again changes B's vote, not A's.
    voteSuggestion(store, op.id, "for", { author: stranger("cookie-b") });
    expect(suggestions(store, ria)[0]!.tally.advisory).toEqual({ for: 2, against: 0 });
    expect(suggestions(store, stranger("cookie-a"))[0]!.tally.mine).toBe("for");
  });

  it("never counts toward autoAcceptAt", () => {
    const store = storeOf({ ...advisory, autoAcceptAt: 1 });
    const op = suggested(store);
    voteSuggestion(store, op.id, "for", { author: stranger("cookie-a") });
    voteSuggestion(store, op.id, "for", { author: stranger("cookie-b") });
    expect(store.graph.allEdges()).toEqual([]);
    expect(suggestions(store).map((one) => one.id)).toEqual([op.id]);
    // One person's vote reaches it.
    acceptSuggestion(store, op.id, { author: ria });
    expect(store.graph.allEdges()).toHaveLength(1);
  });

  it("is only its own visitor's to take back", () => {
    const store = storeOf(advisory);
    const op = suggested(store);
    const kept = voteSuggestion(store, op.id, "for", { author: stranger("cookie-a") });
    expect(() => store.undo(kept.ops[0]!.batch, { author: stranger("cookie-b") })).toThrow("only whoever voted takes their vote back");
    expect(() => store.undo(kept.ops[0]!.batch, { author: anonymous })).toThrow("only whoever voted takes their vote back");
    store.undo(kept.ops[0]!.batch, { author: stranger("cookie-a") });
    expect(suggestions(store, ria)[0]!.tally).toEqual({ for: 0, against: 0 });
  });
});
