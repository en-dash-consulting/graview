import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocument } from "../../src/check.js";
import { ticksOf } from "../../src/history.js";

/**
 * A PROFILE'S PERSON HAS AN ID OF ITS OWN. Made on a profile's first act, it
 * is tied to its seat by the seat's mark, which only that seat and the host
 * are told, under an id of its own: a member who sees the people is served
 * the person as its own record.
 */
const board = {
  format: "graview-document",
  formatVersion: 1,
  name: "Rocks",
  roles: ["family"],
  kinds: {
    explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
    rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true } }, edges: { foundBy: { to: ["explorer"], description: "who found it", inverse: "what they found" } } },
  },
  acts: {
    "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] },
    "rename-explorer": { title: "Rename me", on: "explorer", writes: ["name"] },
  },
  policy: {
    grants: [
      { roles: ["family"], mutations: ["find-rock"] },
      { roles: ["family"], mutations: ["rename-explorer"], self: true },
    ],
    sees: [{ roles: ["family"], kinds: ["rock", "explorer"] }],
  },
};

const ACCOUNT = "acct-7k2mq9";
const mia: Principal = { kind: "human", id: ACCOUNT, name: "Household", roles: ["family"], profile: { id: "prf_mia", name: "Mia" } };
const leo: Principal = { ...mia, profile: { id: "prf_leo", name: "Leo" } };
const ann: Principal = { kind: "human", id: "user:ann", name: "Ann", roles: ["family"] };

function storeOf(): Store<AnySchema> {
  const compiled = compileDocument(board as never, { today: () => "2026-11-16" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return new Store<AnySchema>({
    schema: compiled.app.schema,
    mutations: compiled.app.mutations as never,
    policy: compiled.app.policy!,
    snapshot: { nodes: [{ id: "user:ann", kind: "explorer", name: "Ann" }, { id: "rock:quartz", kind: "rock", title: "Quartz" }, { id: "rock:opal", kind: "rock", title: "Opal" }], edges: [] } as never,
  });
}

describe("a profile's person", () => {
  it("is made under an id of its own, and is the profile's $me", () => {
    const store = storeOf();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    const person = store.personOf(mia)!;
    expect(person).toBeDefined();
    expect(person).not.toContain(ACCOUNT);
    expect(person.startsWith("explorer:")).toBe(true);
    expect(store.graph.getNode(person)).toMatchObject({ kind: "explorer", name: "Mia" });
    expect(store.graph.out("rock:quartz", "foundBy" as never).map((one) => one.id)).toEqual([person]);
    store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia });
    expect(store.graph.out("rock:opal", "foundBy" as never).map((one) => one.id)).toEqual([person]);
    expect(store.log.all().filter((op) => op.intent === "Mia joins")).toHaveLength(1);
  });

  it("is served to another member who sees the people as its own record, in the graph, the log and history", () => {
    const store = storeOf();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    store.apply({ name: "rename-explorer", args: { id: store.personOf(mia)!, name: "Mia R" } }, { author: mia });
    store.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: leo });
    const seen = store.seenBy(ann);
    expect(seen.graph.getNode(store.personOf(mia)!)).toMatchObject({ name: "Mia R" });
    expect(JSON.stringify(seen.graph.snapshot())).not.toContain(ACCOUNT);
    expect(JSON.stringify(seen.log.all())).not.toContain(ACCOUNT);
    expect(JSON.stringify(seen.batches())).not.toContain(ACCOUNT);
    expect(JSON.stringify(ticksOf(seen, { me: ann }))).not.toContain(ACCOUNT);
  });

  it("gives each profile on one account a person of its own, and itself alone a `self` grant on it", () => {
    const store = storeOf();
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia });
    store.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: leo });
    const [hers, his] = [store.personOf(mia)!, store.personOf(leo)!];
    expect(hers).not.toBe(his);
    expect(store.permits({ name: "rename-explorer", args: { id: hers, name: "M" } }, mia).ok).toBe(true);
    expect(store.permits({ name: "rename-explorer", args: { id: his, name: "M" } }, mia).ok).toBe(false);
    expect(store.permits({ name: "rename-explorer", args: { id: hers, name: "M" } }, ann).ok).toBe(false);
  });

  it("is made under the same id wherever its batch lands, and not again once removed", () => {
    const one = storeOf();
    const two = storeOf();
    one.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia, batch: "batch:page:1" });
    two.apply({ name: "find-rock", args: { id: "rock:quartz" } }, { author: mia, batch: "batch:page:1" });
    expect(one.personOf(mia)).toBe(two.personOf(mia));
    one.applyPrimitives([{ op: "remove-node", node: one.graph.getNode(one.personOf(mia)!) as never }], { author: { kind: "system" } });
    expect(() => one.apply({ name: "find-rock", args: { id: "rock:opal" } }, { author: mia })).toThrow();
    expect(one.log.all().filter((op) => op.intent === "Mia joins")).toHaveLength(1);
  });
});
