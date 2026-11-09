import "@graview/core/field-sight";
import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/*
 * A SEAT KEPT FROM ITS OWN PERSON IS OFFERED NO TOOL DONE AS IT. An act done
 * as `$me` runs under the seat's sight, where its own person is no record,
 * so an agent seat whose sight keeps it from that record is not handed the
 * tool to be refused by: the store's runtime and the stateless surface a
 * host lists agree, with a profile and without, with an id and without, and
 * across every shape of sight — of the whole kind, of its own records
 * (`own`), through a relation (`via`, which reaches others and never the
 * seat itself) and of some fields (`fields`, `hide`, with field sight
 * loaded, as a host that declares one loads it).
 */
type Sight = Record<string, unknown>;
const rocks = (guestSees: Sight | undefined): GraviewApp<AnySchema> => {
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: "Rocks",
    roles: ["family", "guest"],
    kinds: {
      explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true }, phone: { type: "string" } }, edges: { friendOf: { to: ["explorer"], description: "a friend", inverse: "friends" } } },
      rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who", inverse: "what" } } },
    },
    acts: {
      "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] },
      polish: { title: "Polish", on: "rock", effects: [{ set: { title: "Polished" } }] },
    },
    policy: {
      grants: [{ roles: "*", mutations: "*" }],
      sees: [{ roles: ["family"], kinds: ["explorer", "rock"] }, { roles: ["guest"], kinds: ["rock"] }, ...(guestSees ? [{ roles: ["guest"], kinds: ["explorer"], ...guestSees }] : [])],
    },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
};

const store = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations as never,
    policy: app.policy!,
    snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [{ kind: "foundBy", from: "rock:q", to: "user:nick" }] } as never,
  });

const guest: Principal = { kind: "human", id: "user:nick", roles: ["guest"] };
const family: Principal = { ...guest, roles: ["family"] };
const profiled = (seat: Principal): Principal => ({ ...seat, profile: { id: "prf_mia", name: "Mia" } });
const nameless = (seat: Principal): Principal => ({ kind: seat.kind, roles: seat.roles! }) as Principal;
const offers = (app: GraviewApp<AnySchema>, seat: Principal) => {
  const runtime = createToolRuntime(store(app), { author: seat }).definitions.map((tool) => tool.name);
  const listed = toolDefinitions(app, seat).definitions.map((tool) => tool.name);
  return { runtime: runtime.some((name) => /find.rock/.test(name)), listed: listed.some((name) => /find.rock/.test(name)), polish: runtime.some((name) => /polish/.test(name)) };
};

const SIGHTS: readonly (readonly [string, Sight | undefined, boolean])[] = [
  ["no sight of the people", undefined, false],
  ["a sight of the whole kind", {}, true],
  ["a sight of its own records", { own: true }, true],
  ["a sight through a relation", { via: "friendOf" }, false],
  ["a sight of some fields", { fields: ["name"] }, true],
  ["a sight that hides a field", { hide: ["phone"] }, true],
];

describe("the runtime and the listed surface agree on a tool done as $me", () => {
  for (const [said, sight, offered] of SIGHTS) {
    for (const [who, seat] of [["without a profile", guest], ["with a profile", profiled(guest)]] as const) {
      it(`for a seat with ${said}, ${who}: ${offered ? "offered" : "not offered"}`, () => {
        const { runtime, listed, polish } = offers(rocks(sight), seat);
        expect(polish).toBe(true);
        expect(runtime).toBe(offered);
        expect(listed).toBe(runtime);
      });
    }
  }

  it("for a seat with no id, kept from the people kind: not offered on either", () => {
    const seat = nameless(guest);
    expect(offers(rocks(undefined), seat)).toMatchObject({ runtime: false, listed: false });
    // Through a sight of its own records it sees no person, having no id to own one by.
    expect(offers(rocks({ own: true }), seat)).toMatchObject({ runtime: false, listed: false });
  });

  it("for a seat that sees the people: kept on both", () => {
    expect(offers(rocks(undefined), family)).toMatchObject({ runtime: true, listed: true });
  });
});
