import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { profilePersonId, Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * AN ACT DONE AS `$me` IS OFFERED ONLY TO A SEAT THAT CAN BE SOMEBODY HERE.
 * An act runs under its author's sight, so a seat whose sight keeps the people
 * kind from it has no record of its own to be: offering it "I found it" and
 * then refusing it, with a profile or without, is what nobody should meet.
 */
const rocks = () => {
  const doc = {
    format: "graview-document",
    formatVersion: 1,
    name: "Rocks",
    roles: ["family", "guest"],
    kinds: {
      explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
      rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who", inverse: "what" } } },
    },
    acts: {
      "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] },
      polish: { title: "Polish", on: "rock", effects: [{ set: { title: "Polished" } }] },
    },
    policy: {
      grants: [{ roles: "*", mutations: "*" }],
      sees: [
        { roles: ["family"], kinds: ["explorer", "rock"] },
        { roles: ["guest"], kinds: ["rock"] },
      ],
    },
  };
  const made = compileDocument(doc as never);
  if (!made.ok) throw new Error(JSON.stringify(made.findings.filter((one) => one.severity === "error")));
  return new Store<AnySchema>({
    schema: made.app.schema,
    mutations: made.app.mutations as never,
    policy: made.app.policy!,
    snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [] } as never,
  });
};

const guest: Principal = { kind: "human", id: "user:nick", roles: ["guest"] };
const family: Principal = { ...guest, roles: ["family"] };
const profiled = (seat: Principal): Principal => ({ ...seat, profile: { id: "prf_mia", name: "Mia" } });
const call = { name: "find-rock", args: { id: "rock:q" } };

describe("a seat whose sight keeps the people kind from it", () => {
  for (const [said, seat] of [["without a profile", guest], ["with a profile", profiled(guest)]] as const) {
    it(`is not offered an act done as $me, and is refused it in words, ${said}`, () => {
      const store = rocks();
      const offered = store.permittedMutations(seat).map((one) => one.name);
      expect(offered).not.toContain("find-rock");
      expect(offered).toContain("polish");
      expect(store.permits(call, seat)).toMatchObject({ ok: false, refusal: { message: '"I found it" is done as you, and you have no record here' } });
      expect(() => store.apply(call, { author: seat })).toThrow(/"I found it" is done as you, and you have no record here/);
      expect(store.log.all()).toEqual([]);
    });
  }
});

describe("a seat that can see its own person", () => {
  for (const [said, seat, person] of [
    ["without a profile", family, "user:nick"],
    ["with a profile", profiled(family), profilePersonId("user:nick", { id: "prf_mia" })],
  ] as const) {
    it(`is offered an act done as $me and it lands, ${said}`, () => {
      const store = rocks();
      expect(store.permittedMutations(seat).map((one) => one.name)).toContain("find-rock");
      expect(store.permits(call, seat).ok).toBe(true);
      store.apply(call, { author: seat });
      expect(store.graph.out("rock:q", "foundBy" as never).map((one) => one.id)).toEqual([person]);
    });
  }
});
