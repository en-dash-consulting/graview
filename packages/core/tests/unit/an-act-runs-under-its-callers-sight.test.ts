import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { answerSeenBy, refusalOf, Store, type AnySchema, type GraviewApp, type MutationCall, type Principal } from "../../src/index.js";
import { guest, keeper, MUTATIONS, policy, said, schema, world } from "../support/hidden-holds.js";

/**
 * AN ACT RUNS UNDER ITS CALLER'S SIGHT (FR-55).
 *
 * The store refused a call naming a record its seat may not see exactly as
 * one naming nothing, but an act's own body ran on the whole store: a guard
 * that counted holds on a room refused a guest when a hold it could not see
 * was there and let it through when none was, so the guest learned the hold
 * existed. Now the body, its guard, its refusal and its sentence read the
 * store as the caller is served it — a hidden record is to the act what an
 * absent one is — and what it writes lands on the whole store, its hidden
 * links and fields kept. Each claim compares a world with the hidden record
 * and the same world without it, and finds nothing the seat is told that
 * differs: whether the act ran, its refusal and reason, its answer, its
 * problems, what it is served after, and the client's own guess at the
 * outcome, which the host now always confirms (no refusal after the fact,
 * no extra round trip).
 */
/** Everything a seat is told of one call: its answer as served, or its refusal — minted ids and clocks said alike. */
function told(store: Store<AnySchema>, call: MutationCall, author: Principal): string {
  let answer: unknown;
  try {
    answer = answerSeenBy(store, author, store.apply(call, { author }));
  } catch (error) {
    answer = { refused: refusalOf(error) };
  }
  const after = { snapshot: store.seenBy(author).snapshot(), problems: store.seenBy(author).violations() };
  return JSON.stringify({ answer, after }).replace(/(batch|op):[a-z0-9:]+/g, "$1:minted").replace(/"at":"[^"]*"/g, '"at":"now"');
}

const CALLS: readonly MutationCall[] = [
  { name: "book-room", args: { id: "room:blue" } },
  { name: "release-room", args: { id: "room:blue" } },
  { name: "tally-room", args: { id: "room:blue" } },
  { name: "tidy-room", args: { id: "room:blue" } },
];
/*
 * Not among them: a removal whose cascade takes a link to a hidden record
 * is the store's bookkeeping, not the act's logic, and its op is served to
 * the seat withheld (FR-67) — a follow-up of its own.
 */
const CLOSE: MutationCall = { name: "close-room", args: { id: "room:blue" } };

describe("an act runs under its caller's sight", () => {
  it("tells a seat the same whether a record it may not see exists — whether the act ran, its refusal, its answer, its problems and what it is served after", () => {
    for (const call of CALLS) expect(told(world(true), call, guest), call.name).toBe(told(world(false), call, guest));
  });

  it("still answers a seat that sees the record by it: the hold refuses the keeper's booking in its own words", () => {
    expect(JSON.parse(told(world(true), CALLS[0]!, keeper)).answer.refused).toEqual({ reason: "refused", sentence: "Freya Davies holds it." });
    expect(JSON.parse(told(world(false), CALLS[0]!, keeper)).answer.refused).toBeUndefined();
  });

  it("refuses alike in the branch that needs the record: “Nothing holds this room.”, reason refused, for the hidden hold as for none", () => {
    expect(JSON.parse(told(world(true), CALLS[1]!, guest)).answer.refused).toEqual({ reason: "refused", sentence: "Nothing holds this room." });
  });

  it("says its problems alike: what the booking introduces is the same rule about the same room", () => {
    const introduces = (held: boolean) => answerSeenBy(world(held), guest, world(held).preview(CALLS[0]!, undefined, { author: guest })).introduces.map((one) => one.invariant);
    expect(introduces(true)).toEqual(["a-booked-room-says-what-for"]);
    expect(introduces(true)).toEqual(introduces(false));
  });

  it("is offered alike: through the seat's view, would-it-change and the preview read as the seat", () => {
    for (const held of [true, false]) {
      const view = world(held).seenBy(guest);
      expect(view.wouldChange(CALLS[3]!), `held: ${held}`).toBe(true);
      expect(view.preview(CALLS[2]!).primitives).toEqual([{ op: "patch-node", id: "room:blue", before: { note: undefined }, after: { note: "0 holds, 0 in all" } }]);
    }
    // The whole store, asked as nobody in particular, still reads the hold.
    expect(world(true).wouldChange(CALLS[3]!)).toBe(false);
  });

  it("writes on the whole store: a hidden link a removal takes goes with it and comes back with the undo", () => {
    const store = world(true);
    const done = store.apply(CLOSE, { author: guest });
    expect(store.graph.getNode("room:blue")).toBeUndefined();
    expect(store.graph.getNode("hold:freya")).toBeDefined();
    expect(store.graph.allEdges()).toEqual([]);
    store.undo(done.batch, { author: { kind: "system" } });
    expect(store.graph.getNode("room:blue")).toMatchObject({ name: "Blue" });
    expect(store.graph.allEdges()).toEqual([{ kind: "on", from: "hold:freya", to: "room:blue" }]);
  });

  it("keeps a hidden field it never wrote: a patch's prior values are the store's, not the seat's", () => {
    const store = world(true);
    store.applyPrimitives([{ op: "patch-node", id: "room:blue", before: {}, after: { note: "hold:freya" } }], { author: { kind: "system" } });
    // The seat is served the room without the note that names the hold …
    expect(store.seenBy(guest).graph.getNode("room:blue")).not.toHaveProperty("note");
    // … and its booking writes only what it wrote, and is undone to what was there.
    const done = store.apply(CALLS[0]!, { author: guest });
    expect(store.graph.getNode("room:blue")).toMatchObject({ booked: true, note: "hold:freya" });
    store.undo(done.batch, { author: guest });
    expect(store.graph.getNode("room:blue")).toEqual({ id: "room:blue", kind: "room", name: "Blue", note: "hold:freya" });
  });

  it("never mints an id a record it may not see holds", () => {
    const store = world(true);
    store.apply({ name: "open-room", args: { name: "Freya" } }, { author: keeper });
    store.applyPrimitives([{ op: "add-node", node: { id: "room:green", kind: "room", name: "Green" } }], { author: { kind: "system" } });
    const made = store.apply({ name: "open-room", args: { name: "Green" } }, { author: guest });
    expect(made.writes).toEqual(["room:green-2"]);
  });

  it("is confirmed by the host as the seat's own store guessed it: no refusal after the fact, so no second round trip", () => {
    for (const held of [true, false]) {
      const host = world(held);
      // What a page on a served app holds: the seat's view, under the same policy.
      const page = new Store<AnySchema>({ schema: schema as unknown as AnySchema, mutations: MUTATIONS as never, invariants: [said] as never, policy, snapshot: host.seenBy(guest).snapshot() as never });
      for (const call of CALLS.slice(0, 4)) {
        const guessed = (() => {
          try {
            return page.preview(call, undefined, { author: guest }).primitives;
          } catch (error) {
            return refusalOf(error);
          }
        })();
        const judged = (() => {
          try {
            return answerSeenBy(host, guest, host.preview(call, undefined, { author: guest })).primitives;
          } catch (error) {
            return refusalOf(error);
          }
        })();
        expect(judged, `${call.name}, held: ${held}`).toEqual(guessed);
      }
    }
  });
});

describe("a document's act runs under its caller's sight", () => {
  const DEALS = {
    format: "graview-document",
    formatVersion: 1,
    name: "Deals",
    roles: ["owner", "agent"],
    kinds: {
      deal: { fields: { name: { type: "string", required: true }, stage: { type: "enum", options: ["open", "won"], required: true } }, edges: { notes: { to: ["memo"] } } },
      memo: { fields: { name: { type: "string", required: true }, flagged: { type: "boolean" } } },
    },
    acts: {
      "close-deal": { on: "deal", sets: { stage: "won" }, allowedWhen: "not some(out('notes'), flagged == true)", refusal: "A flagged memo stands in the way" },
      "reopen-deal": { on: "deal", sets: { stage: "open" }, allowedWhen: "count(all('memo')) > 0", refusal: "{first(all('memo')).name} says no" },
      "tally-deal": { on: "deal", sets: { name: { expr: "name + ' (' + count(notes) + ')'" } } },
    },
    policy: {
      grants: [{ roles: "*", mutations: "*" }],
      sees: [
        { roles: ["owner"], kinds: ["deal", "memo"] },
        { roles: ["agent"], kinds: ["deal"] },
      ],
    },
  };
  const compiled = compileDocument(DEALS);
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const deals = (memo: boolean) =>
    new Store<AnySchema>({
      schema: app.schema,
      mutations: (app.mutations ?? []) as never,
      ...(app.policy ? { policy: app.policy } : {}),
      snapshot: {
        nodes: [{ id: "deal:acme", kind: "deal", name: "Acme", stage: "open" }, ...(memo ? [{ id: "memo:legal", kind: "memo", name: "Legal", flagged: true }] : [])],
        edges: memo ? [{ kind: "notes", from: "deal:acme", to: "memo:legal" }] : [],
      } as never,
    });
  const agent: Principal = { kind: "human", id: "person:al", roles: ["agent"] };
  const owner: Principal = { kind: "human", id: "person:oz", roles: ["owner"] };

  it("tells an agent the same of its condition, its refusal and the value it sets, whether a memo it may not see exists", () => {
    for (const name of ["close-deal", "reopen-deal", "tally-deal"]) {
      const call = { name, args: { id: "deal:acme" } };
      expect(told(deals(true), call, agent), name).toBe(told(deals(false), call, agent));
    }
  });

  it("still holds the owner to the memo it sees", () => {
    expect(JSON.parse(told(deals(true), { name: "close-deal", args: { id: "deal:acme" } }, owner)).answer.refused.sentence).toBe("A flagged memo stands in the way");
  });
});
