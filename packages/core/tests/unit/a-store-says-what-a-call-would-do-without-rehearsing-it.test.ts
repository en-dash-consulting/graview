import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { profilePersonId, Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A STORE SAYS WHAT A CALL WOULD DO WITHOUT REHEARSING IT (`wouldDo`): that
 * it changes something, changes nothing, or is refused by the act, and why;
 * under the author's sight; for the store's own author when none is said,
 * as `apply`; and for a profile whose person is not made yet as the person
 * `apply` would make first — so a face that asks it offers what pressing
 * does. Nothing it asks is kept, and nobody is made.
 */
const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiledBoard = compileDocument(board);
if (!compiledBoard.ok) throw new Error("the board compiles");
const ideas = (edges: readonly unknown[] = [], by?: Principal) =>
  new Store<AnySchema>({
    schema: compiledBoard.app.schema,
    mutations: compiledBoard.app.mutations as never,
    policy: compiledBoard.app.policy!,
    ...(by ? { principal: by } : {}),
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "member", name: "Ann" },
        { id: "idea:a", kind: "idea", title: "A picnic" },
        { id: "idea:b", kind: "idea", title: "A hike" },
      ],
      edges,
    } as never,
  });
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const kid: Principal = { ...ann, profile: { id: "prf_kid", name: "Kid" } };

describe("what a call would do", () => {
  it("is a change, nothing, or a refusal in the act's own words", () => {
    const store = ideas([{ kind: "votedBy", from: "idea:a", to: "p_ann" }]);
    const said = store.wouldDo(
      [
        { name: "vote-for", args: { id: "idea:b" } },
        { name: "vote-for", args: { id: "idea:a" } },
        { name: "take-back", args: { id: "idea:b", to: "p_ann" } },
      ],
      ann,
    );
    expect(said[0]).toBe("changes");
    expect(said[1]).toBe("nothing");
    expect((said[2] as { refused: Error }).refused.message).toMatch(/has nothing to take away: A hike is not linked to Ann that way/);
    expect(store.log.all()).toEqual([]);
  });

  it("is asked for the store's own author when none is said, as apply is", () => {
    const store = ideas([], ann);
    expect(store.wouldDo([{ name: "vote-for", args: { id: "idea:a" } }])).toEqual(["changes"]);
    expect(store.wouldDo([{ name: "vote-for", args: { id: "idea:a" } }], { kind: "human", roles: ["member"] })[0]).toMatchObject({ refused: expect.anything() });
  });

  it("for a profile whose person is not made yet, is what apply would do, and makes nobody", () => {
    const store = ideas();
    const person = profilePersonId("p_ann", { id: "prf_kid" });
    expect(store.wouldDo([{ name: "vote-for", args: { id: "idea:a" } }, { name: "champion", args: { id: "idea:b" } }], kid)).toEqual(["changes", "changes"]);
    expect(store.graph.has(person)).toBe(false);
    expect(store.log.all()).toEqual([]);
    store.apply({ name: "vote-for", args: { id: "idea:a" } }, { author: kid });
    expect(store.graph.out("idea:a", "votedBy" as never).map((one) => one.id)).toEqual([person]);
  });

  it("is judged under the author's sight: a record kept from it is no record", () => {
    const made = compileDocument({
      format: "graview-document",
      formatVersion: 1,
      name: "Rocks",
      roles: ["family", "guest"],
      kinds: {
        explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
        rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who", inverse: "what" } } },
      },
      acts: { "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] } },
      policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["family"], kinds: ["explorer", "rock"] }, { roles: ["guest"], kinds: ["rock"] }] },
    } as never);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    const store = new Store<AnySchema>({ schema: made.app.schema, mutations: made.app.mutations as never, policy: made.app.policy!, snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [] } as never });
    const call = [{ name: "find-rock", args: { id: "rock:q" } }];
    const family: Principal = { kind: "human", id: "user:nick", roles: ["family"] };
    expect(store.wouldDo(call, family)).toEqual(["changes"]);
    // A family seat with a profile, its person not made yet: as apply would, the person first.
    expect(store.wouldDo(call, { ...family, profile: { id: "prf_mia", name: "Mia" } })).toEqual(["changes"]);
    expect(store.graph.has(profilePersonId("user:nick", { id: "prf_mia" }))).toBe(false);
    const refused = store.wouldDo(call, { ...family, roles: ["guest"] })[0] as { refused: Error };
    expect(refused.refused.message).toMatch(/is done as you, and you have no record here/);
  });
});

describe("a store's version", () => {
  it("moves on every change, adopt of a same-sized graph, day turned and reread", () => {
    const store = ideas();
    const seen: number[] = [store.version];
    store.apply({ name: "vote-for", args: { id: "idea:a" } }, { author: ann });
    seen.push(store.version);
    const snapshot = store.snapshot();
    store.adopt({ snapshot: { ...snapshot, nodes: snapshot.nodes.map((node) => (node.id === "idea:b" ? { ...node, title: "A long hike" } : node)) } as never, log: store.log.all() });
    seen.push(store.version);
    store.tick("2031-01-02T12:00:00Z");
    seen.push(store.version);
    store.reread();
    seen.push(store.version);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
