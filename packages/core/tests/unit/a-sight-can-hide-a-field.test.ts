import { describe, expect, it } from "vitest";
import { refusalOf, Store, type AnySchema, type MutationCall, type Principal } from "../../src/index.js";
import { search } from "../../src/search.js";
import "../../src/field-sight.js";
import { answerSeenBy } from "../../src/seat.js";
import { coach, parent, world } from "../support/hidden-phones.js";

/**
 * A SIGHT CAN HIDE A FIELD, NOT ONLY A KIND (Roadmap f-field-sight).
 *
 * A role saw a whole record or none of it, so a roster where parents see
 * every player's name but not their phone number could not be said. Now a
 * sight says `hide: [...]` (or `fields: [...]`, an allow list), sights add
 * up — a second sight showing a parent their own child whole gives the
 * phone back there — and the seat view serves a record without what its
 * sight keeps. Each claim compares the world where Ann has a phone number
 * with the same world where she has another, or none, and finds nothing
 * the parent reads that differs: the graph, the log, its problems, a
 * search, a name, its own acts and their refusals.
 */
const NUMBERS = /0101|0202|asthma/;

/** Everything one seat reads of a store, minted ids and clocks said alike. */
function reads(store: Store<AnySchema>, seat: Principal): string {
  const view = store.seenBy(seat);
  const found = (query: string) => search(store, query, { principal: seat }).hits.map((hit) => ("id" in hit ? hit.id : hit.about));
  return JSON.stringify({
    snapshot: view.snapshot(),
    log: view.log.all(),
    batches: view.batches(),
    problems: view.violations(),
    findings: view.findings(),
    epochs: view.log.epochs(),
    undo: view.batches().map((batch) => view.canUndo(batch.id)),
    searches: [found("555"), found("777"), found("asthma"), found("Annie"), found("Doc"), found("0101")],
    names: [store.resolveRef({ name: "id", kinds: ["contact"] }, "Doc", seat), store.resolveRef({ name: "id", kinds: ["contact"] }, "Doc (555", seat)],
  })
    .replace(/(batch|op):[a-z0-9:]+/g, "$1:minted")
    .replace(/"at":"[^"]*"/g, '"at":"now"');
}

/** What a seat is told of one call: its answer as served, or its refusal. */
function told(store: Store<AnySchema>, call: MutationCall, author: Principal): string {
  let answer: unknown;
  try {
    answer = answerSeenBy(store, author, store.apply(call, { author }));
  } catch (error) {
    answer = { refused: refusalOf(error) };
  }
  return JSON.stringify({ answer, after: reads(store, author) }).replace(/(batch|op):[a-z0-9:]+/g, "$1:minted").replace(/"at":"[^"]*"/g, '"at":"now"');
}

describe("a sight can hide a field", () => {
  it("serves a parent every player's name and no phone number or medical note: the record is there, the fields are not", () => {
    const view = world("555 0101").seenBy(parent);
    expect(view.graph.getNode("player:ann")).toEqual({ id: "player:ann", kind: "player", name: "Annie", team: "called" });
    expect(view.graph.nodesOfKind("player" as never).map((node: { id: string }) => node.id)).toEqual(expect.arrayContaining(["player:ann", "player:bea"]));
  });

  it("adds sights up: the parent's own child is shown whole by a second sight, and the coach sees every field", () => {
    const store = world("555 0101");
    expect(store.seenBy(parent).graph.getNode("player:bea")).toMatchObject({ phone: "444 0303" });
    expect(store.seenBy(coach).graph.getNode("player:ann")).toMatchObject({ phone: "555 0101", medical: "asthma" });
  });

  it("an allow list shows only what it lists: a parent sees a contact's name and nothing else", () => {
    expect(world("555 0101").seenBy(parent).graph.getNode("contact:doc")).toEqual({ id: "contact:doc", kind: "contact", name: "Doc" });
  });

  it("tells a parent nothing that differs between one phone number and another — graph, log, problems, search, names, undo", () => {
    expect(reads(world("555 0101", "555 0202"), parent)).toBe(reads(world("777 0101", "777 0202"), parent));
  });

  it("tells a parent nothing that differs between a phone number and none", () => {
    const with_ = reads(world("555 0101"), parent);
    expect(with_).toBe(reads(world(undefined), parent));
    expect(with_).not.toMatch(NUMBERS);
    expect(with_).not.toContain("asthma");
  });

  it("still tells the coach, who sees the field, every value", () => {
    expect(reads(world("555 0101", "555 0202"), coach)).not.toBe(reads(world("777 0101", "777 0202"), coach));
  });

  it("withholds an op whose sentence read the hidden field, whatever it held: “Call 555 0101” never reaches the parent", () => {
    const log = world("555 0101").seenBy(parent).log.all();
    const called = log.at(-1)!;
    expect(called.withheld).toBe(true);
    expect(called.primitives).toMatchObject([{ op: "patch-node", id: "player:ann", after: { team: "called" } }]);
    expect(JSON.stringify(called)).not.toMatch(NUMBERS);
    // The rename's sentence read only the name: served whole.
    expect(log.at(-2)!.intent).toBe("Rename Ann to Annie");
    expect(log.at(-2)!.withheld).toBeUndefined();
  });

  it("refuses a parent's write of a hidden field as an argument the act does not take — the same refusal whatever it held and whatever was written", () => {
    const write = (phone: string | undefined, value: string) => told(world(phone), { name: "set-phone", args: { id: "player:ann", phone: value } }, parent);
    const refused = JSON.parse(write("555 0101", "555 0101")).answer.refused;
    expect(refused.reason).toBe("invalid");
    expect(JSON.stringify(refused)).toContain('does not take \\"phone\\"');
    expect(write("555 0101", "555 0101")).toBe(write(undefined, "555 0101"));
    expect(write("555 0101", "555 0101")).toBe(write("777 0101", "555 0101"));
    expect(world("555 0101").graph.getNode("player:ann")).toMatchObject({ phone: "555 0101" });
  });

  it("refuses a parent who adds a contact with a phone number, and lets one add a contact without", () => {
    const store = world(undefined);
    expect(() => store.apply({ name: "add-contact", args: { name: "Cal", phone: "555 0404" } }, { author: parent })).toThrow(/does not take "phone"/);
    store.apply({ name: "add-contact", args: { name: "Cal" } }, { author: parent });
    expect(store.seenBy(parent).graph.nodesOfKind("contact" as never).map((node: { name?: unknown }) => node.name)).toContain("Cal");
  });

  it("lets a parent add a player with a phone number: what a parent makes is their own, which a sight shows whole", () => {
    const store = world(undefined);
    store.apply({ name: "add-player", args: { name: "Cal", phone: "555 0404" } }, { author: parent });
    expect(store.seenBy(parent).graph.nodesOfKind("player" as never).find((node: { name?: unknown }) => node.name === "Cal")).toMatchObject({ phone: "555 0404" });
  });

  it("lets the parent write their own child's phone, which their sight shows", () => {
    const store = world(undefined);
    store.apply({ name: "set-phone", args: { id: "player:bea", phone: "555 0505" } }, { author: parent });
    expect(store.seenBy(parent).graph.getNode("player:bea")).toMatchObject({ phone: "555 0505" });
  });

  it("tells a parent the same of its own act on a player whose phone it may not see", () => {
    const rename: MutationCall = { name: "rename-player", args: { id: "player:ann", name: "Anne" } };
    const answer = told(world("555 0101"), rename, parent);
    expect(answer).toBe(told(world(undefined), rename, parent));
    expect(answer).toContain("Rename Annie to Anne");
  });

  it("finds no record by a hidden field's words, and names a contact by its name alone", () => {
    const store = world("555 0101");
    expect(search(store, "555", { principal: parent }).hits).toEqual([]);
    expect(search(store, "555", { principal: coach }).hits.length).toBeGreaterThan(0);
    expect(store.resolveRef({ name: "id", kinds: ["contact"] }, "contact:doc", parent)).toMatchObject({ ok: true, label: "Doc" });
    expect(store.resolveRef({ name: "id", kinds: ["contact"] }, "Doc (555", parent)).toMatchObject({ ok: false, reason: "none" });
    expect(store.resolveRef({ name: "id", kinds: ["contact"] }, "Doc (555", coach)).toMatchObject({ ok: true, id: "contact:doc" });
  });
});
