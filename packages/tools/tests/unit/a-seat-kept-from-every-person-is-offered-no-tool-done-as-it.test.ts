import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/*
 * A SEAT KEPT FROM EVERY PERSON IS OFFERED NO TOOL DONE AS IT. An act done
 * as `$me` runs under the seat's sight, where its own person is no record,
 * so an agent seat whose sight keeps the people kind from it is not handed
 * the tool to be refused by: the store's runtime and the stateless surface
 * a host lists agree, with a profile and without. A seat that sees the
 * people keeps the tool.
 */
const rocks = (): GraviewApp<AnySchema> => {
  const compiled = compileDocument({
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
    policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["family"], kinds: ["explorer", "rock"] }, { roles: ["guest"], kinds: ["rock"] }] },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp<AnySchema>;
};

const store = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations as never, policy: app.policy!, snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, { id: "rock:q", kind: "rock", title: "Quartz" }], edges: [] } as never });

const guest: Principal = { kind: "human", id: "user:nick", roles: ["guest"] };
const family: Principal = { ...guest, roles: ["family"] };
const profiled = (seat: Principal): Principal => ({ ...seat, profile: { id: "prf_mia", name: "Mia" } });
const tools = (app: GraviewApp<AnySchema>, seat: Principal) => ({
  runtime: createToolRuntime(store(app), { author: seat }).definitions.map((tool) => tool.name),
  listed: toolDefinitions(app, seat).definitions.map((tool) => tool.name),
});

describe("an agent seat kept from every person", () => {
  for (const [said, seat] of [["without a profile", guest], ["with a profile", profiled(guest)]] as const) {
    it(`is offered no tool done as $me, on the runtime or the listed surface, ${said}`, () => {
      const { runtime, listed } = tools(rocks(), seat);
      expect(runtime.some((name) => /find.rock/.test(name))).toBe(false);
      expect(listed.some((name) => /find.rock/.test(name))).toBe(false);
      expect(runtime.some((name) => /polish/.test(name))).toBe(true);
      expect(listed).toEqual(runtime);
    });
  }
});

describe("an agent seat that sees the people", () => {
  it("keeps the tool done as $me on both surfaces", () => {
    const { runtime, listed } = tools(rocks(), family);
    expect(runtime.some((name) => /find.rock/.test(name))).toBe(true);
    expect(listed.some((name) => /find.rock/.test(name))).toBe(true);
  });
});
